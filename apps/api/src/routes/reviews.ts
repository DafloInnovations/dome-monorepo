import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createReview,
  editReview,
  deleteReview,
  getFacilityReviews,
  getPendingReviews,
  getMyReviews,
  addVendorReply,
  flagReview,
  getVendorReviews,
  getAllReviews,
  setReviewVisibility,
} from "../services/reviews.service";

const router = Router();

const starField = z.number().int().min(1).max(5);

const createSchema = z.object({
  bookingId:      z.string().cuid(),
  rating:         starField,
  title:          z.string().max(120).optional().nullable(),
  body:           z.string().max(2000).optional().nullable(),
  courtQuality:   starField.optional().nullable(),
  cleanliness:    starField.optional().nullable(),
  valueForMoney:  starField.optional().nullable(),
  staffFriendly:  starField.optional().nullable(),
});

const editSchema = createSchema.partial().omit({ bookingId: true });

// ─── Player endpoints ─────────────────────────────────────────────────────────

// POST /api/v1/reviews
router.post("/", authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const review = await createReview(req.user!.sub as string, req.body as z.infer<typeof createSchema>);
    res.status(201).json({ data: review });
  } catch (err) { next(err); }
});

// GET /api/v1/reviews/pending — bookings eligible for review
router.get("/pending", authenticate, async (req, res, next) => {
  try {
    const bookings = await getPendingReviews(req.user!.sub as string);
    res.json({ data: bookings });
  } catch (err) { next(err); }
});

// GET /api/v1/reviews/me — my submitted reviews
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const reviews = await getMyReviews(req.user!.sub as string);
    res.json({ data: reviews });
  } catch (err) { next(err); }
});

// PUT /api/v1/reviews/:id
router.put("/:id", authenticate, validate(editSchema), async (req, res, next) => {
  try {
    const review = await editReview(
      req.user!.sub as string,
      req.params["id"] as string,
      req.body as z.infer<typeof editSchema>
    );
    res.json({ data: review });
  } catch (err) { next(err); }
});

// DELETE /api/v1/reviews/:id
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const result = await deleteReview(req.user!.sub as string, req.params["id"] as string);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/reviews/:id/flag
router.post("/:id/flag", authenticate, async (req, res, next) => {
  try {
    const { reason } = req.body as { reason?: string };
    await flagReview(req.params["id"] as string, reason ?? "No reason given");
    res.json({ data: { flagged: true } });
  } catch (err) { next(err); }
});

// ─── Public endpoints ─────────────────────────────────────────────────────────

// GET /api/v1/reviews/facility/:facilityId
router.get("/facility/:facilityId", async (req, res, next) => {
  try {
    const { page, limit, sort, minRating } = req.query as Record<string, string | undefined>;
    const result = await getFacilityReviews(req.params["facilityId"] as string, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sort: sort as "newest" | "highest" | "lowest" | undefined,
      minRating: minRating ? Number(minRating) : undefined,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Vendor endpoints ─────────────────────────────────────────────────────────

// POST /api/v1/reviews/:id/reply
router.post("/:id/reply", authenticate, requireRole("VENDOR"), async (req, res, next) => {
  try {
    const { reply } = req.body as { reply?: string };
    if (!reply?.trim()) { res.status(400).json({ message: "Reply text required" }); return; }
    const review = await addVendorReply(req.user!.sub as string, req.params["id"] as string, reply.trim());
    res.json({ data: review });
  } catch (err) { next(err); }
});

// GET /api/v1/reviews/vendor — all reviews for vendor's facilities
router.get("/vendor", authenticate, requireRole("VENDOR"), async (req, res, next) => {
  try {
    const { facilityId, rating, hasReply, sort, page, limit } = req.query as Record<string, string | undefined>;
    const result = await getVendorReviews(req.user!.sub as string, {
      facilityId,
      rating: rating ? Number(rating) : undefined,
      hasReply: hasReply === "true" ? true : hasReply === "false" ? false : undefined,
      sort: sort as "newest" | "lowest" | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────

// GET /api/v1/reviews/admin
router.get("/admin", authenticate, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { page, limit, flagged, rating } = req.query as Record<string, string | undefined>;
    const result = await getAllReviews({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      flagged: flagged === "true" ? true : flagged === "false" ? false : undefined,
      rating: rating ? Number(rating) : undefined,
    });
    res.json({ data: result });
  } catch (err) { next(err); }
});

// PATCH /api/v1/reviews/:id/visibility
router.patch("/:id/visibility", authenticate, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { isVisible } = req.body as { isVisible?: boolean };
    if (isVisible === undefined) { res.status(400).json({ message: "isVisible required" }); return; }
    const review = await setReviewVisibility(req.params["id"] as string, isVisible);
    res.json({ data: review });
  } catch (err) { next(err); }
});

export default router;
