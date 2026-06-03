import { Router } from "express";
import { z } from "zod";
import { RecurringFrequency, RecurringPaymentModel } from "@prisma/client";
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
  createTimeBooking,
  getGroupBooking,
  myBookings,
  releaseLock,
} from "../services/bookings.service";
import {
  cancelRecurringSeries,
  confirmRecurringSeries,
  createRecurringSeries,
  getMyRecurringSeries,
  pauseRecurringSeries,
} from "../services/recurring.service";

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

// ─── Time-based booking ───────────────────────────────────────────────────────
// Accepts slot IDs from GET /facilities/:id/available-courts response

const timeBookingSchema = z.object({
  slotIds: z.array(z.string().min(1)).min(1).max(20),
  facilityId: z.string().min(1),
});

// POST /api/v1/bookings/time-based
router.post("/time-based", validate(timeBookingSchema), async (req, res, next) => {
  try {
    const { slotIds, facilityId } = req.body as z.infer<typeof timeBookingSchema>;
    const result = await createTimeBooking(req.user!.sub, slotIds, facilityId);
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
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

// ─── Recurring booking routes ─────────────────────────────────────────────────

const recurringCreateSchema = z.object({
  facilityId:      z.string().min(1),
  courtId:         z.string().min(1),
  startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:       z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(30).max(480),
  frequency:       z.nativeEnum(RecurringFrequency),
  daysOfWeek:      z.array(z.number().int().min(0).max(6)).min(1),
  paymentModel:    z.nativeEnum(RecurringPaymentModel),
});

const recurringConfirmSchema = z.object({ paymentIntentId: z.string().min(1) });

const recurringCancelSchema = z.object({
  cancelFrom: z.string(),   // "NOW" or "YYYY-MM-DD"
  reason:     z.string().max(200).optional(),
});

const recurringPauseSchema = z.object({ pauseUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// GET /api/v1/bookings/recurring — list current user's series
router.get("/recurring", async (req, res, next) => {
  try {
    const series = await getMyRecurringSeries(req.user!.sub);
    res.json({ data: series });
  } catch (err) { next(err); }
});

// POST /api/v1/bookings/recurring — create series
router.post("/recurring", validate(recurringCreateSchema), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof recurringCreateSchema>;
    const result = await createRecurringSeries({ userId: req.user!.sub, ...body });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/bookings/recurring/:seriesId/confirm — confirm payment
router.post("/recurring/:seriesId/confirm", validate(recurringConfirmSchema), async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body as z.infer<typeof recurringConfirmSchema>;
    const result = await confirmRecurringSeries(req.user!.sub, param(req.params["seriesId"]!), paymentIntentId);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/bookings/recurring/:seriesId/cancel
router.put("/recurring/:seriesId/cancel", validate(recurringCancelSchema), async (req, res, next) => {
  try {
    const { cancelFrom, reason } = req.body as z.infer<typeof recurringCancelSchema>;
    const result = await cancelRecurringSeries(req.user!.sub, param(req.params["seriesId"]!), cancelFrom, reason);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PUT /api/v1/bookings/recurring/:seriesId/pause
router.put("/recurring/:seriesId/pause", validate(recurringPauseSchema), async (req, res, next) => {
  try {
    const { pauseUntil } = req.body as z.infer<typeof recurringPauseSchema>;
    const result = await pauseRecurringSeries(req.user!.sub, param(req.params["seriesId"]!), pauseUntil);
    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
