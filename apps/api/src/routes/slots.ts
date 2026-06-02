import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { redis } from "../lib/redis";

const router = Router();

const slotSchema = z.object({
  facilityId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  priceCAD: z.number().positive(),
});

function formatTtl(ttl: number): string {
  if (ttl <= 0) return "soon";
  if (ttl < 60) return `${ttl} second${ttl !== 1 ? "s" : ""}`;
  const minutes = Math.ceil(ttl / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

// GET /api/v1/slots/:id/lock-status — public, no auth needed
router.get("/:id/lock-status", async (req, res, next) => {
  try {
    const slotId = req.params["id"]!;
    const ttl = await redis.ttl(`slot:${slotId}:lock`);
    const isLocked = ttl > 0;
    res.json({
      data: {
        isLocked,
        ttl: Math.max(0, ttl),
        availableIn: isLocked ? formatTtl(ttl) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res) => {
  res.json({ data: { id: req.params["id"] } });
});

router.post("/", authenticate, requireRole("vendor"), validate(slotSchema), async (req, res) => {
  // TODO: create slot, compute durationMinutes
  res.status(201).json({ data: { ...req.body, status: "available" } });
});

router.post("/recurring", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: create recurring slots up to repeatUntil
  res.status(201).json({ data: [] });
});

router.put("/:id", authenticate, requireRole("vendor"), validate(slotSchema.partial()), async (req, res) => {
  // TODO: update slot, verify ownership
  res.json({ data: { id: req.params["id"], ...req.body } });
});

router.put("/:id/block", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: set slot status to "blocked"
  res.json({ data: { id: req.params["id"], status: "blocked" } });
});

router.delete("/:id", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: delete slot, verify ownership and no active bookings
  res.status(204).end();
});

// Nested under /facilities/:facilityId/slots
export const facilitySlotRouter = Router({ mergeParams: true });

facilitySlotRouter.get("/", async (req, res) => {
  const { date } = req.query as { date?: string };
  const params = req.params as Record<string, string>;
  res.json({ data: { facilityId: params["facilityId"], date, slots: [] } });
});

export default router;
