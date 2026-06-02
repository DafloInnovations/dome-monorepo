import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();

function param(p: string | string[]): string {
  return Array.isArray(p) ? p[0]! : p;
}

// GET /api/v1/notifications
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    res.json({ data: notifications, unreadCount });
  } catch (err) { next(err); }
});

// GET /api/v1/notifications/unread-count
router.get("/unread-count", authenticate, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.sub as string, isRead: false },
    });
    res.json({ count });
  } catch (err) { next(err); }
});

// PUT /api/v1/notifications/read-all
router.put("/read-all", authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub as string, isRead: false },
      data: { isRead: true },
    });
    res.status(204).end();
  } catch (err) { next(err); }
});

// PUT /api/v1/notifications/:id/read
router.put("/:id/read", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.sub as string;
    const id = param(req.params["id"]!);
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.userId !== userId) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
