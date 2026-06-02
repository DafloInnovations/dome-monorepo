import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import { Server, Socket } from "socket.io";
import { verifyAccessToken } from "./jwt";
import { prisma } from "./prisma";
import { sendPushNotification, saveNotification } from "./firebase";

interface AuthSocket extends Socket {
  userId: string;
}

// Track which thread rooms each user is currently in.
// userId → Set<threadId>
const userActiveThreads = new Map<string, Set<string>>();

export function initSocket(httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse>) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? "*",
      credentials: true,
    },
  });

  // JWT auth on every connection
  io.use((socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthSocket).userId = payload.sub;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthSocket;
    const userId = socket.userId;

    socket.on("disconnect", () => {
      userActiveThreads.delete(userId);
    });

    // Join a thread room (validates participant membership)
    socket.on("join_thread", async (threadId: string) => {
      if (typeof threadId !== "string") return;
      const member = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: threadId, userId } },
      });
      if (!member) return;
      socket.join(`thread:${threadId}`);
      const threads = userActiveThreads.get(userId) ?? new Set<string>();
      threads.add(threadId);
      userActiveThreads.set(userId, threads);
    });

    // Send a message via socket (saves to DB + broadcasts + push notification)
    socket.on("send_message", async (data: { threadId: string; content: string }) => {
      if (!data || typeof data.threadId !== "string" || typeof data.content !== "string") return;
      const { threadId, content } = data;
      const trimmed = content.trim();
      if (!trimmed) return;

      const member = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: threadId, userId } },
      });
      if (!member) return;

      const [message] = await prisma.$transaction([
        prisma.chatMessage.create({
          data: { conversationId: threadId, senderId: userId, content: trimmed, type: "TEXT" },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        }),
        prisma.conversation.update({
          where: { id: threadId },
          data: { updatedAt: new Date() },
        }),
      ]);

      io.to(`thread:${threadId}`).emit("new_message", message);

      // Push to other participants not currently viewing this thread
      const otherParticipants = await prisma.conversationParticipant.findMany({
        where: { conversationId: threadId, userId: { not: userId } },
        include: { user: { select: { deviceToken: true, firstName: true, lastName: true } } },
      });

      const senderName = [message.sender.firstName, message.sender.lastName]
        .filter(Boolean).join(" ") || "Someone";
      const preview = trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed;

      const msgData = { type: "new_message", threadId };
      for (const p of otherParticipants) {
        await saveNotification(p.userId, "NEW_MESSAGE", senderName, preview, msgData);
        const isInThread = userActiveThreads.get(p.userId)?.has(threadId) ?? false;
        if (!isInThread && p.user.deviceToken) {
          await sendPushNotification(p.user.deviceToken, senderName, preview, msgData);
        }
      }
    });

    socket.on("typing_start", (threadId: string) => {
      if (typeof threadId !== "string") return;
      socket.to(`thread:${threadId}`).emit("user_typing", { userId, threadId });
    });

    socket.on("typing_stop", (threadId: string) => {
      if (typeof threadId !== "string") return;
      socket.to(`thread:${threadId}`).emit("user_stopped_typing", { userId, threadId });
    });

    socket.on("mark_read", async (threadId: string) => {
      if (typeof threadId !== "string") return;
      await prisma.chatMessage.updateMany({
        where: { conversationId: threadId, senderId: { not: userId }, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      socket.to(`thread:${threadId}`).emit("message_read", { threadId, userId });
    });
  });

  return io;
}
