import { DateOverrideType, PriceAdjustmentType, type PricingRule } from "@prisma/client";
import { prisma } from "../lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceBreakdown {
  basePriceCAD: number;
  finalPriceCAD: number;
  appliedRule: string | null;
  isBlocked: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

function applyAdjustment(base: number, rule: PricingRule): number {
  const v = Number(rule.adjustmentValue);
  switch (rule.adjustmentType) {
    case PriceAdjustmentType.PERCENTAGE_INCREASE:
      return base * (1 + v / 100);
    case PriceAdjustmentType.PERCENTAGE_DECREASE:
      return base * (1 - v / 100);
    case PriceAdjustmentType.FIXED_INCREASE:
      return base + v;
    case PriceAdjustmentType.FIXED_DECREASE:
      return Math.max(0, base - v);
    case PriceAdjustmentType.FIXED_PRICE:
      return v;
  }
}

function ruleLabel(rule: PricingRule): string {
  const v = Number(rule.adjustmentValue);
  switch (rule.adjustmentType) {
    case PriceAdjustmentType.PERCENTAGE_INCREASE: return `${rule.name} +${v}%`;
    case PriceAdjustmentType.PERCENTAGE_DECREASE: return `${rule.name} -${v}%`;
    case PriceAdjustmentType.FIXED_INCREASE: return `${rule.name} +C$${v.toFixed(2)}`;
    case PriceAdjustmentType.FIXED_DECREASE: return `${rule.name} -C$${v.toFixed(2)}`;
    case PriceAdjustmentType.FIXED_PRICE: return `${rule.name} → C$${v.toFixed(2)}`;
  }
}

function ruleMatchesSlot(
  rule: PricingRule,
  dayOfWeek: number,
  slotStartMins: number,
  slotEndMins: number,
  slotDate: Date
): boolean {
  // Day-of-week filter (empty array = all days)
  if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) return false;

  // Time-window filter
  if (rule.startTime && rule.endTime) {
    const ruleStart = timeToMinutes(rule.startTime);
    const ruleEnd = timeToMinutes(rule.endTime);
    // Slot must overlap the rule window
    if (slotEndMins <= ruleStart || slotStartMins >= ruleEnd) return false;
  }

  // Date-range filter (seasonal)
  if (rule.startDate && slotDate < rule.startDate) return false;
  if (rule.endDate && slotDate > rule.endDate) return false;

  return true;
}

// ─── Core function ────────────────────────────────────────────────────────────

export async function calculateSlotPrice(
  courtId: string,
  date: Date,
  startTime: string,
  endTime: string,
  basePriceCAD: number
): Promise<PriceBreakdown> {
  // 1. Check date override first
  const override = await prisma.dateOverride.findUnique({
    where: { courtId_date: { courtId, date } },
  });

  if (override) {
    if (override.type === DateOverrideType.BLOCKED) {
      return { basePriceCAD, finalPriceCAD: 0, appliedRule: null, isBlocked: true };
    }
    if (override.type === DateOverrideType.FREE) {
      return { basePriceCAD, finalPriceCAD: 0, appliedRule: `Free (${override.reason ?? "complimentary"})`, isBlocked: false };
    }
    if (override.type === DateOverrideType.CUSTOM_PRICE) {
      const price = Number(override.customPriceCAD ?? basePriceCAD);
      return { basePriceCAD, finalPriceCAD: price, appliedRule: `Custom price (${override.reason ?? "override"})`, isBlocked: false };
    }
  }

  // 2. Get active pricing rules for this court
  const rules = await prisma.pricingRule.findMany({
    where: { courtId, isActive: true },
    orderBy: { priority: "desc" },
  });

  if (rules.length === 0) {
    return { basePriceCAD, finalPriceCAD: Math.round(basePriceCAD * 100) / 100, appliedRule: null, isBlocked: false };
  }

  // 3. Find highest-priority matching rule
  const dayOfWeek = date.getUTCDay();
  const slotStartMins = timeToMinutes(startTime);
  const slotEndMins = timeToMinutes(endTime);

  const matched = rules.find((r) => ruleMatchesSlot(r, dayOfWeek, slotStartMins, slotEndMins, date));
  if (!matched) {
    return { basePriceCAD, finalPriceCAD: Math.round(basePriceCAD * 100) / 100, appliedRule: null, isBlocked: false };
  }

  const finalPriceCAD = Math.max(0, Math.round(applyAdjustment(basePriceCAD, matched) * 100) / 100);
  return { basePriceCAD, finalPriceCAD, appliedRule: ruleLabel(matched), isBlocked: false };
}

// Batch version to avoid N+1 when calling for many slots on the same court/date
export async function calculatePricingForCourt(
  courtId: string,
  date: Date,
  slots: Array<{ startTime: string; endTime: string; basePriceCAD: number }>
): Promise<PriceBreakdown[]> {
  // Load rules + override once
  const [rules, override] = await Promise.all([
    prisma.pricingRule.findMany({ where: { courtId, isActive: true }, orderBy: { priority: "desc" } }),
    prisma.dateOverride.findUnique({ where: { courtId_date: { courtId, date } } }),
  ]);

  const dayOfWeek = date.getUTCDay();

  return slots.map(({ startTime, endTime, basePriceCAD }) => {
    if (override) {
      if (override.type === DateOverrideType.BLOCKED) {
        return { basePriceCAD, finalPriceCAD: 0, appliedRule: null, isBlocked: true };
      }
      if (override.type === DateOverrideType.FREE) {
        return { basePriceCAD, finalPriceCAD: 0, appliedRule: `Free (${override.reason ?? "complimentary"})`, isBlocked: false };
      }
      if (override.type === DateOverrideType.CUSTOM_PRICE) {
        const price = Number(override.customPriceCAD ?? basePriceCAD);
        return { basePriceCAD, finalPriceCAD: price, appliedRule: `Custom price (${override.reason ?? "override"})`, isBlocked: false };
      }
    }

    const slotStartMins = timeToMinutes(startTime);
    const slotEndMins = timeToMinutes(endTime);
    const matched = rules.find((r) => ruleMatchesSlot(r, dayOfWeek, slotStartMins, slotEndMins, date));
    if (!matched) return { basePriceCAD, finalPriceCAD: Math.round(basePriceCAD * 100) / 100, appliedRule: null, isBlocked: false };

    const finalPriceCAD = Math.max(0, Math.round(applyAdjustment(basePriceCAD, matched) * 100) / 100);
    return { basePriceCAD, finalPriceCAD, appliedRule: ruleLabel(matched), isBlocked: false };
  });
}

// ─── Get human-readable rule summary for display ─────────────────────────────

export function describeRule(rule: PricingRule): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayStr = rule.daysOfWeek.length === 0
    ? "Every day"
    : rule.daysOfWeek.map((d) => days[d]).join(", ");
  const timeStr = rule.startTime && rule.endTime
    ? `${rule.startTime}–${rule.endTime}`
    : "all hours";
  return `${dayStr}, ${timeStr}`;
}
