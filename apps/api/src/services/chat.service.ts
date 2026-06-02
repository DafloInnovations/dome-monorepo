import { ConversationContext } from "@prisma/client";
import { prisma } from "../lib/prisma";

function appError(msg: string, status = 500) {
  return Object.assign(new Error(msg), { status });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GetOrCreateThreadInput {
  participantId: string;
  gameId?: string;
}

// ─── Get or create a DM thread ───────────────────────────────────────────────

export async function getOrCreateThread(userId: string, input: GetOrCreateThreadInput) {
  const { participantId, gameId } = input;
  if (userId === participantId) throw appError("Cannot start a chat with yourself", 400);

  // Try to find an existing conversation with exactly these two participants
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: participantId } } },
        ...(gameId ? [{ openGameId: gameId }] : []),
      ],
    },
    include: threadInclude,
  });

  if (existing) return serialiseThread(existing, userId);

  const conversation = await prisma.conversation.create({
    data: {
      context: ConversationContext.OPEN_GAME,
      ...(gameId ? { openGameId: gameId } : {}),
      participants: { create: [{ userId }, { userId: participantId }] },
    },
    include: threadInclude,
  });

  return serialiseThread(conversation, userId);
}

// ─── List threads for user ────────────────────────────────────────────────────

export async function getThreads(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: threadInclude,
    orderBy: { updatedAt: "desc" },
  });

  const withUnread = await Promise.all(
    conversations.map(async (c) => {
      const unreadCount = await prisma.chatMessage.count({
        where: { conversationId: c.id, senderId: { not: userId }, isRead: false },
      });
      return serialiseThread({ ...c, unreadCount }, userId);
    })
  );

  return withUnread;
}

// ─── Paginated messages ───────────────────────────────────────────────────────

export async function getMessages(
  userId: string,
  threadId: string,
  page: number,
  limit: number
) {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: threadId, userId } },
  });
  if (!member) throw appError("Not a participant in this thread", 403);

  const take = Math.min(limit, 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const [total, messages] = await Promise.all([
    prisma.chatMessage.count({ where: { conversationId: threadId } }),
    prisma.chatMessage.findMany({
      where: { conversationId: threadId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take,
    }),
  ]);

  return { data: messages, page, limit: take, total, hasMore: skip + messages.length < total };
}

// ─── REST send (fallback) ─────────────────────────────────────────────────────

export async function sendMessage(userId: string, threadId: string, content: string) {
  const member = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: threadId, userId } },
  });
  if (!member) throw appError("Not a participant in this thread", 403);

  const [message] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: { conversationId: threadId, senderId: userId, content: content.trim(), type: "TEXT" },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    }),
    prisma.conversation.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    }),
  ]);

  return message;
}

// ─── Shared include + serialiser ──────────────────────────────────────────────

const threadInclude = {
  participants: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  openGame: {
    select: {
      id: true,
      sport: true,
      gameDate: true,
      startTime: true,
      endTime: true,
      facility: { select: { name: true } },
    },
  },
};

function serialiseThread(c: any, currentUserId: string) {
  const og = c.openGame ?? null;
  const game = og
    ? {
        sport: og.sport as string,
        facility: og.facility?.name ?? null,
        date:
          og.gameDate instanceof Date
            ? og.gameDate.toISOString().split("T")[0]
            : (og.gameDate ?? null),
        startTime: og.startTime ?? null,
        endTime: og.endTime ?? null,
      }
    : null;

  return {
    id: c.id,
    context: c.context,
    openGameId: c.openGameId ?? null,
    title: c.title ?? null,
    participants: c.participants,
    otherParticipants: (c.participants as any[]).filter((p: any) => p.userId !== currentUserId),
    lastMessage: c.messages?.[0] ?? null,
    unreadCount: c.unreadCount ?? 0,
    game,
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}
