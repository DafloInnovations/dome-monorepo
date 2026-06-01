import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createVendorSchema = z.object({
  businessName: z.string().min(2),
  businessNumber: z.string().optional(),
  gstHstNumber: z.string().optional(),
  province: z.string().length(2),
  website: z.string().url().optional(),
});

router.get("/me", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: fetch vendor profile for authenticated user
  res.json({ data: { userId: req.user!.sub } });
});

router.post("/", authenticate, validate(createVendorSchema), async (req, res) => {
  // TODO: create vendor profile, upgrade user role to "vendor"
  res.status(201).json({ data: { ...req.body, userId: req.user!.sub, status: "pending" } });
});

router.put("/me", authenticate, requireRole("vendor"), validate(createVendorSchema.partial()), async (req, res) => {
  // TODO: update vendor profile
  res.json({ data: req.body });
});

router.post("/me/stripe-onboarding", authenticate, requireRole("vendor"), async (req, res) => {
  // TODO: create Stripe Express account, return onboarding URL
  res.json({ data: { url: "https://connect.stripe.com/..." } });
});

router.get("/me/earnings", authenticate, requireRole("vendor"), async (req, res) => {
  const { from, to } = req.query as { from: string; to: string };
  // TODO: aggregate earnings from payments in date range
  res.json({ data: { periodStart: from, periodEnd: to, grossCAD: 0, platformFeeCAD: 0, stripeFeeCAD: 0, netCAD: 0, payoutCount: 0 } });
});

export default router;
