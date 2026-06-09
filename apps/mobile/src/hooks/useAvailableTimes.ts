import { useCallback, useEffect, useState } from "react";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface AvailableTimeSlot {
  time: string;
  label: string;
  availableCourts: number;
  totalCourts: number;
  status: "AVAILABLE" | "PARTIAL" | "BOOKED";
}

export interface AvailableTimesResult {
  date: string;
  duration: number;
  availableTimes: AvailableTimeSlot[];
  firstAvailableTime: string | null;
  lastAvailableTime: string | null;
}

export function useAvailableTimes(
  facilityId: string,
  date: string,
  durationMinutes: number
) {
  const [result, setResult]     = useState<AvailableTimesResult | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!facilityId || !date || durationMinutes < 30) return;
    setLoading(true);
    setError(null);
    try {
      const qs  = new URLSearchParams({ date, duration: String(durationMinutes) });
      const res = await fetch(`${API_URL}/facilities/${facilityId}/available-times?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: AvailableTimesResult };
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load times");
    } finally {
      setLoading(false);
    }
  }, [facilityId, date, durationMinutes]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { result, isLoading, error, refetch: fetch_ };
}
