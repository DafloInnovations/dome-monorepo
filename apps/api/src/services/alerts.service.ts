import { AlertStatus, SlotStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";
import { sendSms } from "../lib/twilio";
import { sendAvailabilityAlert } from "../lib/email";

const MAX_ALERTS_PER_USER = 10;

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

function formatDateLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

// ─── Create alert ─────────────────────────────────────────────────────────────

export async function createAlert(
  userId: string,
  data: {
    facilityId: string;
    courtId?: string | null;
    sport?: string | null;
    date: string;          // "2026-06-07"
    startTime: string;     // "18:00"
    endTime: string;       // "19:00"
    durationMinutes: number;
  }
) {
  // Max 10 active alerts per user
  const pendingCount = await prisma.availabilityAlert.count({
    where: { userId, status: AlertStatus.PENDING },
  });
  if (pendingCount >= MAX_ALERTS_PER_USER) {
    throw appError(`Maximum ${MAX_ALERTS_PER_USER} active alerts allowed`, 400, "ALERT_LIMIT");
  }

  const dateObj = new Date(data.date + "T00:00:00.000Z");
  const expiresAt = new Date(data.date + "T" + data.endTime + ":00.000Z");

  if (expiresAt <= new Date()) {
    throw appError("Cannot set an alert for a time that has already passed", 400, "ALERT_EXPIRED");
  }

  try {
    const alert = await prisma.availabilityAlert.create({
      data: {
        userId,
        facilityId: data.facilityId,
        courtId: data.courtId ?? null,
        sport: data.sport ?? null,
        date: dateObj,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        expiresAt,
      },
      include: {
        facility: { select: { id: true, name: true, sport: true } },
        court: { select: { id: true, name: true } },
      },
    });
    return alert;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw appError("You already have an alert set for this time slot", 409, "ALERT_DUPLICATE");
    }
    throw err;
  }
}

// ─── Check and trigger matching alerts ───────────────────────────────────────
// Called whenever a slot becomes available (cancellation, new slots, unblock).

export async function checkAndTriggerAlerts(
  facilityId: string,
  courtId: string | null,
  date: Date | string,
  startTime: string,
  endTime: string
): Promise<void> {
  const dateObj = typeof date === "string" ? new Date(date + "T00:00:00.000Z") : date;
  const now = new Date();

  // Find all PENDING alerts for this facility + date with overlapping time window
  const alerts = await prisma.availabilityAlert.findMany({
    where: {
      facilityId,
      status: AlertStatus.PENDING,
      expiresAt: { gt: now },
      date: dateObj,
      // Alert's window overlaps with the slot's window if: alert.startTime < slot.endTime AND alert.endTime > slot.startTime
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(courtId ? { OR: [{ courtId }, { courtId: null }] } : {}),
    },
    include: {
      user: { select: { id: true, deviceToken: true, phone: true, email: true, emailReminders: true } },
      facility: { select: { name: true, sport: true } },
      court: { select: { name: true } },
    },
  });

  if (alerts.length === 0) return;

  // Verify a slot is actually available now (prevents false triggers)
  const availableSlot = await prisma.slot.findFirst({
    where: {
      facilityId,
      ...(courtId ? { courtId } : {}),
      date: dateObj,
      startTime,
      endTime,
      status: SlotStatus.AVAILABLE,
    },
  });
  if (!availableSlot) return;

  for (const alert of alerts) {
    const sportLabel =
      alert.sport
        ? alert.sport.charAt(0).toUpperCase() + alert.sport.slice(1).toLowerCase()
        : alert.facility.sport.charAt(0).toUpperCase() + alert.facility.sport.slice(1).toLowerCase();

    const dateLabel = formatDateLabel(alert.date);
    const timeLabel = formatTimeLabel(alert.startTime);

    const pushTitle = "Court Available! 🎾";
    const pushBody = `${sportLabel} at ${alert.facility.name} on ${dateLabel} at ${timeLabel} just opened up!`;
    const pushData = {
      type: "AVAILABILITY_ALERT",
      alertId: alert.id,
      facilityId,
      date: typeof date === "string" ? date : date.toISOString().split("T")[0]!,
      startTime,
    };

    // Push notification
    if (alert.user.deviceToken) {
      await sendPushNotification(alert.user.deviceToken, pushTitle, pushBody, pushData);
    }

    // In-app notification
    await saveNotification(alert.user.id, "AVAILABILITY_ALERT", pushTitle, pushBody, pushData);

    // SMS
    const smsBody =
      `Dome: Court available at ${alert.facility.name} ` +
      `${dateLabel} at ${timeLabel}. Book now before it's gone!`;
    await sendSms(alert.user.phone, smsBody);

    // Email
    if (alert.user.email && alert.user.emailReminders) {
      sendAvailabilityAlert(alert.user.email, {
        facilityName: alert.facility.name,
        sport: alert.sport ?? alert.facility.sport,
        date: dateLabel,
        startTime: formatTimeLabel(alert.startTime),
        endTime: formatTimeLabel(alert.endTime),
        facilityId: alert.facilityId,
        slotDate: typeof date === "string" ? date : date.toISOString().split("T")[0]!,
      }).catch(() => null);
    }

    // Mark as triggered
    await prisma.availabilityAlert.update({
      where: { id: alert.id },
      data: { status: AlertStatus.TRIGGERED, triggeredAt: now },
    });
  }
}

// ─── Expire old alerts ────────────────────────────────────────────────────────

export async function expireOldAlerts(): Promise<number> {
  const result = await prisma.availabilityAlert.updateMany({
    where: { status: AlertStatus.PENDING, expiresAt: { lte: new Date() } },
    data: { status: AlertStatus.EXPIRED },
  });
  return result.count;
}

// ─── Get user's alerts ────────────────────────────────────────────────────────

export async function getUserAlerts(
  userId: string,
  status?: AlertStatus
) {
  return prisma.availabilityAlert.findMany({
    where: { userId, ...(status ? { status } : {}) },
    include: {
      facility: { select: { id: true, name: true, sport: true } },
      court: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

// ─── Count pending alerts ─────────────────────────────────────────────────────

export async function getPendingAlertCount(userId: string): Promise<number> {
  return prisma.availabilityAlert.count({
    where: { userId, status: AlertStatus.PENDING },
  });
}

// ─── Cancel alert ─────────────────────────────────────────────────────────────

export async function cancelAlert(userId: string, alertId: string) {
  const alert = await prisma.availabilityAlert.findFirst({
    where: { id: alertId, userId },
  });
  if (!alert) throw appError("Alert not found", 404);
  if (alert.status !== AlertStatus.PENDING) {
    throw appError("Only pending alerts can be cancelled", 400);
  }
  return prisma.availabilityAlert.update({
    where: { id: alertId },
    data: { status: AlertStatus.CANCELLED },
  });
}
