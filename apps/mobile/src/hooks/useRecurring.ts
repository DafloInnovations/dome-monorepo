import { useCallback, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export type RecurringFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type RecurringPaymentModel = "PAY_PER_SESSION" | "PAY_UPFRONT";
export type RecurringSeriesStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";

export interface RecurringSeries {
  id: string;
  facilityId: string;
  courtId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  durationMinutes: number;
  frequency: RecurringFrequency;
  daysOfWeek: number[];
  totalOccurrences: number;
  completedOccurrences: number;
  pricePerSessionCAD: number;
  discountPercent: number;
  paymentModel: RecurringPaymentModel;
  status: RecurringSeriesStatus;
  nextOccurrence: string | null;
  remainingSessions: number;
  totalPaidCAD: number;
  facility: { id: string; name: string; address: { city: string; province: string } | null };
  court: { id: string; name: string; unitLabel: string };
}

export interface CreateRecurringResult {
  series: RecurringSeries;
  occurrences: string[];
  pricePerSessionCAD: number;
  discountPercent: number;
  subtotalCAD: number;
  discountCAD: number;
  taxCAD: number;
  totalCAD: number;
  savedCAD: number;
  clientSecret: string | null;
  paymentIntentId: string;
  firstBookingId: string | null;
  paymentModel: RecurringPaymentModel;
}

export interface CreateRecurringInput {
  facilityId: string;
  courtId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  durationMinutes: number;
  frequency: RecurringFrequency;
  daysOfWeek: number[];
  paymentModel: RecurringPaymentModel;
}

export function useRecurring() {
  const { getValidToken, checkResponse } = useAuthToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRecurringSeries = useCallback(async (input: CreateRecurringInput): Promise<{ result: CreateRecurringResult; token: string }> => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/bookings/recurring`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    checkResponse(res);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
    }
    const json = (await res.json()) as { data: CreateRecurringResult };
    return { result: json.data, token };
  }, [getValidToken, checkResponse]);

  const confirmRecurringSeries = useCallback(async (seriesId: string, paymentIntentId: string, token: string) => {
    const res = await fetch(`${API_URL}/bookings/recurring/${seriesId}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    checkResponse(res);
    if (!res.ok) throw new Error("Failed to confirm recurring series");
    return (await res.json()) as { data: unknown };
  }, [checkResponse]);

  const fetchRecurringSeries = useCallback(async (): Promise<RecurringSeries[]> => {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/recurring`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      checkResponse(res);
      const json = (await res.json()) as { data: RecurringSeries[] };
      return json.data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      return [];
    } finally {
      setLoading(false);
    }
  }, [getValidToken, checkResponse]);

  const cancelSeries = useCallback(async (seriesId: string, cancelFrom: string, reason?: string) => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/bookings/recurring/${seriesId}/cancel`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cancelFrom, reason }),
    });
    checkResponse(res);
    if (!res.ok) throw new Error("Failed to cancel series");
    return (await res.json()) as { data: { cancelledCount: number; refundedCAD: number } };
  }, [getValidToken, checkResponse]);

  const pauseSeries = useCallback(async (seriesId: string, pauseUntil: string) => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/bookings/recurring/${seriesId}/pause`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pauseUntil }),
    });
    checkResponse(res);
    if (!res.ok) throw new Error("Failed to pause series");
    return (await res.json()) as { data: unknown };
  }, [getValidToken, checkResponse]);

  return { createRecurringSeries, confirmRecurringSeries, fetchRecurringSeries, cancelSeries, pauseSeries, loading, error };
}
