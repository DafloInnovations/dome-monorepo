import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useStripe } from "../../src/lib/stripe";
import { useBooking } from "../../src/hooks/useBooking";
import { isStripeConfigured } from "../../src/config/stripe";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

// Parse "YYYY-MM-DD" as a LOCAL date (not UTC) and format for display.
// new Date("2026-06-01") is UTC midnight → shows May 31 in Canada.
// new Date(year, month-1, day) uses the device's local timezone.
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return dateStr;
  const [year, month, day] = parts as [number, number, number];
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const C = {
  bg: "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text: "#0A0A0A",
  muted: "#9E9E9E",
  chip: "#EBEBEB",
};

export default function BookingScreen() {
  const {
    slotId,
    facilityId,
    courtId,
    startTime,
    endTime,
    priceCAD,
    facilityName,
    facilityCity,
    sport,
    date,
  } = useLocalSearchParams<{
    slotId: string;
    facilityId: string;
    courtId: string;
    startTime: string;
    endTime: string;
    priceCAD: string;
    facilityName: string;
    facilityCity: string;
    sport: string;
    date: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { createBooking, loading, error } = useBooking();
  const [playerCount, setPlayerCount] = useState(1);
  const [confirming, setConfirming] = useState(false);

  // Track the pending booking so we can release the lock if the user backs out.
  // Using refs instead of state avoids stale closure issues inside the listener.
  const pendingBookingIdRef = useRef<string | null>(null);
  const pendingTokenRef = useRef<string | null>(null);
  // Set to true once Stripe confirms payment — at that point the slot must NOT
  // be released even if the backend confirm call fails (money was charged).
  const stripeSucceededRef = useRef(false);

  // Release the Redis lock and cancel the pending booking when the user
  // navigates away before completing payment.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      const bookingId = pendingBookingIdRef.current;
      const token = pendingTokenRef.current;
      if (bookingId && token && !stripeSucceededRef.current) {
        fetch(`${API_URL}/bookings/${bookingId}/lock`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {}); // fire-and-forget; don't block navigation
      }
    });
    return unsubscribe;
  }, [navigation]);

  const isBusy = loading || confirming;

  async function handleConfirmAndPay() {
    if (!slotId || !facilityId) return;
    if (!isStripeConfigured()) {
      Alert.alert(
        "Payment Setup Missing",
        "Stripe is not configured for this app build. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart Expo."
      );
      return;
    }
    try {
      // ── Step 1 & 2: create booking + payment intent ──────────────────────────
      // token is returned so we can reuse it for the confirm call without
      // a second getValidToken() invocation (avoids a second refresh attempt
      // that could send the already-rotated refresh token).
      const { booking, paymentIntent, token } = await createBooking({
        slotId,
        facilityId,
        playerCount,
      });
      // Store so the beforeRemove listener can release the lock if needed.
      pendingBookingIdRef.current = booking.id;
      pendingTokenRef.current = token;

      // ── Step 3: init Stripe payment sheet ────────────────────────────────────
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: paymentIntent.clientSecret,
        merchantDisplayName: "Dome Sports",
        style: "alwaysDark",
        defaultBillingDetails: { address: { country: "CA" } },
      });
      if (initError) {
        Alert.alert("Setup Error", initError.message);
        return;
      }

      // ── Step 4: present Stripe payment sheet ─────────────────────────────────
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") {
          Alert.alert("Payment Failed", presentError.message);
        }
        // Lock will be released by the beforeRemove listener when the user
        // navigates back (stripeSucceededRef is still false).
        return;
      }

      // Payment sheet succeeded — mark this so the beforeRemove listener
      // does NOT release the lock even if the user backs out from here.
      stripeSucceededRef.current = true;

      // ── Step 5: confirm booking in our backend ───────────────────────────────
      // Reuse the same token from step 1 — no additional getValidToken() call.
      setConfirming(true);
      const confirmRes = await fetch(
        `${API_URL}/bookings/${booking.id}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentIntentId: paymentIntent.paymentIntentId }),
        }
      );

      if (!confirmRes.ok) {
        Alert.alert(
          "Confirmation Error",
          "Payment received but booking confirmation failed. Please contact support.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)/bookings") }]
        );
        return;
      }

      // ── Step 6: navigate to success screen ───────────────────────────────────
      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: booking.id,
          facilityName: facilityName ?? "",
          facilityCity: facilityCity ?? "",
          sport: sport ?? "",
          date: date ?? "",
          startTime: startTime ?? "",
          endTime: endTime ?? "",
          totalCAD: String(paymentIntent.totalCAD ?? priceCAD ?? "0"),
        },
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      const serverMessage = (e as { serverMessage?: string }).serverMessage;

      if (status === 409) {
        Alert.alert(
          "⏱ Slot Temporarily Held",
          serverMessage || "This slot is temporarily held. Please try another time.",
          [
            { text: "Choose Another Slot", onPress: () => router.back() },
            { text: "OK", style: "cancel" },
          ]
        );
      } else if (status === 500) {
        Alert.alert(
          "Something Went Wrong",
          "Please try again.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
      // All other errors (network, auth) are shown via the inline `error` state from the hook.
    } finally {
      setConfirming(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Summary card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Summary</Text>
        {facilityName ? <SummaryRow label="Facility" value={facilityName} /> : null}
        {date ? <SummaryRow label="Date" value={formatDisplayDate(date)} /> : null}
        {startTime && endTime ? (
          <SummaryRow label="Time" value={`${startTime} – ${endTime}`} />
        ) : null}
        {priceCAD ? (
          <SummaryRow label="Price" value={`C$${priceCAD}`} highlight />
        ) : null}
      </View>

      {/* Player count card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Players</Text>
        <View style={styles.counterRow}>
          <Pressable
            style={[styles.counterBtn, playerCount <= 1 && styles.counterBtnDisabled]}
            onPress={() => setPlayerCount((p) => Math.max(1, p - 1))}
            disabled={isBusy}
          >
            <Text style={styles.counterBtnText}>−</Text>
          </Pressable>
          <Text style={styles.counterValue}>{playerCount}</Text>
          <Pressable
            style={[styles.counterBtn, playerCount >= 6 && styles.counterBtnDisabled]}
            onPress={() => setPlayerCount((p) => Math.min(6, p + 1))}
            disabled={isBusy}
          >
            <Text style={styles.counterBtnText}>+</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>1 – 6 players per slot</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {confirming ? (
        <View style={styles.confirmingRow}>
          <ActivityIndicator color={C.primary} size="small" />
          <Text style={styles.confirmingText}>Confirming booking…</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.payBtn, isBusy && styles.payBtnDisabled]}
        onPress={handleConfirmAndPay}
        disabled={isBusy}
      >
        {loading ? (
          <ActivityIndicator color={C.text} />
        ) : (
          <Text style={styles.payBtnText}>Confirm & Pay</Text>
        )}
      </Pressable>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[styles.rowValue, highlight && styles.rowValueHighlight]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, padding: 16 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
  },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowValue: { color: C.text, fontSize: 14, fontWeight: "600", maxWidth: "58%" },
  rowValueHighlight: { color: C.primary },
  counterRow: { flexDirection: "row", alignItems: "center", gap: 28, marginBottom: 10 },
  counterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled: { opacity: 0.35 },
  counterBtnText: { color: C.text, fontSize: 22, fontWeight: "600" },
  counterValue: {
    color: C.text,
    fontSize: 26,
    fontWeight: "700",
    minWidth: 36,
    textAlign: "center",
  },
  hint: { color: C.muted, fontSize: 12 },
  errorText: { color: "#EF4444", fontSize: 14, textAlign: "center", marginBottom: 14 },
  confirmingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14,
  },
  confirmingText: { color: C.muted, fontSize: 14 },
  payBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: "auto",
    marginBottom: 8,
  },
  payBtnDisabled: { opacity: 0.55 },
  payBtnText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
