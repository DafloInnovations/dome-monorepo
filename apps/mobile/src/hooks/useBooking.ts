import { useState } from "react";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

export interface BookingPayload {
  slotId: string;
  facilityId: string;
  playerCount: number;
}

export interface Booking {
  id: string;
  slotId: string;
  facilityId: string;
  userId: string;
  playerCount: number;
  subtotalCAD: number;
  taxCAD: number;
  totalCAD: number;
  status: string;
  paymentStatus: string;
}

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amountCAD: number;
  taxCAD: number;
  totalCAD: number;
}

export function useBooking() {
  const { getValidToken, checkResponse } = useAuthToken();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBooking(
    payload: BookingPayload
  ): Promise<{ booking: Booking; paymentIntent: PaymentIntent; token: string }> {
    setLoading(true);
    setError(null);
    try {
      // Validate (and silently refresh) the access token before any call.
      const token = await getValidToken();

      console.log('=== BOOKING PAYLOAD ===');
      console.log('slotId:', payload.slotId);
      console.log('facilityId:', payload.facilityId);
      console.log('playerCount:', payload.playerCount);
      console.log('token:', token ? token.substring(0, 20) + '...' : 'MISSING');
      console.log('API URL:', `${process.env["EXPO_PUBLIC_API_URL"]}/bookings`);
      console.log('======================');

      const bookingRes = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!bookingRes.ok) {
        let serverMessage: string | undefined;
        try {
          const body = (await bookingRes.json()) as { message?: string };
          serverMessage = body.message;
        } catch {}
        await checkResponse(bookingRes); // handles 404 "user not found" → auto-logout
        const err = Object.assign(
          new Error(serverMessage ?? `Booking failed (HTTP ${bookingRes.status})`),
          { status: bookingRes.status, serverMessage }
        );
        setError(err.message);
        throw err;
      }

      const bookingJson = (await bookingRes.json()) as { data: Booking };

      const paymentRes = await fetch(`${API_URL}/payments/intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId: bookingJson.data.id }),
      });
      if (!paymentRes.ok) {
        await checkResponse(paymentRes);
        throw new Error(`Payment intent failed (HTTP ${paymentRes.status})`);
      }
      const paymentJson = (await paymentRes.json()) as { data: PaymentIntent };

      return { booking: bookingJson.data, paymentIntent: paymentJson.data, token };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Booking failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }

  return { createBooking, loading, error };
}
