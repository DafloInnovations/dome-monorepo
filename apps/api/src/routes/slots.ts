import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const slotSchema = z.object({
  facilityId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  priceCAD: z.number().positive(),
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
  // TODO: return all slots for facility on given date
  res.json({ data: { facilityId: req.params["facilityId"], date, slots: [] } });
});

export default router;
