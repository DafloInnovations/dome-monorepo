import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createOpenGameSchema = z.object({
  slotId: z.string().uuid(),
  facilityId: z.string().uuid(),
  sport: z.enum(["soccer","basketball","tennis","badminton","volleyball","hockey","squash","pickleball","baseball","cricket"]),
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  skillLevel: z.enum(["beginner","intermediate","advanced","any"]),
  maxPlayers: z.number().int().min(2).max(100),
  pricePerPlayerCAD: z.number().positive(),
  isPublic: z.boolean().optional().default(true),
});

router.get("/", async (req, res) => {
  // TODO: list open games with filters
  res.json({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
});

router.get("/:id", async (req, res) => {
  res.json({ data: { id: req.params["id"] } });
});

router.post("/", authenticate, validate(createOpenGameSchema), async (req, res) => {
  // TODO: create open game, change slot status to "open-game"
  res.status(201).json({ data: { ...req.body, hostUserId: req.user!.sub, status: "open", currentPlayers: 1, participants: [] } });
});

router.post("/:id/join", authenticate, async (req, res) => {
  // TODO: add player to participants, create payment intent, handle full state
  res.json({ data: { id: req.params["id"] } });
});

router.delete("/:id/leave", authenticate, async (req, res) => {
  // TODO: remove player, refund payment, recalculate price per player
  res.status(204).end();
});

router.put("/:id/cancel", authenticate, async (req, res) => {
  // TODO: host cancels, refund all participants
  res.json({ data: { id: req.params["id"], status: "cancelled" } });
});

export default router;
