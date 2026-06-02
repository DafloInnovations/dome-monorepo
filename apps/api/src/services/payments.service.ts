import {
  BookingPaymentStatus,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  SlotStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { stripe } from "../lib/stripe";
import { sendPushNotification, saveNotification } from "../lib/firebase";

// Derive Stripe types directly from the instance — avoids the `export =` namespace issue in v22.
type StripeWebhookEvent = ReturnType<typeof stripe.webhooks.constructEvent>;
type StripePaymentIntentMeta = {
  id: string;
  amount: number;
  metadata: Record<string, string>;
  last_payment_error?: { message?: string } | null;
};

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// ─── Create PaymentIntent ─────────────────────────────────────────────────────

export async function createPaymentIntent(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { facility: { select: { name: true } } },
  });
  if (!booking) throw appError("Booking not found", 404);
  if (booking.status === BookingStatus.CONFIRMED)
    throw appError("Booking is already confirmed", 400);
  if (booking.status !== BookingStatus.PENDING)
    throw appError("Booking is not in a payable state", 400);

  // Verify the slot lock is still held by this user
  const lockKey = `slot:${booking.slotId}:lock`;
  const holder = await redis.get(lockKey);
  if (holder !== userId) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED, cancelReason: "Payment hold expired" },
    });
    throw appError(
      "Your hold on this slot has expired. Please start a new booking.",
      409,
      "LOCK_EXPIRED"
    );
  }

  const amountCents = Math.round(Number(booking.totalCAD) * 100);

  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "cad",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    description: `Dome booking — ${booking.facility.name}`,
    metadata: {
      bookingId: booking.id,
      userId,
      slotId: booking.slotId,
      facilityId: booking.facilityId,
    },
  });

  return {
    clientSecret: pi.client_secret!,
    paymentIntentId: pi.id,
    amountCAD: Number(booking.subtotalCAD),
    taxCAD: Number(booking.taxCAD),
    totalCAD: Number(booking.totalCAD),
  };
}

// ─── Stripe webhook handler ───────────────────────────────────────────────────

export async function handleWebhook(rawBody: Buffer, signature: string) {
  let event: StripeWebhookEvent;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env["STRIPE_WEBHOOK_SECRET"]!
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "signature mismatch";
    throw appError(`Webhook error: ${msg}`, 400);
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as unknown as StripePaymentIntentMeta;
      const { bookingId, userId, slotId } = pi.metadata;
      if (!bookingId || !slotId || !userId) break;

      await prisma.$transaction([
        prisma.payment.upsert({
          where: { gatewayPaymentId: pi.id },
          create: {
            bookingId,
            userId,
            amountCAD: pi.amount / 100,
            taxCAD: 0,
            method: PaymentMethod.CARD,
            gatewayPaymentId: pi.id,
            status: PaymentStatus.SUCCEEDED,
          },
          update: { status: PaymentStatus.SUCCEEDED },
        }),
        prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CONFIRMED,
            paymentStatus: BookingPaymentStatus.PAID,
          },
        }),
        prisma.slot.update({
          where: { id: slotId },
          data: { status: SlotStatus.BOOKED },
        }),
      ]);

      await redis.del(`slot:${slotId}:lock`);

      // Push: booking confirmed via webhook
      const [userForToken, bookingWithDetails] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { deviceToken: true } }),
        prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            slot: { select: { date: true, startTime: true } },
            facility: { select: { name: true, sport: true } },
          },
        }),
      ]);
      if (bookingWithDetails) {
        const sport = bookingWithDetails.facility.sport.charAt(0) +
          bookingWithDetails.facility.sport.slice(1).toLowerCase();
        const slotDate = bookingWithDetails.slot.date instanceof Date
          ? bookingWithDetails.slot.date.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
          : String(bookingWithDetails.slot.date).split("T")[0];
        const wTitle = "Booking Confirmed ✅";
        const wBody = `${sport} at ${bookingWithDetails.facility.name} on ${slotDate} at ${bookingWithDetails.slot.startTime}`;
        const wData = { type: "booking_confirmed", bookingId };
        await saveNotification(userId, "BOOKING_CONFIRMED", wTitle, wBody, wData);
        if (userForToken?.deviceToken) {
          await sendPushNotification(userForToken.deviceToken, wTitle, wBody, wData);
        }
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as unknown as StripePaymentIntentMeta;
      const { bookingId, slotId } = pi.metadata;
      if (!bookingId || !slotId) break;

      const failReason = pi.last_payment_error?.message ?? "Payment failed";

      await prisma.$transaction([
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.CANCELLED, cancelReason: failReason },
        }),
        prisma.slot.update({
          where: { id: slotId },
          data: { status: SlotStatus.AVAILABLE },
        }),
      ]);

      await redis.del(`slot:${slotId}:lock`);
      break;
    }

    default:
      break;
  }

  return { received: true };
}
