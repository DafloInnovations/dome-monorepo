import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createFacility,
  updateFacility,
} from "../services/facilities.service";

const router = Router();

// All vendor routes require authentication + VENDOR role
router.use(authenticate, requireRole("VENDOR"));

// ─── Schemas ─────────────────────────────────────────────────────────────────

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
    "soccer","basketball","tennis","badminton","volleyball",
    "hockey","squash","pickleball","baseball","cricket",
  ]),
  surface: z.enum([
    "turf","hardwood","concrete","clay","ice","grass","rubberized",
  ]),
  capacity: z.number().int().positive(),
  images: z.array(z.string().url()).optional().default([]),
  address: addressSchema,
  operatingHours: operatingHoursSchema,
});

const updateFacilitySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  sport: z
    .enum([
      "soccer","basketball","tennis","badminton","volleyball",
      "hockey","squash","pickleball","baseball","cricket",
    ])
    .optional(),
  surface: z
    .enum(["turf","hardwood","concrete","clay","ice","grass","rubberized"])
    .optional(),
  capacity: z.number().int().positive().optional(),
  images: z.array(z.string().url()).optional(),
  isActive: z.boolean().optional(),
  address: addressSchema.partial().optional(),
  operatingHours: operatingHoursSchema,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/v1/vendor/facilities
router.post("/facilities", validate(createFacilitySchema), async (req, res, next) => {
  try {
    const facility = await createFacility(req.user!.sub, req.body);
    res.status(201).json({ data: facility });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/vendor/facilities/:id
router.put("/facilities/:id", validate(updateFacilitySchema), async (req, res, next) => {
  try {
    const facilityId = Array.isArray(req.params["id"])
      ? req.params["id"][0]!
      : req.params["id"]!;
    const facility = await updateFacility(req.user!.sub, facilityId, req.body);
    res.json({ data: facility });
  } catch (err) {
    next(err);
  }
});

export default router;
