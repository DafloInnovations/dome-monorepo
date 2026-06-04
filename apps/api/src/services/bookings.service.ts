import {
  BookingPaymentStatus,
  BookingStatus,
  GroupBookingStatus,
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
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendVendorBookingNotification,
} from "../lib/email";
import { checkAndTriggerAlerts } from "./alerts.service";

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

  // ── SESSION slots: capacity-based, multiple bookings allowed ────────────────
  const isSession = slot.capacity !== null;
  if (isSession) {
    if (slot.status === SlotStatus.BLOCKED) {
      throw appError(`Slot is blocked`, 409, "SLOT_UNAVAILABLE");
    }
    if (slot.capacity !== null && slot.spotsBooked >= slot.capacity) {
      throw appError("This session is fully booked.", 409, "SESSION_FULL");
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { province: true } });
    if (!user) throw appError("User not found", 404);

    const subtotalCAD = Number(slot.priceCAD);
    const taxCAD = calculateTax(subtotalCAD, user.province as Province);
    const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

    try {
      const [booking] = await prisma.$transaction([
        prisma.booking.create({
          data: { slotId, facilityId, userId, status: BookingStatus.PENDING, paymentStatus: BookingPaymentStatus.UNPAID, subtotalCAD, taxCAD, totalCAD, taxProvince: user.province, notes },
          include: { slot: true, facility: { include: { address: true } } },
        }),
        prisma.slot.update({
          where: { id: slotId },
          data: {
            spotsBooked: { increment: 1 },
            status: slot.capacity !== null && slot.spotsBooked + 1 >= slot.capacity
              ? SlotStatus.BOOKED
              : SlotStatus.AVAILABLE,
          },
        }),
      ]);
      return { ...booking!, subtotalCAD: Number(booking!.subtotalCAD), taxCAD: Number(booking!.taxCAD), totalCAD: Number(booking!.totalCAD), lockExpiresInSeconds: null };
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") {
        throw appError("You have already booked this session.", 409, "SLOT_CONFLICT");
      }
      throw err;
    }
  }

  // ── Standard SLOT_BASED exclusive booking ───────────────────────────────────
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

  const acquired = await redis.set(lockKey, userId, "EX", SLOT_LOCK_TTL, "NX");
  if (acquired !== "OK") {
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

  // Push + email: booking confirmed
  const userForNotif = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true, email: true, emailBookingConfirmation: true, firstName: true },
  });
  if (confirmed) {
    const sport = confirmed.facility.sport.charAt(0) + confirmed.facility.sport.slice(1).toLowerCase();
    const slotDateObj = confirmed.slot.date instanceof Date ? confirmed.slot.date : new Date(confirmed.slot.date);
    const slotDate = slotDateObj.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const slotDateFull = slotDateObj.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const bTitle = "Booking Confirmed ✅";
    const bBody = `${sport} at ${confirmed.facility.name} on ${slotDate} at ${confirmed.slot.startTime}`;
    const bData = { type: "booking_confirmed", bookingId };
    await saveNotification(userId, "BOOKING_CONFIRMED", bTitle, bBody, bData);
    if (userForNotif?.deviceToken) {
      await sendPushNotification(userForNotif.deviceToken, bTitle, bBody, bData);
    }

    // Email confirmation to player
    if (userForNotif?.email && userForNotif.emailBookingConfirmation) {
      const addr = confirmed.facility.address;
      const addrStr = addr
        ? `${addr.street}, ${addr.city}, ${addr.province}`
        : confirmed.facility.name;
      const [sh, sm] = confirmed.slot.startTime.split(":").map(Number);
      const [eh, em] = confirmed.slot.endTime.split(":").map(Number);
      const cancelDeadlineMs = slotDateObj.getTime() - (24 * 3_600_000);
      const cancelDeadline = new Date(cancelDeadlineMs).toLocaleString("en-CA", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      sendBookingConfirmation(userForNotif.email, {
        bookingId,
        facilityName: confirmed.facility.name,
        facilityAddress: addrStr,
        sport: confirmed.facility.sport,
        courtName: null,
        date: slotDateFull,
        startTime: `${sh}:${String(sm).padStart(2,"0")} ${sh! >= 12 ? "PM" : "AM"}`,
        endTime: `${eh}:${String(em).padStart(2,"0")} ${eh! >= 12 ? "PM" : "AM"}`,
        durationMinutes: Math.round(((eh! * 60 + em!) - (sh! * 60 + sm!)) * 60) / 60,
        subtotalCAD: Number(booking.subtotalCAD),
        taxCAD: Number(booking.taxCAD),
        totalCAD: Number(booking.totalCAD),
        cancelDeadline,
      }).catch(() => null);
    }

    // Email vendor
    const vendorUser = await prisma.user.findFirst({
      where: { vendor: { facilities: { some: { id: confirmed.facilityId } } } },
      select: { email: true },
    });
    if (vendorUser?.email) {
      const addr = confirmed.facility.address;
      const slotDateFmt = slotDateObj.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
      sendVendorBookingNotification(vendorUser.email, {
        playerFirstName: userForNotif?.firstName || "A player",
        facilityName: confirmed.facility.name,
        courtName: null,
        date: slotDateFmt,
        startTime: confirmed.slot.startTime,
        endTime: confirmed.slot.endTime,
        amountEarnedCAD: Number(booking.totalCAD) * 0.971 - 0.30, // after Stripe fee
      }).catch(() => null);
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
    include: { slot: true, payment: true, facility: { select: { name: true } } },
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

  // Fire availability alerts for the now-free slot (non-blocking)
  checkAndTriggerAlerts(
    booking.slot.facilityId,
    booking.slot.courtId,
    booking.slot.date,
    booking.slot.startTime,
    booking.slot.endTime
  ).catch((err) => console.error("[Alerts] checkAndTriggerAlerts failed:", err));

  // Push + DB + email: booking cancelled
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true, email: true, emailBookingConfirmation: true },
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

  if (actor?.email && actor.emailBookingConfirmation) {
    const slotDateObj = booking.slot.date instanceof Date ? booking.slot.date : new Date(booking.slot.date);
    sendBookingCancellation(actor.email, {
      bookingId,
      facilityName: booking.facility?.name ?? "facility",
      date: slotDateObj.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      startTime: booking.slot.startTime,
      endTime: booking.slot.endTime,
      refundType,
      refundAmountCAD: totalCAD,
    }).catch(() => null);
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
        review: { select: { id: true } },
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

// ─── Group booking ────────────────────────────────────────────────────────────

export async function createGroupBooking(
  userId: string,
  slotIds: string[],
  facilityId: string,
  notes?: string
) {
  if (slotIds.length < 2) throw appError("Group bookings require at least 2 slots", 400);
  if (slotIds.length > 10) throw appError("Maximum 10 slots per group booking", 400);

  // Fetch all slots and validate they are available
  const slots = await prisma.slot.findMany({
    where: { id: { in: slotIds }, facilityId },
  });
  if (slots.length !== slotIds.length) throw appError("One or more slots not found", 404);

  for (const slot of slots) {
    if (slot.status !== SlotStatus.AVAILABLE) {
      throw appError(`Slot ${slot.startTime}–${slot.endTime} is not available (${slot.status})`, 409, "SLOT_UNAVAILABLE");
    }
  }

  // Acquire Redis locks on all slots simultaneously
  const lockResults = await Promise.all(
    slots.map((s) => redis.set(`slot:${s.id}:lock`, userId, "EX", SLOT_LOCK_TTL, "NX"))
  );
  const failedIdx = lockResults.findIndex((r) => r !== "OK");
  if (failedIdx !== -1) {
    // Release any locks we did acquire before failing
    const toRelease = lockResults
      .map((r, i) => (r === "OK" ? slots[i]!.id : null))
      .filter(Boolean) as string[];
    if (toRelease.length) await redis.del(...toRelease.map((id) => `slot:${id}:lock`));
    throw appError(
      `Slot ${slots[failedIdx]!.startTime}–${slots[failedIdx]!.endTime} is held by another player`,
      409,
      "SLOT_LOCKED"
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { province: true } });
  if (!user) throw appError("User not found", 404);

  // Calculate totals
  const subtotalCAD = slots.reduce((s, sl) => s + Number(sl.priceCAD), 0);
  const taxCAD = calculateTax(subtotalCAD, user.province as Province);
  const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

  // Create BookingGroup + all individual Bookings in one transaction
  const group = await prisma.bookingGroup.create({
    data: {
      userId,
      facilityId,
      subtotalCAD,
      taxCAD,
      totalCAD,
      notes,
      status: GroupBookingStatus.PENDING,
      bookings: {
        create: slots.map((slot) => {
          const sub = Number(slot.priceCAD);
          const tax = calculateTax(sub, user.province as Province);
          return {
            slotId: slot.id,
            facilityId,
            userId,
            status: BookingStatus.PENDING,
            paymentStatus: BookingPaymentStatus.UNPAID,
            subtotalCAD: sub,
            taxCAD: tax,
            totalCAD: Math.round((sub + tax) * 100) / 100,
            taxProvince: user.province,
            notes,
          };
        }),
      },
    },
    include: {
      bookings: { include: { slot: true } },
      facility: { include: { address: true } },
    },
  });

  // Single Stripe PaymentIntent for the full group total
  const pi = await stripe.paymentIntents.create({
    amount: Math.round(totalCAD * 100),
    currency: "cad",
    metadata: { groupId: group.id, userId, slotIds: slotIds.join(",") },
  });

  await prisma.bookingGroup.update({
    where: { id: group.id },
    data: { paymentIntentId: pi.id },
  });

  return {
    groupId: group.id,
    bookings: group.bookings.map((b) => ({
      ...b,
      subtotalCAD: Number(b.subtotalCAD),
      taxCAD: Number(b.taxCAD),
      totalCAD: Number(b.totalCAD),
    })),
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    totalCAD,
    subtotalCAD,
    taxCAD,
    lockExpiresInSeconds: SLOT_LOCK_TTL,
  };
}

// ─── Confirm group booking after Stripe success ───────────────────────────────

export async function confirmGroupBooking(
  userId: string,
  groupId: string,
  paymentIntentId: string
) {
  const group = await prisma.bookingGroup.findFirst({
    where: { id: groupId, userId },
    include: { bookings: { include: { slot: true } } },
  });
  if (!group) throw appError("Booking group not found", 404);

  if (group.status === GroupBookingStatus.CONFIRMED) {
    return prisma.bookingGroup.findUnique({
      where: { id: groupId },
      include: { bookings: { include: { slot: true } }, facility: { include: { address: true } } },
    });
  }
  if (group.status !== GroupBookingStatus.PENDING) {
    throw appError("Booking group is not in a confirmable state", 400);
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== "succeeded") throw appError("Payment has not succeeded yet", 402);
  if (pi.metadata["groupId"] !== groupId)
    throw appError("PaymentIntent does not belong to this group", 400);

  const slotIds = group.bookings.map((b) => b.slotId);
  const bookingIds = group.bookings.map((b) => b.id);

  await prisma.$transaction([
    prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: GroupBookingStatus.CONFIRMED, paymentStatus: PaymentStatus.SUCCEEDED },
    }),
    prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { status: BookingStatus.CONFIRMED, paymentStatus: BookingPaymentStatus.PAID },
    }),
    prisma.slot.updateMany({
      where: { id: { in: slotIds } },
      data: { status: SlotStatus.BOOKED },
    }),
    prisma.payment.create({
      data: {
        bookingGroupId: groupId,
        userId,
        amountCAD: pi.amount / 100,
        taxCAD: Number(group.taxCAD),
        method: PaymentMethod.CARD,
        gatewayPaymentId: pi.id,
        status: PaymentStatus.SUCCEEDED,
      },
    }),
  ]);

  // Release all Redis locks
  if (slotIds.length) await redis.del(...slotIds.map((id) => `slot:${id}:lock`));

  // Single notification for the group
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true },
  });
  const title = "Group Booking Confirmed ✅";
  const body = `${group.bookings.length} courts booked · C$${Number(group.totalCAD).toFixed(2)}`;
  const data = { type: "booking_confirmed", groupId };
  await saveNotification(userId, "BOOKING_CONFIRMED", title, body, data);
  if (userRecord?.deviceToken) {
    await sendPushNotification(userRecord.deviceToken, title, body, data);
  }

  return prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: { bookings: { include: { slot: true } }, facility: { include: { address: true } } },
  });
}

// ─── Cancel group booking ─────────────────────────────────────────────────────

export async function cancelGroupBooking(
  userId: string,
  groupId: string,
  reason?: string
) {
  const group = await prisma.bookingGroup.findFirst({
    where: { id: groupId, userId, status: { in: [GroupBookingStatus.PENDING, GroupBookingStatus.CONFIRMED] } },
    include: { bookings: { include: { slot: true } }, payments: true },
  });
  if (!group) throw appError("Booking group not found", 404);

  const slotIds = group.bookings.map((b) => b.slotId);
  const bookingIds = group.bookings.map((b) => b.id);
  const totalCAD = Number(group.totalCAD);
  const groupPayment = group.payments[0];

  // Refund logic — same tiered approach as single bookings
  let refundType: "full" | "credits" | "none" = "none";
  if (groupPayment && group.paymentStatus === PaymentStatus.SUCCEEDED) {
    // Use the earliest slot start time for the cutoff check
    const earliest = group.bookings.reduce((min, b) => {
      const [y, m, d] = b.slot.date.toISOString().split("T")[0]!.split("-").map(Number);
      const [sh, sm] = b.slot.startTime.split(":").map(Number);
      const ms = Date.UTC(y!, m! - 1, d!, sh!, sm!);
      return ms < min ? ms : min;
    }, Infinity);
    const hoursUntil = (earliest - Date.now()) / 3_600_000;
    if (hoursUntil >= FULL_REFUND_CUTOFF_HOURS) refundType = "full";
    else if (hoursUntil > 0) refundType = "credits";
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (refundType === "full" && groupPayment) {
    await stripe.refunds.create({ payment_intent: groupPayment.gatewayPaymentId });
    ops.push(
      prisma.payment.update({
        where: { id: groupPayment.id },
        data: { status: PaymentStatus.REFUNDED, refundedAt: new Date(), refundAmountCAD: totalCAD },
      })
    );
  }
  if (refundType === "credits") {
    ops.push(
      prisma.domeCredit.create({
        data: { userId, amountCAD: totalCAD, reason: `Group booking ${groupId} cancellation credit`, expiresAt: new Date(Date.now() + 365 * 24 * 3_600_000) },
      }),
      prisma.user.update({ where: { id: userId }, data: { creditBalanceCAD: { increment: totalCAD } } })
    );
  }

  ops.push(
    prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: GroupBookingStatus.CANCELLED },
    }),
    prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason },
    }),
    prisma.slot.updateMany({
      where: { id: { in: slotIds } },
      data: { status: SlotStatus.AVAILABLE },
    })
  );

  await prisma.$transaction(ops);
  if (slotIds.length) await redis.del(...slotIds.map((id) => `slot:${id}:lock`));

  return {
    refundType,
    creditsIssuedCAD: refundType === "credits" ? totalCAD : null,
    refundedCAD: refundType === "full" ? totalCAD : null,
  };
}

// ─── Time-based booking (1+ slot IDs from available-courts) ──────────────────

export async function createTimeBooking(
  userId: string,
  slotIds: string[],
  facilityId: string
) {
  if (slotIds.length === 0) throw appError("No slots provided", 400);
  if (slotIds.length > 20) throw appError("Too many slots", 400);

  // Validate all slots exist and belong to the facility
  const slots = await prisma.slot.findMany({
    where: { id: { in: slotIds }, facilityId },
    orderBy: { startTime: "asc" },
  });
  if (slots.length !== slotIds.length) throw appError("One or more slots not found", 404);

  for (const slot of slots) {
    if (slot.status !== SlotStatus.AVAILABLE) {
      throw appError(
        `Slot ${slot.startTime}–${slot.endTime} is no longer available (${slot.status})`,
        409,
        "SLOT_UNAVAILABLE"
      );
    }
  }

  // Acquire Redis locks on all slots
  const lockResults = await Promise.all(
    slots.map((s) => redis.set(`slot:${s.id}:lock`, userId, "EX", SLOT_LOCK_TTL, "NX"))
  );
  const failedIdx = lockResults.findIndex((r) => r !== "OK");
  if (failedIdx !== -1) {
    const toRelease = lockResults
      .map((r, i) => (r === "OK" ? slots[i]!.id : null))
      .filter(Boolean) as string[];
    if (toRelease.length) await redis.del(...toRelease.map((id) => `slot:${id}:lock`));
    throw appError(
      `Slot ${slots[failedIdx]!.startTime}–${slots[failedIdx]!.endTime} is held by another player`,
      409,
      "SLOT_LOCKED"
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { province: true } });
  if (!user) throw appError("User not found", 404);

  const subtotalCAD = slots.reduce((s, sl) => s + Number(sl.priceCAD), 0);
  const taxCAD = calculateTax(subtotalCAD, user.province as Province);
  const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

  // Single slot → individual booking; multiple → group booking
  if (slots.length === 1) {
    const slot = slots[0]!;
    const sub = Number(slot.priceCAD);
    const tax = calculateTax(sub, user.province as Province);
    const tot = Math.round((sub + tax) * 100) / 100;

    const booking = await prisma.booking.create({
      data: {
        slotId: slot.id,
        facilityId,
        userId,
        status: BookingStatus.PENDING,
        paymentStatus: BookingPaymentStatus.UNPAID,
        subtotalCAD: sub,
        taxCAD: tax,
        totalCAD: tot,
        taxProvince: user.province,
      },
      include: { slot: true, facility: { include: { address: true } } },
    });

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(tot * 100),
      currency: "cad",
      metadata: { bookingId: booking.id, userId },
    });

    // Store PI ID so equipment can update the amount before payment
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentIntentId: pi.id } });

    return {
      type: "single" as const,
      bookingId: booking.id,
      groupId: null,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      totalCAD: tot,
      subtotalCAD: sub,
      taxCAD: tax,
      lockExpiresInSeconds: SLOT_LOCK_TTL,
    };
  }

  // Multiple slots → group booking (no minimum-2 constraint for time-based)
  const group = await prisma.bookingGroup.create({
    data: {
      userId,
      facilityId,
      subtotalCAD,
      taxCAD,
      totalCAD,
      status: GroupBookingStatus.PENDING,
      bookings: {
        create: slots.map((slot) => {
          const sub = Number(slot.priceCAD);
          const tax = calculateTax(sub, user.province as Province);
          return {
            slotId: slot.id,
            facilityId,
            userId,
            status: BookingStatus.PENDING,
            paymentStatus: BookingPaymentStatus.UNPAID,
            subtotalCAD: sub,
            taxCAD: tax,
            totalCAD: Math.round((sub + tax) * 100) / 100,
            taxProvince: user.province,
          };
        }),
      },
    },
    include: { bookings: { include: { slot: true } }, facility: { include: { address: true } } },
  });

  const pi = await stripe.paymentIntents.create({
    amount: Math.round(totalCAD * 100),
    currency: "cad",
    metadata: { groupId: group.id, userId, slotIds: slotIds.join(",") },
  });

  await prisma.bookingGroup.update({ where: { id: group.id }, data: { paymentIntentId: pi.id } });

  return {
    type: "group" as const,
    bookingId: null,
    groupId: group.id,
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    totalCAD,
    subtotalCAD,
    taxCAD,
    lockExpiresInSeconds: SLOT_LOCK_TTL,
  };
}

// ─── Get group booking ────────────────────────────────────────────────────────

export async function getGroupBooking(userId: string, groupId: string) {
  const group = await prisma.bookingGroup.findFirst({
    where: { id: groupId, userId },
    include: {
      bookings: {
        include: {
          slot: { include: { court: true } },
        },
      },
      facility: { include: { address: true } },
      payments: true,
    },
  });
  if (!group) throw appError("Booking group not found", 404);

  return {
    ...group,
    totalCAD: Number(group.totalCAD),
    subtotalCAD: Number(group.subtotalCAD),
    taxCAD: Number(group.taxCAD),
    bookings: group.bookings.map((b) => ({
      ...b,
      subtotalCAD: Number(b.subtotalCAD),
      taxCAD: Number(b.taxCAD),
      totalCAD: Number(b.totalCAD),
      slot: { ...b.slot, priceCAD: Number(b.slot.priceCAD) },
    })),
  };
}

// ─── Log share ────────────────────────────────────────────────────────────────

const SHARE_BONUS_POINTS = 50;

export async function logBookingShare(
  userId: string,
  bookingId: string,
  platform: "instagram" | "whatsapp" | "other"
) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, shareCount: true },
  });
  if (!booking) throw appError("Booking not found", 404);

  const isFirstShare = booking.shareCount === 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: Prisma.PrismaPromise<any>[] = [
    prisma.booking.update({
      where: { id: bookingId },
      data: { shareCount: { increment: 1 } },
      select: { id: true, shareCount: true },
    }),
  ];

  if (isFirstShare) {
    ops.push(
      prisma.domeCredit.create({
        data: {
          userId,
          bookingId,
          amountCAD: SHARE_BONUS_POINTS,
          reason: `Share bonus (${platform}) for booking ${bookingId}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 3_600_000),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { creditBalanceCAD: { increment: SHARE_BONUS_POINTS } },
      })
    );
  }

  await prisma.$transaction(ops);
  return { shareCount: booking.shareCount + 1, pointsAwarded: isFirstShare ? SHARE_BONUS_POINTS : 0 };
}
