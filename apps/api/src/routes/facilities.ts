import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  province: z.string().length(2),
  postalCode: z.string(),
  country: z.literal("CA"),
});

const facilitySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(2000),
  address: addressSchema,
  sport: z.enum(["soccer","basketball","tennis","badminton","volleyball","hockey","squash","pickleball","baseball","cricket"]),
  surface: z.enum(["turf","hardwood","concrete","clay","ice","grass","rubberized"]),
  capacity: z.number().int().positive(),
  amenityIds: z.array(z.string()).optional(),
  operatingHours: z.array(z.object({
    day: z.number().int().min(0).max(6),
    openTime: z.string(),
    closeTime: z.string(),
    isClosed: z.boolean(),
  })),
});

router.get("/", async (req, res) => {
  // TODO: list facilities with filters (sport, city, province, date, geosearch)
  res.json({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
});

router.get("/mine", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: list facilities belonging to authenticated vendor
  res.json({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
});

router.get("/:id", async (req, res) => {
  // TODO: fetch facility with ratings summary
  res.json({ data: { id: req.params["id"] } });
});

router.post("/", authenticate, requireRole("vendor"), validate(facilitySchema), async (req, res) => {
  // TODO: create facility for authenticated vendor
  res.status(201).json({ data: { ...req.body, vendorId: req.user!.sub } });
});

router.put("/:id", authenticate, requireRole("vendor"), validate(facilitySchema.partial()), async (req, res) => {
  // TODO: update facility, verify ownership
  res.json({ data: { id: req.params["id"], ...req.body } });
});

router.delete("/:id", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: soft-delete facility, verify ownership
  res.status(204).end();
});

export default router;
