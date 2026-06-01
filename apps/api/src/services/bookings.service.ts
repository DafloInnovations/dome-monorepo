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

const SLOT_LOCK_TTL = 300;          // 5 minutes
const FULL_REFUND_CUTOFF_HOURS = 24; // ≥ 24h before slot → full Stripe refund

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// ─── Create booking + acquire 5-min Redis slot lock ──────────────────────────

export async function createBooking(
  userId: string,
  slotId: string,
  facilityId: string,
  notes?: string
) {
  const slot = await prisma.slot.findFirst({
    where: { id: slotId, facilityId, status: SlotStatus.AVAILABLE },
    include: { facility: { select: { name: true, address: true } } },
  });
  if (!slot) throw appError("Slot not found or no longer available", 404);

  // SET slot:{id}:lock userId EX 300 NX
  const lockKey = `slot:${slotId}:lock`;
  const acquired = await redis.set(lockKey, userId, "EX", SLOT_LOCK_TTL, "NX");

  if (acquired !== "OK") {
    const holder = await redis.get(lockKey);
    if (holder !== userId) {
      throw appError(
        "This slot is temporarily held by another user. Please try a different time.",
        409,
        "SLOT_LOCKED"
      );
    }
    // Same user re-hitting endpoint — refresh the lock TTL
    await redis.expire(lockKey, SLOT_LOCK_TTL);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { province: true },
  });
  if (!user) throw appError("User not found", 404);

  const subtotalCAD = Number(slot.priceCAD);
  const taxCAD = calculateTax(subtotalCAD, user.province as Province);
  const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

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

  return {
    refundType,
    creditsIssuedCAD: refundType === "credits" ? totalCAD : null,
    refundedCAD: refundType === "full" ? totalCAD : null,
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
        slot: true,
        facility: { include: { address: true } },
        payment: {
          select: { id: true, status: true, method: true, amountCAD: true },
        },
      },
      orderBy: { createdAt: "desc" },
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
      slot: { ...b.slot, priceCAD: Number(b.slot.priceCAD) },
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
