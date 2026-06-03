import { BookingUnitType, SlotStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { checkAndTriggerAlerts } from "./alerts.service";

function appError(msg: string, status = 500, code?: string) {
  return Object.assign(new Error(msg), { status, code });
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function getDatesInRange(start: string, end: string, weekdays?: number[]): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (cur <= last) {
    const day = cur.getUTCDay();
    if (!weekdays || weekdays.includes(day))
      dates.push(cur.toISOString().split("T")[0]!);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCourtInput {
  name: string;
  description?: string;
  unitType?: BookingUnitType;
  unitLabel?: string;
  maxPlayers?: number;
}

export interface BulkCreateSlotsInput {
  startDate: string;
  endDate: string;
  weekdays?: number[];        // 0 = Sun … 6 = Sat; omit for every day
  startTime: string;          // HH:mm — start of the day's session
  endTime: string;            // HH:mm — end of the day's session
  slotDurationMinutes: number; // how long each bookable block is
  priceCAD: number;
}

// ─── Create court ──────────────────────────────────────────────────────────────

export async function createCourt(userId: string, facilityId: string, input: CreateCourtInput) {
  const facility = await prisma.facility.findFirst({
    where: { id: facilityId, vendor: { userId } },
    select: { id: true },
  });
  if (!facility) throw appError("Facility not found", 404);

  return prisma.court.create({
    data: {
      facilityId,
      name: input.name,
      description: input.description,
      unitType: input.unitType ?? BookingUnitType.COURT,
      unitLabel: input.unitLabel ?? input.unitType
        ? (input.unitType!.charAt(0) + input.unitType!.slice(1).toLowerCase().replace("_", " "))
        : "Court",
      maxPlayers: input.maxPlayers,
    },
  });
}

// ─── Bulk-create slots for a court ────────────────────────────────────────────

export async function bulkCreateSlots(userId: string, courtId: string, input: BulkCreateSlotsInput) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { vendor: { userId } } },
    select: { id: true, facilityId: true },
  });
  if (!court) throw appError("Court not found", 404);

  const {
    startDate, endDate, weekdays,
    startTime, endTime, slotDurationMinutes, priceCAD,
  } = input;

  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const windowMinutes = (eh! * 60 + em!) - (sh! * 60 + sm!);

  if (slotDurationMinutes <= 0)
    throw appError("slotDurationMinutes must be positive", 400);
  if (windowMinutes <= 0)
    throw appError("endTime must be after startTime", 400);
  if (windowMinutes % slotDurationMinutes !== 0)
    throw appError("slotDurationMinutes must divide the startTime–endTime window evenly", 400);

  const dates = getDatesInRange(startDate, endDate, weekdays);
  if (dates.length === 0) throw appError("Date range produced no matching days", 400);

  const rows: {
    facilityId: string;
    courtId: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    priceCAD: number;
    status: SlotStatus;
  }[] = [];

  for (const date of dates) {
    let cursor = sh! * 60 + sm!;
    const limit = eh! * 60 + em!;
    while (cursor + slotDurationMinutes <= limit) {
      const fmt = (mins: number) =>
        `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      rows.push({
        facilityId: court.facilityId,
        courtId,
        date: parseDate(date),
        startTime: fmt(cursor),
        endTime: fmt(cursor + slotDurationMinutes),
        durationMinutes: slotDurationMinutes,
        priceCAD,
        status: SlotStatus.AVAILABLE,
      });
      cursor += slotDurationMinutes;
    }
  }

  const result = await prisma.slot.createMany({ data: rows, skipDuplicates: true });

  // Fire availability alerts for every newly created slot (non-blocking)
  if (result.count > 0) {
    const uniqueWindows = [
      ...new Map(
        rows.map((r) => [`${r.date.toISOString().split("T")[0]}-${r.startTime}-${r.endTime}`, r])
      ).values(),
    ];
    for (const row of uniqueWindows) {
      checkAndTriggerAlerts(
        court.facilityId,
        courtId,
        row.date,
        row.startTime,
        row.endTime
      ).catch((err) => console.error("[Alerts] checkAndTriggerAlerts failed:", err));
    }
  }

  return {
    created: result.count,
    skipped: rows.length - result.count,
    total: rows.length,
  };
}
