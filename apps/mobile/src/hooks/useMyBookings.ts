import { useCallback, useEffect, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface BookingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCAD: number;
  court: { id: string; name: string } | null;
}

export interface BookingFacility {
  id: string;
  name: string;
  sport: string;
  address: { street: string; city: string; province: string } | null;
}

export interface MyBooking {
  id: string;
  status: string;
  paymentStatus: string;
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
  createdAt: string;
  slot: BookingSlot;
  facility: BookingFacility;
  review?: { id: string } | null;
}

export function useMyBookings() {
  const { getValidToken, checkResponse } = useAuthToken();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await checkResponse(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: MyBooking[] };
      setBookings(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bookings");
    } finally {
      setIsLoading(false);
    }
  }, [getValidToken, checkResponse]);

  // Empty deps: fetch once on mount. Subsequent fetches are triggered
  // explicitly via refetch() (pull-to-refresh, screen focus, etc.).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBookings(); }, []);

  return { bookings, isLoading, error, refetch: fetchBookings };
}
