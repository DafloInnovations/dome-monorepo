import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  province: z.string().length(2).optional(),
});

router.get("/me", authenticate, async (req, res) => {
  // TODO: return authenticated user
  res.json({ data: { id: req.user!.sub } });
});

router.put("/me", authenticate, validate(updateUserSchema), async (req, res) => {
  // TODO: update user profile
  res.json({ data: { id: req.user!.sub, ...req.body } });
});

router.delete("/me", authenticate, async (req, res) => {
  // TODO: anonymize / delete account (PIPEDA compliance)
  res.status(204).end();
});

export default router;
