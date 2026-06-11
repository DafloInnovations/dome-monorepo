import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PendingBookingInfo } from "../components/ResumePaymentBanner";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const STORAGE_KEY = "dome_pending_booking_v1";
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface StoredPendingBooking extends PendingBookingInfo {
  expiresAt: number;
}

export async function savePendingBooking(info: Omit<StoredPendingBooking, "expiresAt">) {
  const stored: StoredPendingBooking = {
    ...info,
    expiresAt: Date.now() + PENDING_TTL_MS,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export async function clearPendingBooking() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function readStoredPending(): Promise<StoredPendingBooking | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredPendingBooking;
    if (Date.now() > stored.expiresAt) {
      await clearPendingBooking();
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

export function usePendingBooking() {
  const [pending, setPending] = useState<StoredPendingBooking | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const { getValidToken } = useAuthToken();
  const checkedRef = useRef(false);

  const check = useCallback(async () => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const stored = await readStoredPending();
    if (!stored) return;

    setIsChecking(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/bookings/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        await clearPendingBooking();
        return;
      }
      const { data } = (await res.json()) as { data: PendingBookingInfo | null };
      if (!data) {
        await clearPendingBooking();
        return;
      }
      // Merge server data (more authoritative) with stored info
      setPending({ ...stored, ...data, expiresAt: stored.expiresAt });
    } catch {
      // No network — show stored banner anyway (optimistic)
      setPending(stored);
    } finally {
      setIsChecking(false);
    }
  }, [getValidToken]);

  useEffect(() => { check(); }, [check]);

  const dismiss = useCallback(async () => {
    setPending(null);
    await clearPendingBooking();
  }, []);

  // Returns { clientSecret } on success, throws on slot taken
  const extendLock = useCallback(async (bookingId: string): Promise<string | null> => {
    const token = await getValidToken();
    const res = await fetch(`${API_URL}/bookings/${bookingId}/extend-lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      if (body.code === "SLOT_TAKEN") {
        await clearPendingBooking();
        setPending(null);
      }
      throw new Error(body.message ?? `HTTP ${res.status}`);
    }
    const { data } = (await res.json()) as { data: { extended: boolean; clientSecret: string | null } };
    return data.clientSecret;
  }, [getValidToken]);

  return {
    pending,
    isChecking,
    isResuming,
    setIsResuming,
    dismiss,
    extendLock,
    refetch: () => { checkedRef.current = false; check(); },
  };
}
