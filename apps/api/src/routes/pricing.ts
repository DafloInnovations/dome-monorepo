import { Router } from "express";
import { z } from "zod";
import { DateOverrideType, PriceAdjustmentType, PricingRuleType } from "@prisma/client";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { prisma } from "../lib/prisma";
import { calculatePricingForCourt, describeRule } from "../services/pricing.service";

const router = Router();
router.use(authenticate, requireRole("VENDOR"));

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

async function assertCourtOwner(courtId: string, userId: string) {
  const court = await prisma.court.findFirst({
    where: { id: courtId },
    include: { facility: { select: { vendor: { select: { userId: true } } } } },
  });
  if (!court) throw Object.assign(new Error("Court not found"), { status: 404 });
  if (court.facility.vendor?.userId !== userId)
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  return court;
}

// ─── PATCH /api/v1/vendor/courts/:id/pricing/toggle ──────────────────────────

router.patch("/:id/pricing/toggle", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    const { enabled } = req.body as { enabled: boolean };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ message: "enabled must be boolean" }); return;
    }
    const updated = await prisma.court.update({
      where: { id: courtId },
      data: { dynamicPricingEnabled: enabled },
      select: { id: true, dynamicPricingEnabled: true },
    });
    res.json({ data: updated });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/vendor/courts/:id/pricing/base-price ────────────────────────

router.put("/:id/pricing/base-price", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    const { priceCAD } = req.body as { priceCAD: number };
    if (typeof priceCAD !== "number" || priceCAD <= 0) {
      res.status(400).json({ message: "priceCAD must be a positive number" }); return;
    }
    const result = await prisma.slot.updateMany({
      where: { courtId, status: "AVAILABLE" },
      data: { priceCAD },
    });
    res.json({ data: { updated: result.count, priceCAD } });
  } catch (err) { next(err); }
});

// ─── GET /api/v1/vendor/courts/:id/pricing ────────────────────────────────────

router.get("/:id/pricing", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const court = await assertCourtOwner(courtId, req.user!.sub);

    const [rules, overrides, basePriceSlot] = await Promise.all([
      prisma.pricingRule.findMany({
        where: { courtId },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
      prisma.dateOverride.findMany({
        where: { courtId },
        orderBy: { date: "asc" },
      }),
      prisma.slot.findFirst({
        where: { courtId, status: "AVAILABLE" },
        select: { priceCAD: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({
      data: {
        courtId,
        dynamicPricingEnabled: court.dynamicPricingEnabled,
        basePriceCAD: basePriceSlot ? Number(basePriceSlot.priceCAD) : null,
        rules: rules.map((r) => ({
          ...r,
          adjustmentValue: Number(r.adjustmentValue),
          description: describeRule(r),
        })),
        overrides: overrides.map((o) => ({
          ...o,
          customPriceCAD: o.customPriceCAD !== null ? Number(o.customPriceCAD) : null,
          date: o.date.toISOString().split("T")[0],
        })),
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/vendor/courts/:id/pricing/rules ────────────────────────────

const ruleSchema = z.object({
  name:            z.string().min(1).max(100),
  type:            z.nativeEnum(PricingRuleType),
  daysOfWeek:      z.array(z.number().int().min(0).max(6)).default([]),
  startTime:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime:         z.string().regex(/^\d{2}:\d{2}$/).optional(),
  startDate:       z.string().optional(),
  endDate:         z.string().optional(),
  adjustmentType:  z.nativeEnum(PriceAdjustmentType),
  adjustmentValue: z.number().positive(),
  priority:        z.number().int().min(0).max(100).default(0),
});

router.post("/:id/pricing/rules", validate(ruleSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    const body = req.body as z.infer<typeof ruleSchema>;

    const rule = await prisma.pricingRule.create({
      data: {
        courtId,
        name: body.name,
        type: body.type,
        daysOfWeek: body.daysOfWeek,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        adjustmentType: body.adjustmentType,
        adjustmentValue: body.adjustmentValue,
        priority: body.priority,
      },
    });

    res.status(201).json({
      data: { ...rule, adjustmentValue: Number(rule.adjustmentValue), description: describeRule(rule) },
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/v1/vendor/courts/:id/pricing/rules/:ruleId ─────────────────────

const ruleUpdateSchema = ruleSchema.partial();

router.put("/:id/pricing/rules/:ruleId", validate(ruleUpdateSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const ruleId  = param(req.params["ruleId"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    const body = req.body as z.infer<typeof ruleUpdateSchema>;

    const rule = await prisma.pricingRule.update({
      where: { id: ruleId, courtId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.daysOfWeek !== undefined && { daysOfWeek: body.daysOfWeek }),
        ...(body.startTime !== undefined && { startTime: body.startTime }),
        ...(body.endTime !== undefined && { endTime: body.endTime }),
        ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
        ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
        ...(body.adjustmentType !== undefined && { adjustmentType: body.adjustmentType }),
        ...(body.adjustmentValue !== undefined && { adjustmentValue: body.adjustmentValue }),
        ...(body.priority !== undefined && { priority: body.priority }),
      },
    });

    res.json({
      data: { ...rule, adjustmentValue: Number(rule.adjustmentValue), description: describeRule(rule) },
    });
  } catch (err) { next(err); }
});

// ─── PATCH /api/v1/vendor/courts/:id/pricing/rules/:ruleId/toggle ────────────

router.patch("/:id/pricing/rules/:ruleId/toggle", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const ruleId  = param(req.params["ruleId"]!);
    await assertCourtOwner(courtId, req.user!.sub);

    const current = await prisma.pricingRule.findFirst({ where: { id: ruleId, courtId }, select: { isActive: true } });
    if (!current) { res.status(404).json({ message: "Rule not found" }); return; }

    const updated = await prisma.pricingRule.update({
      where: { id: ruleId },
      data: { isActive: !current.isActive },
    });
    res.json({ data: { id: updated.id, isActive: updated.isActive } });
  } catch (err) { next(err); }
});

// ─── DELETE /api/v1/vendor/courts/:id/pricing/rules/:ruleId ──────────────────

router.delete("/:id/pricing/rules/:ruleId", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    const ruleId  = param(req.params["ruleId"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    await prisma.pricingRule.delete({ where: { id: ruleId, courtId } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/vendor/courts/:id/pricing/overrides ────────────────────────

const overrideSchema = z.object({
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:           z.nativeEnum(DateOverrideType),
  customPriceCAD: z.number().nonnegative().optional(),
  reason:         z.string().max(200).optional(),
});

router.post("/:id/pricing/overrides", validate(overrideSchema), async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    const body = req.body as z.infer<typeof overrideSchema>;
    const [y, m, d] = body.date.split("-").map(Number);
    const date = new Date(Date.UTC(y!, m! - 1, d!));

    const override = await prisma.dateOverride.upsert({
      where: { courtId_date: { courtId, date } },
      create: {
        courtId,
        date,
        type: body.type,
        customPriceCAD: body.customPriceCAD ?? null,
        reason: body.reason ?? null,
      },
      update: {
        type: body.type,
        customPriceCAD: body.customPriceCAD ?? null,
        reason: body.reason ?? null,
      },
    });

    res.status(201).json({
      data: {
        ...override,
        date: override.date.toISOString().split("T")[0],
        customPriceCAD: override.customPriceCAD !== null ? Number(override.customPriceCAD) : null,
      },
    });
  } catch (err) { next(err); }
});

// ─── DELETE /api/v1/vendor/courts/:id/pricing/overrides/:overrideId ──────────

router.delete("/:id/pricing/overrides/:overrideId", async (req, res, next) => {
  try {
    const courtId    = param(req.params["id"]!);
    const overrideId = param(req.params["overrideId"]!);
    await assertCourtOwner(courtId, req.user!.sub);
    await prisma.dateOverride.delete({ where: { id: overrideId, courtId } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
});

// ─── POST /api/v1/vendor/courts/:id/pricing/preview ──────────────────────────
// Returns per-slot dynamic prices for the next 7 days

router.post("/:id/pricing/preview", async (req, res, next) => {
  try {
    const courtId = param(req.params["id"]!);
    await assertCourtOwner(courtId, req.user!.sub);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const days: Array<{ date: string; slots: Array<{ startTime: string; endTime: string; basePriceCAD: number; finalPriceCAD: number; appliedRule: string | null; isBlocked: boolean }> }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 86_400_000);
      const dateStr = d.toISOString().split("T")[0]!;

      const slots = await prisma.slot.findMany({
        where: { courtId, date: d },
        orderBy: { startTime: "asc" },
        select: { startTime: true, endTime: true, priceCAD: true },
      });

      const breakdowns = await calculatePricingForCourt(
        courtId,
        d,
        slots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, basePriceCAD: Number(s.priceCAD) }))
      );

      days.push({
        date: dateStr,
        slots: slots.map((s, idx) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          basePriceCAD: breakdowns[idx]!.basePriceCAD,
          finalPriceCAD: breakdowns[idx]!.finalPriceCAD,
          appliedRule: breakdowns[idx]!.appliedRule,
          isBlocked: breakdowns[idx]!.isBlocked,
        })),
      });
    }

    res.json({ data: days });
  } catch (err) { next(err); }
});

export default router;
