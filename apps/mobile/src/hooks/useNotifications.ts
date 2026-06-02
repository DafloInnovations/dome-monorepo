import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";
import { useNotificationsContext } from "../context/NotificationsContext";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const { getValidToken } = useAuthToken();
  const { unreadCount, refreshUnreadCount } = useNotificationsContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: AppNotification[] };
      setNotifications(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const token = await getValidToken();
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      refreshUnreadCount();
    } catch {
      // Non-fatal
    }
  }, [getValidToken, refreshUnreadCount]);

  const markAllRead = useCallback(async () => {
    try {
      const token = await getValidToken();
      await fetch(`${API_URL}/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      refreshUnreadCount();
    } catch {
      // Non-fatal
    }
  }, [getValidToken, refreshUnreadCount]);

  useEffect(() => { fetchNotifications(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllRead,
  };
}
