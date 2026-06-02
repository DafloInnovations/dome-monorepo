import {
  BookingPaymentStatus,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  type Prisma,
  type Province,
  SlotStatus,
} from "@prisma/client";
import { calculateTax } from "@dome/utils";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { stripe } from "../lib/stripe";
import { sendPushNotification, saveNotification } from "../lib/firebase";

const SLOT_LOCK_TTL = 300;          // 5 minutes
const FULL_REFUND_CUTOFF_HOURS = 24; // ≥ 24h before slot → full Stripe refund

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

function formatTtl(ttl: number): string {
  if (ttl <= 0) return "soon";
  if (ttl < 60) return `${ttl} second${ttl !== 1 ? "s" : ""}`;
  const minutes = Math.ceil(ttl / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

// ─── Create booking + acquire 5-min Redis slot lock ──────────────────────────

export async function createBooking(
  userId: string,
  slotId: string,
  facilityId: string,
  notes?: string
) {
  // ── Check slot existence and per-status availability ────────────────────────
  const slot = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!slot) throw appError("Slot not found", 404);
  if (slot.facilityId !== facilityId) throw appError("Slot not found", 404);

  const lockKey = `slot:${slotId}:lock`;

  if (slot.status === SlotStatus.HELD) {
    const ttl = await redis.ttl(lockKey);
    throw appError(
      `This slot is temporarily held. Try again in ${formatTtl(ttl)}.`,
      409,
      "SLOT_HELD"
    );
  }
  if (slot.status === SlotStatus.BOOKED) {
    throw appError("This slot has already been booked.", 409, "SLOT_BOOKED");
  }
  if (slot.status !== SlotStatus.AVAILABLE) {
    throw appError(`Slot is ${slot.status.toLowerCase()}`, 409, "SLOT_UNAVAILABLE");
  }

  // ── Check Redis lock before attempting to acquire it ─────────────────────────
  // Pre-checking lets us return a meaningful message (with TTL) rather than
  // silently racing on SET NX and returning a generic error after the fact.
  const existingLock = await redis.get(lockKey);
  if (existingLock) {
    const ttl = await redis.ttl(lockKey);
    const timeMsg = formatTtl(ttl);
    if (existingLock !== userId) {
      throw appError(
        `This slot is temporarily held by another player. Try again in ${timeMsg}.`,
        409,
        "SLOT_LOCKED"
      );
    }
    throw appError(
      `You already have this slot held. Complete your payment or wait ${timeMsg}.`,
      409,
      "SLOT_ALREADY_HELD"
    );
  }

  // ── Acquire Redis lock (5-min hold) ─────────────────────────────────────────
  const acquired = await redis.set(lockKey, userId, "EX", SLOT_LOCK_TTL, "NX");
  if (acquired !== "OK") {
    // Another request slipped in between our GET and SET.
    const raceTtl = await redis.ttl(lockKey);
    throw appError(
      `This slot is temporarily held by another player. Try again in ${formatTtl(raceTtl)}.`,
      409,
      "SLOT_LOCKED"
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { province: true },
  });
  if (!user) throw appError("User not found", 404);

  const subtotalCAD = Number(slot.priceCAD);
  const taxCAD = calculateTax(subtotalCAD, user.province as Province);
  const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

  try {
    const booking = await prisma.booking.create({
      data: {
        slotId,
        facilityId,
        userId,
        status: BookingStatus.PENDING,
        paymentStatus: BookingPaymentStatus.UNPAID,
        subtotalCAD,
        taxCAD,
        totalCAD,
        taxProvince: user.province,
        notes,
      },
      include: {
        slot: true,
        facility: { include: { address: true } },
      },
    });

    return {
      ...booking,
      subtotalCAD: Number(booking.subtotalCAD),
      taxCAD: Number(booking.taxCAD),
      totalCAD: Number(booking.totalCAD),
      lockExpiresInSeconds: SLOT_LOCK_TTL,
    };
  } catch (err) {
    // Two concurrent requests can both pass the status check above if they
    // arrive before either has written. The unique constraint on slotId is
    // the final guard — surface it as 409, not 500.
    if (
      (err as { code?: string }).code === "P2002" &&
      String((err as { meta?: { target?: unknown } }).meta?.target).includes("slotId")
    ) {
      await redis.del(lockKey);
      throw appError("This slot has already been booked", 409, "SLOT_CONFLICT");
    }
    throw err;
  }
}

// ─── Release lock (user abandoned booking before paying) ─────────────────────

export async function releaseLock(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
  });
  if (!booking) throw appError("Booking not found", 404);

  // Idempotent: already cancelled or confirmed — nothing to do
  if (booking.status !== BookingStatus.PENDING) {
    return { released: false, reason: booking.status };
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelReason: "Lock released by user",
        cancelledAt: new Date(),
      },
    }),
    prisma.slot.update({
      where: { id: booking.slotId },
      data: { status: SlotStatus.AVAILABLE },
    }),
  ]);

  await redis.del(`slot:${booking.slotId}:lock`);

  return { released: true };
}

// ─── Confirm booking after client-side Stripe success ────────────────────────

export async function confirmBooking(
  userId: string,
  bookingId: string,
  paymentIntentId: string
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
  });
  if (!booking) throw appError("Booking not found", 404);

  // Idempotent — webhook may have already confirmed it
  if (booking.status === BookingStatus.CONFIRMED) {
    return prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true, facility: { include: { address: true } } },
    });
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw appError("Booking is not in a confirmable state", 400);
  }

  // Verify payment directly with Stripe
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== "succeeded") throw appError("Payment has not succeeded yet", 402);
  if (pi.metadata["bookingId"] !== bookingId)
    throw appError("PaymentIntent does not belong to this booking", 400);

  const [confirmed] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        paymentStatus: BookingPaymentStatus.PAID,
      },
      include: { slot: true, facility: { include: { address: true } } },
    }),
    prisma.slot.update({
      where: { id: booking.slotId },
      data: { status: SlotStatus.BOOKED },
    }),
    prisma.payment.upsert({
      where: { gatewayPaymentId: pi.id },
      create: {
        bookingId,
        userId,
        amountCAD: pi.amount / 100,
        taxCAD: Number(booking.taxCAD),
        method: PaymentMethod.CARD,
        gatewayPaymentId: pi.id,
        status: PaymentStatus.SUCCEEDED,
      },
      update: { status: PaymentStatus.SUCCEEDED },
    }),
  ]);

  await redis.del(`slot:${booking.slotId}:lock`);

  // Push: booking confirmed
  const userForToken = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true },
  });
  if (confirmed) {
    const sport = confirmed.facility.sport.charAt(0) + confirmed.facility.sport.slice(1).toLowerCase();
    const slotDate = confirmed.slot.date instanceof Date
      ? confirmed.slot.date.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
      : String(confirmed.slot.date).split("T")[0];
    const bTitle = "Booking Confirmed ✅";
    const bBody = `${sport} at ${confirmed.facility.name} on ${slotDate} at ${confirmed.slot.startTime}`;
    const bData = { type: "booking_confirmed", bookingId };
    await saveNotification(userId, "BOOKING_CONFIRMED", bTitle, bBody, bData);
    if (userForToken?.deviceToken) {
      await sendPushNotification(userForToken.deviceToken, bTitle, bBody, bData);
    }
  }

  return confirmed;
}

// ─── Cancel booking with tiered refund logic ─────────────────────────────────

export async function cancelBooking(
  userId: string,
  bookingId: string,
  reason?: string
) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
    include: { slot: true, payment: true },
  });
  if (!booking) throw appError("Booking not found", 404);

  // Compute hours until slot starts
  const [y, m, d] = booking.slot.date.toISOString().split("T")[0]!.split("-").map(Number);
  const [sh, sm] = booking.slot.startTime.split(":").map(Number);
  const slotStartMs = Date.UTC(y!, m! - 1, d!, sh!, sm!);
  const hoursUntil = (slotStartMs - Date.now()) / 3_600_000;

  let refundType: "full" | "credits" | "none" = "none";
  if (booking.payment && booking.paymentStatus === BookingPaymentStatus.PAID) {
    if (hoursUntil >= FULL_REFUND_CUTOFF_HOURS) refundType = "full";
    else if (hoursUntil > 0) refundType = "credits";
  }

  const totalCAD = Number(booking.totalCAD);
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (refundType === "full" && booking.payment) {
    await stripe.refunds.create({ payment_intent: booking.payment.gatewayPaymentId });
    ops.push(
      prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundedAt: new Date(),
          refundAmountCAD: totalCAD,
        },
      })
    );
  }

  if (refundType === "credits") {
    ops.push(
      prisma.domeCredit.create({
        data: {
          userId,
          bookingId,
          amountCAD: totalCAD,
          reason: `Late cancellation credit for booking ${bookingId}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 3_600_000),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { creditBalanceCAD: { increment: totalCAD } },
      })
    );
  }

  ops.push(
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        paymentStatus:
          refundType === "full" ? BookingPaymentStatus.REFUNDED : booking.paymentStatus,
        cancelledAt: new Date(),
        cancelReason: reason,
        ...(refundType === "credits" && { creditsIssuedCAD: totalCAD }),
      },
    }),
    prisma.slot.update({
      where: { id: booking.slotId },
      data: { status: SlotStatus.AVAILABLE },
    })
  );

  await prisma.$transaction(ops);
  await redis.del(`slot:${booking.slotId}:lock`);

  // Push + DB notification
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true },
  });
  const cancelTitle = "Booking Cancelled";
  const cancelBody =
    refundType === "full"
      ? `Full refund of C$${totalCAD.toFixed(2)} initiated to your card.`
      : refundType === "credits"
      ? `C$${totalCAD.toFixed(2)} Dome Credits added to your wallet.`
      : "Your booking has been cancelled.";
  const cancelData = { type: "booking_cancelled", bookingId };
  await saveNotification(userId, "BOOKING_CANCELLED", cancelTitle, cancelBody, cancelData);
  if (actor?.deviceToken) {
    await sendPushNotification(actor.deviceToken, cancelTitle, cancelBody, cancelData);
  }

  return {
    refundType,
    creditsIssuedCAD: refundType === "credits" ? totalCAD : null,
    refundedCAD: refundType === "full" ? totalCAD : null,
  };
}

// ─── Cancel preview (no mutations) ───────────────────────────────────────────

export async function cancelPreview(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      userId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
    include: { slot: true, payment: true },
  });
  if (!booking) throw appError("Booking not found", 404);

  const [y, m, d] = booking.slot.date.toISOString().split("T")[0]!.split("-").map(Number);
  const [sh, sm] = booking.slot.startTime.split(":").map(Number);
  const slotStartMs = Date.UTC(y!, m! - 1, d!, sh!, sm!);
  const hoursUntilSlot = (slotStartMs - Date.now()) / 3_600_000;

  const totalCAD = Number(booking.totalCAD);
  const hasPaid =
    booking.payment !== null && booking.paymentStatus === BookingPaymentStatus.PAID;

  let refundType: "STRIPE_REFUND" | "DOME_CREDITS" | "NO_REFUND";
  let message: string;

  if (!hasPaid || totalCAD === 0) {
    refundType = "NO_REFUND";
    message = "No payment on file. Your booking will be cancelled at no cost.";
  } else if (hoursUntilSlot >= FULL_REFUND_CUTOFF_HOURS) {
    refundType = "STRIPE_REFUND";
    message = `You'll receive a full refund of C$${totalCAD.toFixed(2)} to your card.`;
  } else {
    refundType = "DOME_CREDITS";
    message = `C$${totalCAD.toFixed(2)} in Dome Credits will be added to your wallet (valid 12 months).`;
  }

  return {
    hoursUntilSlot: Math.max(0, hoursUntilSlot),
    withinFreeWindow: hoursUntilSlot >= FULL_REFUND_CUTOFF_HOURS,
    refundType,
    refundAmount: totalCAD,
    message,
  };
}

// ─── User booking history ─────────────────────────────────────────────────────

export async function myBookings(userId: string, page = 1, limit = 20) {
  const take = Math.min(limit, 50);
  const skip = (Math.max(page, 1) - 1) * take;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where: { userId },
      include: {
        slot: { include: { court: true } },
        facility: { include: { address: true } },
        payment: {
          select: { id: true, status: true, method: true, amountCAD: true },
        },
      },
      orderBy: { slot: { date: "desc" } },
      skip,
      take,
    }),
    prisma.booking.count({ where: { userId } }),
  ]);

  return {
    data: bookings.map((b) => ({
      ...b,
      subtotalCAD: Number(b.subtotalCAD),
      taxCAD: Number(b.taxCAD),
      totalCAD: Number(b.totalCAD),
      creditsIssuedCAD: b.creditsIssuedCAD !== null ? Number(b.creditsIssuedCAD) : null,
      slot: {
        ...b.slot,
        priceCAD: Number(b.slot.priceCAD),
        court: b.slot.court ?? null,
      },
      payment: b.payment
        ? { ...b.payment, amountCAD: Number(b.payment.amountCAD) }
        : null,
    })),
    total,
    page: Math.max(page, 1),
    limit: take,
    hasMore: skip + take < total,
  };
}
