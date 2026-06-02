import { useCallback, useEffect, useState } from "react";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCAD: number;
  status: "AVAILABLE" | "BOOKED" | "HELD";
}

export function useSlots(facilityId: string, date: string) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    if (!facilityId || !date) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/facilities/${facilityId}/slots?date=${date}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // API returns { data: { facilityId, date, slots: Slot[] } }
      const json = (await res.json()) as { data: { slots: Slot[] } };
      setSlots(json.data?.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  return { slots, isLoading, error, refetch: fetchSlots };
}
