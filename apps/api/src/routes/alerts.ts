import { Router } from "express";
import { z } from "zod";
import { AlertStatus } from "@prisma/client";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createAlert,
  cancelAlert,
  getUserAlerts,
  getPendingAlertCount,
} from "../services/alerts.service";

const router = Router();

const createSchema = z.object({
  facilityId:     z.string().cuid(),
  courtId:        z.string().cuid().optional().nullable(),
  sport:          z.string().optional().nullable(),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime:      z.string().regex(/^\d{2}:\d{2}$/),
  endTime:        z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().min(30).max(480),
});

// POST /api/v1/alerts
router.post("/", authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const body = req.body as z.infer<typeof createSchema>;
    const alert = await createAlert(userId, body);
    res.status(201).json({ data: alert });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts/count
router.get("/count", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const pending = await getPendingAlertCount(userId);
    res.json({ data: { pending } });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/alerts
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const statusParam = Array.isArray(req.query["status"]) ? req.query["status"][0] : req.query["status"] as string | undefined;
    const status = statusParam && Object.values(AlertStatus).includes(statusParam as AlertStatus)
      ? (statusParam as AlertStatus)
      : undefined;
    const alerts = await getUserAlerts(userId, status);
    res.json({ data: alerts });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/alerts/:id
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const id = req.params["id"] as string;
    await cancelAlert(userId, id);
    res.json({ data: { cancelled: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
