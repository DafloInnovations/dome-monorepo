import {
  BookingPaymentStatus,
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  RecurringFrequency,
  RecurringPaymentModel,
  RecurringSeriesStatus,
  SlotStatus,
  type Province,
} from "@prisma/client";
import { calculateTax } from "@dome/utils";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { stripe } from "../lib/stripe";
import { sendPushNotification, saveNotification } from "../lib/firebase";
import { sendRecurringSeriesConfirmation } from "../lib/email";

const SLOT_LOCK_TTL = 300;

function appError(msg: string, status = 400, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// ─── Occurrence calculation ───────────────────────────────────────────────────

export function calculateOccurrences(
  startDate: Date,
  endDate: Date,
  frequency: RecurringFrequency,
  daysOfWeek: number[]
): Date[] {
  const dates: Date[] = [];
  const days = daysOfWeek.length > 0 ? daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
  const stepMs = frequency === RecurringFrequency.BIWEEKLY ? 14 * 86_400_000 : 7 * 86_400_000;

  if (frequency === RecurringFrequency.MONTHLY) {
    // Same day-of-month each month
    let cur = new Date(startDate);
    while (cur <= endDate) {
      if (days.includes(cur.getUTCDay())) dates.push(new Date(cur));
      // Advance to same date next month
      const nextMonth = new Date(cur);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      cur = nextMonth;
    }
  } else {
    // WEEKLY or BIWEEKLY — for each requested day find first occurrence then step
    for (const day of days) {
      const diff = (day - startDate.getUTCDay() + 7) % 7;
      let cur = new Date(startDate.getTime() + diff * 86_400_000);
      while (cur <= endDate) {
        dates.push(new Date(cur));
        cur = new Date(cur.getTime() + stepMs);
      }
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
  }

  return dates;
}

// ─── Discount logic ──────────────────────────────────────────────────────────

export function getDiscountPercent(occurrences: number, model: RecurringPaymentModel): number {
  if (model !== RecurringPaymentModel.PAY_UPFRONT) return 0;
  if (occurrences >= 12) return 15;
  if (occurrences >= 8) return 10;
  if (occurrences >= 4) return 5;
  return 0;
}

// ─── Slot finder for a single occurrence ─────────────────────────────────────

async function findCoveringSlots(courtId: string, date: Date, startTime: string, endTime: string) {
  const slots = await prisma.slot.findMany({
    where: { courtId, date, startTime: { gte: startTime }, endTime: { lte: endTime } },
    orderBy: { startTime: "asc" },
    select: { id: true, startTime: true, endTime: true, priceCAD: true, status: true },
  });

  // Verify continuous coverage
  let cursor = startTime;
  let covered = slots.length > 0;
  for (const s of slots) {
    if (s.startTime !== cursor) { covered = false; break; }
    cursor = s.endTime;
  }
  if (cursor !== endTime) covered = false;
  return { slots, isCovered: covered };
}

// ─── Create recurring series ──────────────────────────────────────────────────

export interface CreateRecurringInput {
  userId: string;
  facilityId: string;
  courtId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  durationMinutes: number;
  frequency: RecurringFrequency;
  daysOfWeek: number[];
  paymentModel: RecurringPaymentModel;
}

export async function createRecurringSeries(input: CreateRecurringInput) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { province: true, phone: true } });
  if (!user) throw appError("User not found", 404);

  const court = await prisma.court.findFirst({
    where: { id: input.courtId, facilityId: input.facilityId, isActive: true },
  });
  if (!court) throw appError("Court not found", 404);

  const startDate = parseLocalDate(input.startDate);
  const endDate   = parseLocalDate(input.endDate);
  if (endDate <= startDate) throw appError("endDate must be after startDate");

  const endTime = addMins(input.startTime, input.durationMinutes);
  const occurrenceDates = calculateOccurrences(startDate, endDate, input.frequency, input.daysOfWeek);
  if (occurrenceDates.length === 0) throw appError("No occurrences found for the given schedule");

  // Validate slot availability for all occurrences
  const occurrenceSlots: Array<{ date: Date; dateStr: string; slotIds: string[]; priceCAD: number }> = [];
  for (const date of occurrenceDates) {
    const { slots, isCovered } = await findCoveringSlots(court.id, date, input.startTime, endTime);
    if (!isCovered) throw appError(`No slots covering ${toDateStr(date)} ${input.startTime}–${endTime}`);
    const unavailable = slots.find((s) => s.status !== SlotStatus.AVAILABLE);
    if (unavailable) throw appError(`Slot on ${toDateStr(date)} at ${unavailable.startTime} is not available (${unavailable.status})`);
    occurrenceSlots.push({
      date,
      dateStr: toDateStr(date),
      slotIds: slots.map((s) => s.id),
      priceCAD: slots.reduce((sum, s) => sum + Number(s.priceCAD), 0),
    });
  }

  const pricePerSession = occurrenceSlots[0]!.priceCAD;
  const discount = getDiscountPercent(occurrenceSlots.length, input.paymentModel);
  const subtotalCAD = occurrenceSlots.reduce((s, o) => s + o.priceCAD, 0);
  const discountCAD = Math.round(subtotalCAD * (discount / 100) * 100) / 100;
  const discountedSubtotal = Math.round((subtotalCAD - discountCAD) * 100) / 100;
  const taxCAD = calculateTax(discountedSubtotal, user.province as Province);
  const totalCAD = Math.round((discountedSubtotal + taxCAD) * 100) / 100;

  // ── PAY_UPFRONT ──────────────────────────────────────────────────────────
  if (input.paymentModel === RecurringPaymentModel.PAY_UPFRONT) {
    // Create series + all bookings in transaction
    const series = await prisma.recurringSeries.create({
      data: {
        userId: input.userId,
        facilityId: input.facilityId,
        courtId: input.courtId,
        startDate,
        endDate,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        frequency: input.frequency,
        daysOfWeek: input.daysOfWeek,
        totalOccurrences: occurrenceSlots.length,
        pricePerSessionCAD: pricePerSession,
        discountPercent: discount,
        paymentModel: input.paymentModel,
      },
    });

    // Create all bookings in PENDING state (no Redis lock — series locks intent)
    const bookings = await prisma.$transaction(
      occurrenceSlots.map((occ, idx) =>
        prisma.booking.create({
          data: {
            slotId: occ.slotIds[0]!, // first slot of window
            facilityId: input.facilityId,
            userId: input.userId,
            recurringSeriesId: series.id,
            recurringSeriesIndex: idx + 1,
            status: BookingStatus.PENDING,
            paymentStatus: BookingPaymentStatus.UNPAID,
            subtotalCAD: occ.priceCAD,
            taxCAD: calculateTax(occ.priceCAD * (1 - discount / 100), user.province as Province),
            totalCAD: Math.round(occ.priceCAD * (1 - discount / 100) * 100) / 100,
            taxProvince: user.province,
          },
        })
      )
    );

    // Also hold slots for multi-slot windows
    for (const occ of occurrenceSlots) {
      if (occ.slotIds.length > 1) {
        await prisma.slot.updateMany({ where: { id: { in: occ.slotIds } }, data: { status: SlotStatus.HELD } });
      } else {
        await prisma.slot.update({ where: { id: occ.slotIds[0]! }, data: { status: SlotStatus.HELD } });
      }
    }

    const pi = await stripe.paymentIntents.create({
      amount: Math.round(totalCAD * 100),
      currency: "cad",
      metadata: { recurringSeriesId: series.id, userId: input.userId, type: "recurring_upfront" },
      setup_future_usage: "off_session",
    });

    await prisma.recurringSeries.update({ where: { id: series.id }, data: { paymentIntentId: pi.id } });

    return {
      series,
      occurrences: occurrenceSlots.map((o) => o.dateStr),
      pricePerSessionCAD: pricePerSession,
      discountPercent: discount,
      subtotalCAD,
      discountCAD,
      taxCAD,
      totalCAD,
      savedCAD: discountCAD,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      firstBookingId: bookings[0]!.id,
      paymentModel: input.paymentModel,
    };
  }

  // ── PAY_PER_SESSION ──────────────────────────────────────────────────────
  const first = occurrenceSlots[0]!;

  // Acquire Redis lock on first slot(s)
  const lockResults = await Promise.all(
    first.slotIds.map((id) => redis.set(`slot:${id}:lock`, input.userId, "EX", SLOT_LOCK_TTL, "NX"))
  );
  if (lockResults.some((r) => r !== "OK")) {
    const toRelease = first.slotIds.filter((_, i) => lockResults[i] === "OK");
    if (toRelease.length) await redis.del(...toRelease.map((id) => `slot:${id}:lock`));
    throw appError("First slot is currently held. Try again shortly.", 409, "SLOT_LOCKED");
  }

  // Create Stripe Customer
  const customer = await stripe.customers.create({ phone: user.phone, metadata: { userId: input.userId } });

  const series = await prisma.recurringSeries.create({
    data: {
      userId: input.userId,
      facilityId: input.facilityId,
      courtId: input.courtId,
      startDate,
      endDate,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      frequency: input.frequency,
      daysOfWeek: input.daysOfWeek,
      totalOccurrences: occurrenceSlots.length,
      pricePerSessionCAD: pricePerSession,
      discountPercent: 0,
      paymentModel: input.paymentModel,
      stripeCustomerId: customer.id,
    },
  });

  const firstBookingSubtotal = first.priceCAD;
  const firstBookingTax = calculateTax(firstBookingSubtotal, user.province as Province);
  const firstBookingTotal = Math.round((firstBookingSubtotal + firstBookingTax) * 100) / 100;

  const firstBooking = await prisma.booking.create({
    data: {
      slotId: first.slotIds[0]!,
      facilityId: input.facilityId,
      userId: input.userId,
      recurringSeriesId: series.id,
      recurringSeriesIndex: 1,
      status: BookingStatus.PENDING,
      paymentStatus: BookingPaymentStatus.UNPAID,
      subtotalCAD: firstBookingSubtotal,
      taxCAD: firstBookingTax,
      totalCAD: firstBookingTotal,
      taxProvince: user.province,
    },
  });

  const pi = await stripe.paymentIntents.create({
    amount: Math.round(firstBookingTotal * 100),
    currency: "cad",
    customer: customer.id,
    setup_future_usage: "off_session",
    metadata: { bookingId: firstBooking.id, recurringSeriesId: series.id, userId: input.userId, type: "recurring_first" },
  });

  return {
    series,
    occurrences: occurrenceSlots.map((o) => o.dateStr),
    pricePerSessionCAD: pricePerSession,
    discountPercent: 0,
    subtotalCAD: firstBookingSubtotal,
    discountCAD: 0,
    taxCAD: firstBookingTax,
    totalCAD: firstBookingTotal,
    savedCAD: 0,
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    firstBookingId: firstBooking.id,
    paymentModel: input.paymentModel,
  };
}

// ─── Confirm recurring series payment ────────────────────────────────────────

export async function confirmRecurringSeries(userId: string, seriesId: string, paymentIntentId: string) {
  const series = await prisma.recurringSeries.findFirst({
    where: { id: seriesId, userId },
    include: { bookings: { include: { slot: true } } },
  });
  if (!series) throw appError("Series not found", 404);

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== "succeeded") throw appError("Payment has not succeeded", 402);

  if (series.paymentModel === RecurringPaymentModel.PAY_UPFRONT) {
    // Confirm all pending bookings
    const bookingIds = series.bookings.map((b) => b.id);
    const slotIds = [...new Set(series.bookings.map((b) => b.slotId))];

    await prisma.$transaction([
      prisma.booking.updateMany({ where: { id: { in: bookingIds } }, data: { status: BookingStatus.CONFIRMED, paymentStatus: BookingPaymentStatus.PAID } }),
      prisma.slot.updateMany({ where: { id: { in: slotIds } }, data: { status: SlotStatus.BOOKED } }),
      prisma.recurringSeries.update({ where: { id: seriesId }, data: { paymentIntentId: pi.id } }),
    ]);

    await prisma.payment.create({
      data: {
        userId,
        amountCAD: pi.amount / 100,
        taxCAD: series.bookings.reduce((s, b) => s + Number(b.taxCAD), 0),
        method: PaymentMethod.CARD,
        gatewayPaymentId: pi.id,
        status: PaymentStatus.SUCCEEDED,
      },
    });
  } else {
    // PAY_PER_SESSION — confirm first booking and save payment method
    const firstBooking = series.bookings.find((b) => b.recurringSeriesIndex === 1);
    if (!firstBooking) throw appError("First booking not found", 404);

    // Extract saved payment method from intent
    const paymentMethod = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;

    await prisma.$transaction([
      prisma.booking.update({ where: { id: firstBooking.id }, data: { status: BookingStatus.CONFIRMED, paymentStatus: BookingPaymentStatus.PAID } }),
      prisma.slot.update({ where: { id: firstBooking.slotId }, data: { status: SlotStatus.BOOKED } }),
      prisma.recurringSeries.update({
        where: { id: seriesId },
        data: { stripePaymentMethodId: paymentMethod ?? null },
      }),
    ]);

    if (paymentMethod && series.stripeCustomerId) {
      await stripe.paymentMethods.attach(paymentMethod, { customer: series.stripeCustomerId }).catch(() => null);
    }

    await prisma.payment.create({
      data: {
        bookingId: firstBooking.id,
        userId,
        amountCAD: pi.amount / 100,
        taxCAD: Number(firstBooking.taxCAD),
        method: PaymentMethod.CARD,
        gatewayPaymentId: pi.id,
        status: PaymentStatus.SUCCEEDED,
      },
    });

    if (series.stripeCustomerId) await redis.del(...firstBooking.slotId ? [`slot:${firstBooking.slotId}:lock`] : []);
  }

  // Notify user
  const userForNotif = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceToken: true, email: true, emailBookingConfirmation: true },
  });
  const title = "Recurring booking confirmed 🔄";
  const body = `${series.totalOccurrences} sessions booked starting ${toDateStr(series.startDate)} at ${series.startTime}`;
  await saveNotification(userId, "BOOKING_CONFIRMED", title, body, { type: "recurring_confirmed", seriesId });
  if (userForNotif?.deviceToken) await sendPushNotification(userForNotif.deviceToken, title, body, { seriesId });

  // Email
  if (userForNotif?.email && userForNotif.emailBookingConfirmation) {
    const facilityData = await prisma.facility.findUnique({
      where: { id: series.facilityId },
      select: { name: true, sport: true },
    });
    const court = await prisma.court.findUnique({
      where: { id: series.courtId },
      select: { name: true },
    });
    const endTime = addMins(series.startTime, series.durationMinutes);
    const upcomingDates = series.bookings
      .map((b) => {
        const d = b.slot.date instanceof Date ? b.slot.date : new Date(b.slot.date);
        return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
      })
      .slice(0, 8);

    sendRecurringSeriesConfirmation(userForNotif.email, {
      facilityName: facilityData?.name ?? "Facility",
      sport: facilityData?.sport ?? "",
      courtName: court?.name ?? "Court",
      startTime: series.startTime,
      endTime,
      frequency: series.frequency,
      upcomingDates,
      paymentModel: series.paymentModel,
      totalCAD: series.bookings.reduce((s, b) => s + Number(b.totalCAD), 0),
      discountPercent: series.discountPercent ?? 0,
      totalSessions: series.totalOccurrences,
    }).catch(() => null);
  }

  return prisma.recurringSeries.findUnique({ where: { id: seriesId }, include: { bookings: { include: { slot: true } } } });
}

// ─── Cancel recurring series ──────────────────────────────────────────────────

export async function cancelRecurringSeries(userId: string, seriesId: string, cancelFrom: string, reason?: string) {
  const series = await prisma.recurringSeries.findFirst({
    where: { id: seriesId, userId },
    include: {
      bookings: { include: { slot: true, payment: true }, orderBy: { recurringSeriesIndex: "asc" } },
    },
  });
  if (!series) throw appError("Series not found", 404);
  if (series.status === RecurringSeriesStatus.CANCELLED) throw appError("Series already cancelled");

  const cutoff = cancelFrom === "NOW" ? new Date() : parseLocalDate(cancelFrom);

  const futurePending = series.bookings.filter((b) =>
    (b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED) &&
    new Date(b.slot.date) >= cutoff
  );

  const slotIds = futurePending.map((b) => b.slotId);
  const bookingIds = futurePending.map((b) => b.id);

  let refundedCAD = 0;
  if (series.paymentModel === RecurringPaymentModel.PAY_UPFRONT && series.paymentIntentId) {
    const refundAmount = futurePending.reduce((s, b) => s + Number(b.totalCAD), 0);
    if (refundAmount > 0) {
      await stripe.refunds.create({ payment_intent: series.paymentIntentId, amount: Math.round(refundAmount * 100) });
      refundedCAD = refundAmount;
    }
  } else if (series.paymentModel === RecurringPaymentModel.PAY_PER_SESSION) {
    // Issue Dome credits for future confirmed sessions that were paid
    const creditAmount = futurePending
      .filter((b) => b.status === BookingStatus.CONFIRMED && b.payment)
      .reduce((s, b) => s + Number(b.totalCAD), 0);
    if (creditAmount > 0) {
      await prisma.$transaction([
        prisma.domeCredit.create({ data: { userId, amountCAD: creditAmount, reason: `Recurring series ${seriesId} cancellation`, expiresAt: new Date(Date.now() + 365 * 86_400_000) } }),
        prisma.user.update({ where: { id: userId }, data: { creditBalanceCAD: { increment: creditAmount } } }),
      ]);
    }
  }

  const remaining = series.totalOccurrences - futurePending.length;
  const newStatus = remaining === 0 ? RecurringSeriesStatus.CANCELLED : RecurringSeriesStatus.CANCELLED;

  await prisma.$transaction([
    prisma.booking.updateMany({ where: { id: { in: bookingIds } }, data: { status: BookingStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason } }),
    prisma.slot.updateMany({ where: { id: { in: slotIds } }, data: { status: SlotStatus.AVAILABLE } }),
    prisma.recurringSeries.update({ where: { id: seriesId }, data: { status: newStatus, cancelledOccurrences: { increment: futurePending.length } } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deviceToken: true } });
  const title = "Recurring series cancelled";
  const notifBody = refundedCAD > 0
    ? `Refund of C$${refundedCAD.toFixed(2)} initiated for remaining sessions.`
    : `${futurePending.length} upcoming sessions cancelled.`;
  await saveNotification(userId, "BOOKING_CANCELLED", title, notifBody, { type: "recurring_cancelled", seriesId });
  if (user?.deviceToken) await sendPushNotification(user.deviceToken, title, notifBody, { seriesId });

  return { cancelledCount: futurePending.length, refundedCAD };
}

// ─── Pause recurring series ───────────────────────────────────────────────────

export async function pauseRecurringSeries(userId: string, seriesId: string, pauseUntil: string) {
  const series = await prisma.recurringSeries.findFirst({ where: { id: seriesId, userId, status: RecurringSeriesStatus.ACTIVE } });
  if (!series) throw appError("Active series not found", 404);
  await prisma.recurringSeries.update({ where: { id: seriesId }, data: { status: RecurringSeriesStatus.PAUSED } });
  return { pausedUntil: pauseUntil };
}

// ─── Get user's recurring series ─────────────────────────────────────────────

export async function getMyRecurringSeries(userId: string) {
  const series = await prisma.recurringSeries.findMany({
    where: { userId },
    include: {
      facility: { include: { address: true } },
      court: { select: { id: true, name: true, unitLabel: true } },
      bookings: {
        include: { slot: true },
        orderBy: { recurringSeriesIndex: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return series.map((s) => {
    const future = s.bookings.filter((b) => b.status === BookingStatus.CONFIRMED && new Date(b.slot.date) >= new Date());
    const next = future[0];
    return {
      ...s,
      pricePerSessionCAD: Number(s.pricePerSessionCAD),
      nextOccurrence: next ? toDateStr(next.slot.date) : null,
      remainingSessions: future.length,
      totalPaidCAD: s.bookings.filter((b) => b.paymentStatus === BookingPaymentStatus.PAID).reduce((sum, b) => sum + Number(b.totalCAD), 0),
      bookings: s.bookings.map((b) => ({ ...b, totalCAD: Number(b.totalCAD), slot: { ...b.slot, priceCAD: Number(b.slot.priceCAD) } })),
    };
  });
}

// ─── Cron: process upcoming PAY_PER_SESSION bookings ─────────────────────────

export async function processUpcomingRecurringBookings(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const dayAfter = new Date(tomorrow.getTime() + 86_400_000);

  const activeSeries = await prisma.recurringSeries.findMany({
    where: {
      status: RecurringSeriesStatus.ACTIVE,
      paymentModel: RecurringPaymentModel.PAY_PER_SESSION,
      stripeCustomerId: { not: null },
      stripePaymentMethodId: { not: null },
    },
    include: {
      user: { select: { id: true, province: true, deviceToken: true } },
      court: true,
    },
  });

  for (const series of activeSeries) {
    // Check if tomorrow is a scheduled day for this series
    const tomorrowDay = tomorrow.getUTCDay();
    if (!series.daysOfWeek.includes(tomorrowDay)) continue;
    if (tomorrow < series.startDate || tomorrow > series.endDate) continue;

    // Check if booking already exists for tomorrow
    const existing = await prisma.booking.findFirst({
      where: { recurringSeriesId: series.id, slot: { date: { gte: tomorrow, lt: dayAfter } } },
    });
    if (existing) continue;

    const endTime = addMins(series.startTime, series.durationMinutes);
    const { slots, isCovered } = await findCoveringSlots(series.courtId, tomorrow, series.startTime, endTime);
    if (!isCovered) {
      console.error(`[Recurring] No slots for series ${series.id} on ${toDateStr(tomorrow)}`);
      continue;
    }

    const slotIds = slots.map((s) => s.id);
    const lockResults = await Promise.all(slotIds.map((id) => redis.set(`slot:${id}:lock`, series.userId, "EX", SLOT_LOCK_TTL, "NX")));
    if (lockResults.some((r) => r !== "OK")) {
      console.error(`[Recurring] Slot locked for series ${series.id} on ${toDateStr(tomorrow)}`);
      continue;
    }

    const subtotalCAD = slots.reduce((sum, s) => sum + Number(s.priceCAD), 0);
    const taxCAD = calculateTax(subtotalCAD, series.user.province as Province);
    const totalCAD = Math.round((subtotalCAD + taxCAD) * 100) / 100;

    const seriesIndex = (await prisma.booking.count({ where: { recurringSeriesId: series.id } })) + 1;

    const booking = await prisma.booking.create({
      data: {
        slotId: slotIds[0]!,
        facilityId: series.facilityId,
        userId: series.userId,
        recurringSeriesId: series.id,
        recurringSeriesIndex: seriesIndex,
        status: BookingStatus.PENDING,
        paymentStatus: BookingPaymentStatus.UNPAID,
        subtotalCAD,
        taxCAD,
        totalCAD,
        taxProvince: series.user.province,
      },
    });

    try {
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(totalCAD * 100),
        currency: "cad",
        customer: series.stripeCustomerId!,
        payment_method: series.stripePaymentMethodId!,
        confirm: true,
        off_session: true,
        metadata: { bookingId: booking.id, recurringSeriesId: series.id, userId: series.userId },
      });

      if (pi.status === "succeeded") {
        await prisma.$transaction([
          prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED, paymentStatus: BookingPaymentStatus.PAID } }),
          prisma.slot.updateMany({ where: { id: { in: slotIds } }, data: { status: SlotStatus.BOOKED } }),
          prisma.recurringSeries.update({ where: { id: series.id }, data: { completedOccurrences: { increment: 1 } } }),
        ]);
        await prisma.payment.create({ data: { bookingId: booking.id, userId: series.userId, amountCAD: pi.amount / 100, taxCAD, method: PaymentMethod.CARD, gatewayPaymentId: pi.id, status: PaymentStatus.SUCCEEDED } });

        const chargeTitle = "Recurring session booked";
        const chargeBody = `C$${totalCAD.toFixed(2)} charged for ${toDateStr(tomorrow)} at ${series.startTime}`;
        await saveNotification(series.userId, "BOOKING_CONFIRMED", chargeTitle, chargeBody, { type: "recurring_charge", seriesId: series.id });
        if (series.user.deviceToken) await sendPushNotification(series.user.deviceToken, chargeTitle, chargeBody, { seriesId: series.id });
      }
    } catch (err) {
      // Payment failed
      await prisma.recurringSeries.update({ where: { id: series.id }, data: { status: RecurringSeriesStatus.PAUSED } });
      await redis.del(...slotIds.map((id) => `slot:${id}:lock`));
      const failTitle = "Payment failed — update your card";
      const failBody = `We couldn't charge your card for your recurring court session on ${toDateStr(tomorrow)}.`;
      await saveNotification(series.userId, "BOOKING_CANCELLED", failTitle, failBody, { type: "recurring_payment_failed", seriesId: series.id });
      if (series.user.deviceToken) await sendPushNotification(series.user.deviceToken, failTitle, failBody, { seriesId: series.id });
    }

    // Check if series ends within 7 days → renewal reminder
    const sevenDaysFromNow = new Date(Date.now() + 7 * 86_400_000);
    if (series.endDate <= sevenDaysFromNow && series.endDate > tomorrow) {
      const renewTitle = "Your recurring series ends in 7 days";
      const renewBody = "Tap to renew your court sessions and keep your spot.";
      await saveNotification(series.userId, "BOOKING_CONFIRMED", renewTitle, renewBody, { type: "recurring_expiry_soon", seriesId: series.id });
      if (series.user.deviceToken) await sendPushNotification(series.user.deviceToken, renewTitle, renewBody, { seriesId: series.id });
    }
  }
}
