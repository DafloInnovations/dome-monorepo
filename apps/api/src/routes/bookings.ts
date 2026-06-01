import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  facilityId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

const cancelSchema = z.object({
  reason: z.string().max(200).optional(),
});

router.get("/", authenticate, async (req, res) => {
  const { status, facilityId, from, to, page = "1", limit = "20" } = req.query as Record<string, string>;
  // TODO: query database with filters
  res.json({ data: [], total: 0, page: Number(page), limit: Number(limit), hasMore: false });
});

router.get("/:id", authenticate, async (req, res) => {
  // TODO: fetch booking by id, check ownership
  res.json({ data: { id: req.params["id"] } });
});

router.post("/", authenticate, validate(createBookingSchema), async (req, res) => {
  // TODO: verify slot available, create booking, hold slot
  res.status(201).json({ data: { ...req.body, status: "pending" } });
});

router.put("/:id/cancel", authenticate, validate(cancelSchema), async (req, res) => {
  // TODO: cancel booking, release slot, trigger refund if needed
  res.json({ data: { id: req.params["id"], status: "cancelled" } });
});

router.put("/:id/complete", authenticate, async (req, res) => {
  // TODO: vendor-only, mark booking complete
  res.json({ data: { id: req.params["id"], status: "completed" } });
});

router.put("/:id/no-show", authenticate, async (req, res) => {
  // TODO: vendor-only, mark no-show
  res.json({ data: { id: req.params["id"], status: "no-show" } });
});

export default router;
