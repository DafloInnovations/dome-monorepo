import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createPaymentIntent,
  handleWebhook,
} from "../services/payments.service";

const router = Router();

const intentSchema = z.object({
  bookingId: z.string().min(1),
});

// POST /api/v1/payments/intent — authenticated
router.post("/intent", authenticate, validate(intentSchema), async (req, res, next) => {
  try {
    const { bookingId } = req.body as z.infer<typeof intentSchema>;
    const data = await createPaymentIntent(req.user!.sub, bookingId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/payments/webhook — no auth, Stripe-signature verified inside service
// express.raw() is applied in app.ts before express.json(), so req.body is a Buffer here
router.post("/webhook", async (req, res, next) => {
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).json({ message: "Missing stripe-signature header" });
      return;
    }
    const result = await handleWebhook(req.body as Buffer, sig);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
