import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useAuthToken } from "../hooks/useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const POLL_MS = 30_000;

interface NotificationsContextValue {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getValidToken } = useAuthToken();
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { count: number };
      setUnreadCount(json.count ?? 0);
    } catch {
      // Non-fatal — badge will stay at last known value
    }
  }, [user, getValidToken]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    fetchCount();
    timerRef.current = setInterval(fetchCount, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [user, fetchCount]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refreshUnreadCount: fetchCount }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext() {
  return useContext(NotificationsContext);
}
