import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export type AlertStatus = "PENDING" | "TRIGGERED" | "EXPIRED" | "CANCELLED";

export interface AvailabilityAlert {
  id: string;
  facilityId: string;
  courtId: string | null;
  sport: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: AlertStatus;
  triggeredAt: string | null;
  expiresAt: string;
  createdAt: string;
  facility: { id: string; name: string; sport: string };
  court: { id: string; name: string } | null;
}

export interface CreateAlertData {
  facilityId: string;
  courtId?: string | null;
  sport?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export function useAlerts() {
  const { getValidToken } = useAuthToken();
  const [alerts, setAlerts] = useState<AvailabilityAlert[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(
    async (status?: AlertStatus) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getValidToken();
        const qs = status ? `?status=${status}` : "";
        const res = await fetch(`${API_URL}/alerts${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: AvailabilityAlert[] };
        setAlerts(json.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load alerts");
      } finally {
        setLoading(false);
      }
    },
    [getValidToken]
  );

  const fetchAlertCount = useCallback(async () => {
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/alerts/count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const json = (await res.json()) as { data: { pending: number } };
      setPendingCount(json.data.pending);
    } catch {
      // non-fatal
    }
  }, [getValidToken]);

  const createAlert = useCallback(
    async (data: CreateAlertData): Promise<AvailabilityAlert> => {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { data: AvailabilityAlert; message?: string };
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      setPendingCount((c) => c + 1);
      return json.data;
    },
    [getValidToken]
  );

  const cancelAlert = useCallback(
    async (alertId: string): Promise<void> => {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/alerts/${alertId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(json.message ?? `HTTP ${res.status}`);
      }
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: "CANCELLED" as AlertStatus } : a))
      );
      setPendingCount((c) => Math.max(0, c - 1));
    },
    [getValidToken]
  );

  useEffect(() => {
    fetchAlertCount();
  }, [fetchAlertCount]);

  return {
    alerts,
    pendingCount,
    loading,
    error,
    fetchAlerts,
    fetchAlertCount,
    createAlert,
    cancelAlert,
  };
}
