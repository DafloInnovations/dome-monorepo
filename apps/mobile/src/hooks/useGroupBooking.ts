import { useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface GroupBookingResult {
  groupId: string;
  clientSecret: string;
  paymentIntentId: string;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  lockExpiresInSeconds: number;
}

export function useGroupBooking() {
  const { getValidToken } = useAuthToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGroupBooking(payload: {
    slotIds: string[];
    facilityId: string;
    notes?: string;
  }): Promise<{ result: GroupBookingResult; token: string }> {
    setLoading(true);
    setError(null);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/group`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        const err = Object.assign(
          new Error(body.message ?? `Group booking failed (HTTP ${res.status})`),
          { status: res.status, serverMessage: body.message }
        );
        setError(err.message);
        throw err;
      }
      const json = (await res.json()) as { data: GroupBookingResult };
      return { result: json.data, token };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Group booking failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function cancelGroupLock(groupId: string, token: string) {
    await fetch(`${API_URL}/bookings/group/${groupId}/cancel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: "Lock released by user" }),
    }).catch(() => {});
  }

  return { createGroupBooking, cancelGroupLock, loading, error };
}
