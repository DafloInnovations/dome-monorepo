import { useCallback, useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface CancelPreview {
  hoursUntilSlot: number;
  withinFreeWindow: boolean;
  refundType: "STRIPE_REFUND" | "DOME_CREDITS" | "NO_REFUND";
  refundAmount: number;
  message: string;
}

export interface CancelResult {
  refundType: "full" | "credits" | "none";
  creditsIssuedCAD: number | null;
  refundedCAD: number | null;
}

export function useCancellation() {
  const { getValidToken } = useAuthToken();
  const [preview, setPreview] = useState<CancelPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCancelPreview = useCallback(async (bookingId: string) => {
    setIsLoadingPreview(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/${bookingId}/cancel-preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: CancelPreview };
      setPreview(json.data);
      return json.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load cancellation info";
      setError(msg);
      throw e;
    } finally {
      setIsLoadingPreview(false);
    }
  }, [getValidToken]);

  const cancelBooking = useCallback(async (
    bookingId: string,
    reason?: string,
    groupId?: string | null,
  ): Promise<CancelResult> => {
    setIsCancelling(true);
    setError(null);
    try {
      const token = await getValidToken();
      const url = groupId
        ? `${API_URL}/bookings/group/${groupId}/cancel`
        : `${API_URL}/bookings/${bookingId}/cancel`;
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { data: CancelResult };
      return json.data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cancellation failed";
      setError(msg);
      throw e;
    } finally {
      setIsCancelling(false);
    }
  }, [getValidToken]);

  return { preview, isLoadingPreview, isCancelling, error, fetchCancelPreview, cancelBooking };
}
