import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createReviewSchema = z.object({
  bookingId: z.string().uuid(),
  facilityId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

router.get("/facility/:facilityId", async (req, res) => {
  const { page = "1", limit = "10" } = req.query as Record<string, string>;
  // TODO: fetch reviews for facility, newest first
  res.json({ data: [], total: 0, page: Number(page), limit: Number(limit), hasMore: false });
});

router.get("/facility/:facilityId/summary", async (req, res) => {
  // TODO: aggregate rating distribution
  res.json({ data: { facilityId: req.params["facilityId"], averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } });
});

router.post("/", authenticate, validate(createReviewSchema), async (req, res) => {
  // TODO: verify booking is completed and belongs to user, one review per booking
  res.status(201).json({ data: { ...req.body, isVerified: true } });
});

router.put("/:id/reply", authenticate, async (req, res) => {
  // TODO: vendor-only, add reply to review for their facility
  res.json({ data: { id: req.params["id"], vendorReply: req.body.reply } });
});

router.delete("/:id", authenticate, async (req, res) => {
  // TODO: admin or review author only
  res.status(204).end();
});

export default router;
