import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();

const createConversationSchema = z.object({
  context: z.enum(["booking","open-game","support"]),
  participantIds: z.array(z.string().uuid()).min(1),
  bookingId: z.string().uuid().optional(),
  openGameId: z.string().uuid().optional(),
  title: z.string().max(100).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  type: z.enum(["text","image"]).optional().default("text"),
});

router.get("/conversations", authenticate, async (req, res) => {
  // TODO: fetch conversations for authenticated user, include unread count
  res.json({ data: [], total: 0, page: 1, limit: 20, hasMore: false });
});

router.get("/conversations/:id", authenticate, async (req, res) => {
  // TODO: fetch single conversation, verify participant membership
  res.json({ data: { id: req.params["id"] } });
});

router.post("/conversations", authenticate, validate(createConversationSchema), async (req, res) => {
  // TODO: create or find existing conversation, add requesting user to participants
  res.status(201).json({ data: req.body });
});

router.get("/conversations/:id/messages", authenticate, async (req, res) => {
  const { cursor, limit = "30" } = req.query as Record<string, string>;
  // TODO: cursor-paginated messages, oldest first
  res.json({ data: { messages: [], nextCursor: undefined } });
});

router.post("/conversations/:id/messages", authenticate, validate(sendMessageSchema), async (req, res) => {
  // TODO: create message, push via websocket/SSE to other participants
  res.status(201).json({ data: { ...req.body, conversationId: req.params["id"], senderId: req.user!.sub } });
});

router.put("/conversations/:id/read", authenticate, async (req, res) => {
  // TODO: mark all messages in conversation as read for this user
  res.status(204).end();
});

export default router;
