import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import {
  logout,
  refreshAccessToken,
  sendOtp,
  verifyOtp,
} from "../services/auth.service";

const router = Router();

const sendOtpSchema = z.object({
  phone: z.string().min(10, "Phone number is required"),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6).regex(/^\d{6}$/, "Code must be 6 digits"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// POST /auth/send-otp
router.post("/send-otp", validate(sendOtpSchema), async (req, res, next) => {
  try {
    await sendOtp(req.body.phone as string);
    res.json({ data: { message: "Verification code sent" } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify-otp
router.post("/verify-otp", validate(verifyOtpSchema), async (req, res, next) => {
  try {
    const result = await verifyOtp(req.body.phone as string, req.body.code as string);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const tokens = await refreshAccessToken(req.body.refreshToken as string);
    res.json({ data: tokens });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) await logout(refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
