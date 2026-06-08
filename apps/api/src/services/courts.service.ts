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
  isShared?: boolean;
  sports?: string[];
  primarySport?: string;
}

export interface BulkCreateSlotsInput {
  startDate: string;
  endDate: string;
  weekdays?: number[];        // 0 = Sun … 6 = Sat; omit for every day
  startTime: string;          // HH:mm — start of the day's session
  endTime: string;            // HH:mm — end of the day's session
  slotDurationMinutes: number;
  priceCAD: number;
  sport?: string;             // which sport these slots are for (shared courts)
}

export interface UpdateCourtSharedInput {
  isShared: boolean;
  sports?: string[];
  primarySport?: string;
  sportPricing?: { sport: string; priceCAD: number }[];
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
      isShared: input.isShared ?? false,
      sports: input.sports ?? [],
      primarySport: input.primarySport,
    },
  });
}

// ─── Update shared court settings ─────────────────────────────────────────────

export async function updateCourtShared(
  userId: string,
  courtId: string,
  input: UpdateCourtSharedInput
) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { vendor: { userId } } },
    select: { id: true },
  });
  if (!court) throw appError("Court not found", 404);

  const updated = await prisma.court.update({
    where: { id: courtId },
    data: {
      isShared: input.isShared,
      sports: input.sports ?? [],
      primarySport: input.primarySport,
    },
  });

  if (input.sportPricing && input.sportPricing.length > 0) {
    await upsertSportPricing(userId, courtId, input.sportPricing);
  }

  return updated;
}

// ─── Upsert sport pricing ──────────────────────────────────────────────────────

export async function upsertSportPricing(
  userId: string,
  courtId: string,
  pricing: { sport: string; priceCAD: number }[]
) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { vendor: { userId } } },
    select: { id: true },
  });
  if (!court) throw appError("Court not found", 404);

  await Promise.all(
    pricing.map((p) =>
      prisma.courtSportPricing.upsert({
        where: { courtId_sport: { courtId, sport: p.sport.toUpperCase() } },
        create: { courtId, sport: p.sport.toUpperCase(), priceCAD: p.priceCAD },
        update: { priceCAD: p.priceCAD },
      })
    )
  );

  return prisma.courtSportPricing.findMany({ where: { courtId } });
}

// ─── Bulk-create slots for a court ────────────────────────────────────────────

export async function bulkCreateSlots(userId: string, courtId: string, input: BulkCreateSlotsInput) {
  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { vendor: { userId } } },
    select: { id: true, facilityId: true, isShared: true, sports: true },
  });
  if (!court) throw appError("Court not found", 404);

  const {
    startDate, endDate, weekdays,
    startTime, endTime, slotDurationMinutes, priceCAD,
    sport,
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

  // For shared courts, determine which sports to generate
  const sportsToGenerate: { sport: string; price: number }[] = [];

  if (court.isShared && court.sports.length > 0) {
    // Load sport-specific pricing
    const sportPricingRows = await prisma.courtSportPricing.findMany({
      where: { courtId },
    });
    const sportPriceMap = new Map(sportPricingRows.map((r) => [r.sport, Number(r.priceCAD)]));

    const targetSport = sport?.toUpperCase();
    if (targetSport && !court.sports.includes(targetSport)) {
      throw appError(`Sport ${targetSport} is not configured on this court`, 400);
    }

    const sportsToCreate = targetSport ? [targetSport] : court.sports;
    for (const s of sportsToCreate) {
      sportsToGenerate.push({ sport: s, price: sportPriceMap.get(s) ?? priceCAD });
    }
  } else {
    // Non-shared court: single sport slot
    sportsToGenerate.push({ sport: sport?.toUpperCase() ?? "", price: priceCAD });
  }

  type SlotRow = {
    facilityId: string;
    courtId: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    priceCAD: number;
    status: SlotStatus;
    sport: string | null;
    linkedSlotIds: string[];
  };

  // Build rows per sport (we'll link them after creation)
  let totalCreated = 0;
  let totalSkipped = 0;

  if (sportsToGenerate.length === 1) {
    // Simple case: one sport — no linking needed
    const { sport: slotSport, price } = sportsToGenerate[0]!;
    const rows: SlotRow[] = [];

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
          priceCAD: price,
          status: SlotStatus.AVAILABLE,
          sport: slotSport || null,
          linkedSlotIds: [],
        });
        cursor += slotDurationMinutes;
      }
    }

    const result = await prisma.slot.createMany({ data: rows, skipDuplicates: true });
    totalCreated = result.count;
    totalSkipped = rows.length - result.count;

    if (result.count > 0) {
      const uniqueWindows = [
        ...new Map(
          rows.map((r) => [`${r.date.toISOString().split("T")[0]}-${r.startTime}-${r.endTime}`, r])
        ).values(),
      ];
      for (const row of uniqueWindows) {
        checkAndTriggerAlerts(
          court.facilityId, courtId, row.date, row.startTime, row.endTime
        ).catch((err) => console.error("[Alerts] checkAndTriggerAlerts failed:", err));
      }
    }
  } else {
    // Multiple sports — create slots and then link them
    // We need to track created slot IDs per (date, startTime) to set linkedSlotIds
    for (const date of dates) {
      let cursor = sh! * 60 + sm!;
      const limit = eh! * 60 + em!;

      while (cursor + slotDurationMinutes <= limit) {
        const fmt = (mins: number) =>
          `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
        const slotStartTime = fmt(cursor);
        const slotEndTime = fmt(cursor + slotDurationMinutes);
        const slotDate = parseDate(date);

        // Create slots for all sports at this time window (skip existing)
        const createdIds: string[] = [];
        for (const { sport: slotSport, price } of sportsToGenerate) {
          // Check if slot already exists
          const existing = await prisma.slot.findFirst({
            where: {
              courtId,
              date: slotDate,
              startTime: slotStartTime,
              sport: slotSport || null,
            },
            select: { id: true },
          });

          if (existing) {
            createdIds.push(existing.id);
            totalSkipped++;
          } else {
            const created = await prisma.slot.create({
              data: {
                facilityId: court.facilityId,
                courtId,
                date: slotDate,
                startTime: slotStartTime,
                endTime: slotEndTime,
                durationMinutes: slotDurationMinutes,
                priceCAD: price,
                status: SlotStatus.AVAILABLE,
                sport: slotSport || null,
                linkedSlotIds: [],
              },
            });
            createdIds.push(created.id);
            totalCreated++;
          }
        }

        // Link all slots for this time window to each other
        if (createdIds.length > 1) {
          for (const id of createdIds) {
            const otherIds = createdIds.filter((otherId) => otherId !== id);
            await prisma.slot.update({
              where: { id },
              data: { linkedSlotIds: otherIds },
            });
          }
        }

        cursor += slotDurationMinutes;
      }
    }

    // Fire availability alerts
    const sampleRows = getDatesInRange(startDate, endDate, weekdays).flatMap((date) => {
      const slots = [];
      let cursor = sh! * 60 + sm!;
      const limit = eh! * 60 + em!;
      const fmt = (mins: number) =>
        `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
      while (cursor + slotDurationMinutes <= limit) {
        slots.push({ date: parseDate(date), startTime: fmt(cursor), endTime: fmt(cursor + slotDurationMinutes) });
        cursor += slotDurationMinutes;
      }
      return slots;
    });
    for (const row of sampleRows) {
      checkAndTriggerAlerts(
        court.facilityId, courtId, row.date, row.startTime, row.endTime
      ).catch((err) => console.error("[Alerts] checkAndTriggerAlerts failed:", err));
    }
  }

  return {
    created: totalCreated,
    skipped: totalSkipped,
    total: totalCreated + totalSkipped,
  };
}
