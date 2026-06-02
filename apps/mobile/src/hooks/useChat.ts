import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MessageSender {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  sender: MessageSender;
}

export interface ThreadParticipant {
  userId: string;
  user: MessageSender;
}

export interface ThreadGame {
  sport: string;
  facility: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface ChatThread {
  id: string;
  openGameId: string | null;
  title: string | null;
  participants: ThreadParticipant[];
  otherParticipants: ThreadParticipant[];
  lastMessage: (ChatMessage & { sender: { firstName: string; lastName: string } }) | null;
  unreadCount: number;
  game: ThreadGame | null;
  updatedAt: string;
}

// ─── Thread list hook ─────────────────────────────────────────────────────────

export function useThreads() {
  const { getValidToken } = useAuthToken();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/chat/threads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: ChatThread[] };
      setThreads(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chats");
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken]);

  useEffect(() => { fetchThreads(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { threads, isLoading, error, refetch: fetchThreads };
}

// ─── Create / open a thread ───────────────────────────────────────────────────

export function useOpenThread() {
  const { getValidToken } = useAuthToken();
  const [isLoading, setIsLoading] = useState(false);

  const openThread = useCallback(async (participantId: string, gameId?: string): Promise<ChatThread> => {
    setIsLoading(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/chat/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participantId, gameId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: ChatThread };
      return json.data;
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken]);

  return { openThread, isLoading };
}

// ─── Chat screen hook ─────────────────────────────────────────────────────────

export function useChat(threadId: string) {
  const { socket, isConnected } = useSocket();
  const { getValidToken } = useAuthToken();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Load history via REST
  const loadMessages = useCallback(async (p = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/chat/threads/${threadId}/messages?page=${p}&limit=40`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        data: ChatMessage[];
        hasMore: boolean;
        page: number;
      };
      if (p === 1) {
        setMessages(json.data);
      } else {
        setMessages((prev) => [...json.data, ...prev]);
      }
      setHasMore(json.hasMore);
      setPage(json.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [threadId, getValidToken]);

  // Load older messages (pagination)
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    loadMessages(page + 1);
  }, [hasMore, isLoading, loadMessages, page]);

  // Join room + listen for events
  useEffect(() => {
    if (!socket || !isConnected || !threadId) return;

    socket.emit("join_thread", threadId);

    const handleNewMessage = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => new Set([...prev, userId]));
    };

    const handleStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleTyping);
    socket.on("user_stopped_typing", handleStopTyping);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleTyping);
      socket.off("user_stopped_typing", handleStopTyping);
    };
  }, [socket, isConnected, threadId]);

  // Initial load
  useEffect(() => { loadMessages(1); }, [loadMessages]);

  // Send via socket, fall back to REST
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    setIsSending(true);
    try {
      if (socket?.connected) {
        socket.emit("send_message", { threadId, content: content.trim() });
      } else {
        const token = await getValidToken();
        const res = await fetch(`${API_URL}/chat/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: ChatMessage };
        setMessages((prev) => [...prev, json.data]);
      }
    } finally {
      setIsSending(false);
    }
  }, [socket, threadId, getValidToken]);

  const emitTypingStart = useCallback(() => {
    socket?.emit("typing_start", threadId);
  }, [socket, threadId]);

  const emitTypingStop = useCallback(() => {
    socket?.emit("typing_stop", threadId);
  }, [socket, threadId]);

  const markRead = useCallback(() => {
    socket?.emit("mark_read", threadId);
  }, [socket, threadId]);

  return {
    messages,
    isLoading,
    isSending,
    error,
    hasMore,
    typingUsers,
    loadMore,
    sendMessage,
    emitTypingStart,
    emitTypingStop,
    markRead,
  };
}
