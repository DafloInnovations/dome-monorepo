import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createIntentSchema = z.object({
  bookingId: z.string().uuid(),
});

const confirmSchema = z.object({
  paymentIntentId: z.string(),
  bookingId: z.string().uuid(),
});

router.post("/intent", authenticate, validate(createIntentSchema), async (req, res) => {
  // TODO: calculate total with tax, create Stripe PaymentIntent, return clientSecret
  res.json({ data: { clientSecret: "pi_test_..._secret_...", paymentIntentId: "pi_test_...", amountCAD: 0, taxCAD: 0, totalCAD: 0 } });
});

router.post("/confirm", authenticate, validate(confirmSchema), async (req, res) => {
  // TODO: verify Stripe payment succeeded, confirm booking, record Payment
  res.json({ data: { status: "succeeded" } });
});

router.get("/:id", authenticate, async (req, res) => {
  res.json({ data: { id: req.params["id"] } });
});

router.post("/:id/refund", authenticate, async (req, res) => {
  // TODO: admin/vendor only, issue Stripe refund, update booking paymentStatus
  res.json({ data: { id: req.params["id"], status: "refunded" } });
});

// Stripe webhook — no auth, verified by signature
router.post("/webhook", async (req, res) => {
  // TODO: verify stripe-signature header, handle payment_intent.succeeded etc.
  res.json({ received: true });
});

export default router;
