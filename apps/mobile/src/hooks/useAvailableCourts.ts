import { useCallback, useEffect, useState } from "react";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface PriceBreakdown {
  basePriceCAD: number;
  appliedRule: string | null;
  finalPriceCAD: number;
}

export interface AvailableCourt {
  id: string;
  name: string;
  unitType: string;
  unitLabel: string;
  sport: string;
  surface: string;
  totalPriceCAD: number;
  basePriceCAD: number;
  priceBreakdown: PriceBreakdown | null;
  isAvailable: boolean;
  notCovered: boolean;
  slots: string[];
  bookedUntil: string | null;
}

export interface AvailableCourtsResult {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  courts: AvailableCourt[];
}

export function useAvailableCourts(
  facilityId: string,
  date: string,
  startTime: string,
  durationMinutes: number
) {
  const [result, setResult] = useState<AvailableCourtsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!facilityId || !date || !startTime || durationMinutes < 30) return;
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        date,
        startTime,
        duration: String(durationMinutes),
      });
      const res = await fetch(`${API_URL}/facilities/${facilityId}/available-courts?${qs}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: AvailableCourtsResult };
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load courts");
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, date, startTime, durationMinutes]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { result, isLoading, error, refetch: fetch_ };
}
