import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  getOrCreateThread,
  getThreads,
  getMessages,
  sendMessage,
} from "../services/chat.service";

const router = Router();

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

const createThreadSchema = z.object({
  participantId: z.string().min(1),
  gameId: z.string().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

// POST /api/v1/chat/threads — get or create thread
router.post("/threads", authenticate, validate(createThreadSchema), async (req, res, next) => {
  try {
    const thread = await getOrCreateThread(
      req.user!.sub as string,
      req.body as z.infer<typeof createThreadSchema>
    );
    res.status(201).json({ data: thread });
  } catch (err) { next(err); }
});

// GET /api/v1/chat/threads — list threads for current user
router.get("/threads", authenticate, async (req, res, next) => {
  try {
    const threads = await getThreads(req.user!.sub as string);
    res.json({ data: threads });
  } catch (err) { next(err); }
});

// GET /api/v1/chat/threads/:threadId/messages — paginated messages
router.get("/threads/:threadId/messages", authenticate, async (req, res, next) => {
  try {
    const { page = "1", limit = "40" } = req.query as Record<string, string>;
    const result = await getMessages(
      req.user!.sub as string,
      param(req.params["threadId"]!),
      Number(page),
      Number(limit)
    );
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/v1/chat/threads/:threadId/messages — REST send fallback
router.post(
  "/threads/:threadId/messages",
  authenticate,
  validate(sendMessageSchema),
  async (req, res, next) => {
    try {
      const message = await sendMessage(
        req.user!.sub as string,
        param(req.params["threadId"]!),
        (req.body as z.infer<typeof sendMessageSchema>).content
      );
      res.status(201).json({ data: message });
    } catch (err) { next(err); }
  }
);

export default router;
