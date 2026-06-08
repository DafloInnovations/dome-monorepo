import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { validateCoupon, applyCoupon, removeCoupon } from "../services/coupon.service";

const router = Router();

const validateSchema = z.object({
  code:        z.string().min(1).max(30),
  facilityId:  z.string().min(1),
  subtotalCAD: z.number().positive(),
});

const applySchema = z.object({
  code:      z.string().min(1).max(30),
  bookingId: z.string().min(1),
});

// POST /api/v1/coupons/validate — preview discount without committing
router.post("/validate", authenticate, validate(validateSchema), async (req, res, next) => {
  try {
    const { code, facilityId, subtotalCAD } = req.body as z.infer<typeof validateSchema>;
    const result = await validateCoupon(code, req.user!.sub as string, facilityId, subtotalCAD);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// POST /api/v1/coupons/apply — apply coupon to pending booking + update Stripe PI
router.post("/apply", authenticate, validate(applySchema), async (req, res, next) => {
  try {
    const { code, bookingId } = req.body as z.infer<typeof applySchema>;
    const userId = req.user!.sub as string;

    // Fetch booking + facility to validate
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId, status: "PENDING" },
      include: { facility: { select: { id: true } } },
    });
    if (!booking) {
      res.status(404).json({ message: "Booking not found or not pending" });
      return;
    }

    const subtotal = Number(booking.subtotalCAD);
    const validateResult = await validateCoupon(code, userId, booking.facility.id, subtotal);
    if (!validateResult.valid) {
      res.status(422).json({ message: validateResult.error });
      return;
    }

    const { couponId, discountCAD } = validateResult;
    const { newTotal } = await applyCoupon(couponId, userId, bookingId, discountCAD);

    // Update Stripe PaymentIntent amount if one exists
    if (booking.paymentIntentId && process.env["TEST_MODE"] !== "true") {
      await stripe.paymentIntents.update(booking.paymentIntentId, {
        amount: Math.round(newTotal * 100),
        metadata: { couponCode: code, discountCAD: String(discountCAD) },
      }).catch(() => null); // non-fatal — PI might not exist yet
    }

    res.json({ data: { discountCAD, newTotal, code } });
  } catch (err) { next(err); }
});

// DELETE /api/v1/coupons/remove/:bookingId — remove coupon + restore original price
router.delete("/remove/:bookingId", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const { bookingId } = req.params as { bookingId: string };

    const result = await removeCoupon(userId, bookingId);

    // Restore PI amount
    if (result.removed && result.restoredTotal) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { paymentIntentId: true },
      });
      if (booking?.paymentIntentId && process.env["TEST_MODE"] !== "true") {
        await stripe.paymentIntents.update(booking.paymentIntentId, {
          amount: Math.round(result.restoredTotal * 100),
        }).catch(() => null);
      }
    }

    res.json({ data: result });
  } catch (err) { next(err); }
});

export default router;
