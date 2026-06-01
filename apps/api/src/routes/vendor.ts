import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createFacility, updateFacility } from "../services/facilities.service";
import { bulkCreateSlots, createCourt } from "../services/courts.service";

const router = Router();

router.use(authenticate, requireRole("VENDOR"));

// ─── Facility schemas ─────────────────────────────────────────────────────────

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  province: z.string().length(2),
  postalCode: z.string().min(6).max(7),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

const operatingHoursSchema = z
  .array(
    z.object({
      day: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
      isClosed: z.boolean().optional().default(false),
    })
  )
  .optional();

const createFacilitySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(2000),
  sport: z.enum([
    "soccer", "basketball", "tennis", "badminton", "volleyball",
    "hockey", "squash", "pickleball", "baseball", "cricket",
  ]),
  surface: z.enum(["turf", "hardwood", "concrete", "clay", "ice", "grass", "rubberized"]),
  capacity: z.number().int().positive(),
  images: z.array(z.string().url()).optional().default([]),
  address: addressSchema,
  operatingHours: operatingHoursSchema,
});

const updateFacilitySchema = createFacilitySchema.partial().extend({
  isActive: z.boolean().optional(),
  address: addressSchema.partial().optional(),
});

// ─── Court schemas ────────────────────────────────────────────────────────────

const createCourtSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
});

const bulkSlotsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm"),
  slotDurationMinutes: z.number().int().positive(),
  priceCAD: z.number().positive(),
});

// ─── Facility routes ──────────────────────────────────────────────────────────

// POST /api/v1/vendor/facilities
router.post("/facilities", validate(createFacilitySchema), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createFacility(req.user!.sub, req.body) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/facilities/:id
router.put("/facilities/:id", validate(updateFacilitySchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params["id"]) ? req.params["id"][0]! : req.params["id"]!;
    res.json({ data: await updateFacility(req.user!.sub, id, req.body) });
  } catch (err) {
    next(err);
  }
});

// ─── Court routes ─────────────────────────────────────────────────────────────

// POST /api/v1/vendor/facilities/:id/courts
router.post("/facilities/:id/courts", validate(createCourtSchema), async (req, res, next) => {
  try {
    const facilityId = Array.isArray(req.params["id"])
      ? req.params["id"][0]!
      : req.params["id"]!;
    const court = await createCourt(req.user!.sub, facilityId, req.body);
    res.status(201).json({ data: court });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/vendor/courts/:id/slots/bulk
router.post("/courts/:id/slots/bulk", validate(bulkSlotsSchema), async (req, res, next) => {
  try {
    const courtId = Array.isArray(req.params["id"])
      ? req.params["id"][0]!
      : req.params["id"]!;
    const result = await bulkCreateSlots(req.user!.sub, courtId, req.body);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
