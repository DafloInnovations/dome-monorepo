import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  cancelBooking,
  cancelGroupBooking,
  cancelPreview,
  confirmBooking,
  confirmGroupBooking,
  createBooking,
  createGroupBooking,
  getGroupBooking,
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

// GET /api/v1/bookings/:id/cancel-preview
router.get("/:id/cancel-preview", async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    const preview = await cancelPreview(req.user!.sub as string, id);
    res.json({ data: preview });
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

// ─── Group booking routes ─────────────────────────────────────────────────────

const groupCreateSchema = z.object({
  slotIds: z.array(z.string().min(1)).min(2).max(10),
  facilityId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

const groupConfirmSchema = z.object({
  paymentIntentId: z.string().min(1),
});

const groupCancelSchema = z.object({
  reason: z.string().max(200).optional(),
});

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

// GET /api/v1/bookings/group/:groupId — must be before POST /group
router.get("/group/:groupId", async (req, res, next) => {
  try {
    const result = await getGroupBooking(req.user!.sub, param(req.params["groupId"]!));
    res.json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/bookings/group
router.post("/group", validate(groupCreateSchema), async (req, res, next) => {
  try {
    const { slotIds, facilityId, notes } = req.body as z.infer<typeof groupCreateSchema>;
    const result = await createGroupBooking(req.user!.sub, slotIds, facilityId, notes);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/bookings/group/:groupId/confirm
router.post("/group/:groupId/confirm", validate(groupConfirmSchema), async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body as z.infer<typeof groupConfirmSchema>;
    const result = await confirmGroupBooking(req.user!.sub, param(req.params["groupId"]!), paymentIntentId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/bookings/group/:groupId/cancel
router.put("/group/:groupId/cancel", validate(groupCancelSchema), async (req, res, next) => {
  try {
    const { reason } = req.body as z.infer<typeof groupCancelSchema>;
    const result = await cancelGroupBooking(req.user!.sub, param(req.params["groupId"]!), reason);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
