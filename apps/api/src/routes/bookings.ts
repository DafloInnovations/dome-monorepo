import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  myBookings,
  releaseLock,
} from "../services/bookings.service";

const router = Router();

router.use(authenticate);

const createSchema = z.object({
  slotId: z.string().min(1),
  facilityId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

const confirmSchema = z.object({
  paymentIntentId: z.string().min(1),
});

const cancelSchema = z.object({
  reason: z.string().max(200).optional(),
});

// GET /api/v1/bookings/me — must be before /:id
router.get("/me", async (req, res, next) => {
  try {
    const { page, limit } = req.query as Record<string, string | undefined>;
    const result = await myBookings(
      req.user!.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookings
router.post("/", validate(createSchema), async (req, res, next) => {
  try {
    const { slotId, facilityId, notes } = req.body as z.infer<typeof createSchema>;
    const booking = await createBooking(req.user!.sub, slotId, facilityId, notes);
    res.status(201).json({ data: booking });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/bookings/:id/confirm
router.post("/:id/confirm", validate(confirmSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    const { paymentIntentId } = req.body as z.infer<typeof confirmSchema>;
    const booking = await confirmBooking(req.user!.sub, id, paymentIntentId);
    res.json({ data: booking });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/bookings/:id/lock — user abandoned booking before paying
router.delete("/:id/lock", async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    const result = await releaseLock(req.user!.sub, id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/bookings/:id/cancel
router.put("/:id/cancel", validate(cancelSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    const { reason } = req.body as z.infer<typeof cancelSchema>;
    const result = await cancelBooking(req.user!.sub, id, reason);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
