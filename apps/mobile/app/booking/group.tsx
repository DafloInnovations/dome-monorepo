import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { useGroupBooking } from "../../src/hooks/useGroupBooking";
import { isStripeConfigured } from "../../src/config/stripe";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return dateStr;
  const [year, month, day] = parts as [number, number, number];
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const C = {
  bg: "#000000", primary: "#E85068", surface: "#1C1C1E",
  text: "#FFFFFF", muted: "#6B6B6B", chip: "#2C2C2E",
};

export default function GroupBookingScreen() {
  const {
    slotIds: slotIdsParam,
    facilityId,
    facilityName,
    date,
    totalCAD: totalCADParam,
    slotSummary,
  } = useLocalSearchParams<{
    slotIds: string;
    facilityId: string;
    facilityName: string;
    date: string;
    totalCAD: string;
    slotSummary: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { createGroupBooking, cancelGroupLock, loading, error } = useGroupBooking();
  const [confirming, setConfirming] = useState(false);

  const pendingGroupIdRef = useRef<string | null>(null);
  const pendingTokenRef = useRef<string | null>(null);
  const stripeSucceededRef = useRef(false);

  const slotIds = slotIdsParam?.split(",").filter(Boolean) ?? [];
  const displayTotal = totalCADParam ? parseFloat(totalCADParam) : 0;
  const slotLabels = slotSummary?.split(",").map((s) => s.trim()) ?? [];

  // Release all slot locks if user backs out before payment
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      const groupId = pendingGroupIdRef.current;
      const token = pendingTokenRef.current;
      if (groupId && token && !stripeSucceededRef.current) {
        cancelGroupLock(groupId, token);
      }
    });
    return unsubscribe;
  }, [navigation, cancelGroupLock]);

  const isBusy = loading || confirming;

  async function handleConfirmAndPay() {
    if (!slotIds.length || !facilityId) return;
    if (!isStripeConfigured()) {
      Alert.alert(
        "Payment Setup Missing",
        "Stripe is not configured for this app build. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart Expo."
      );
      return;
    }
    try {
      const { result, token } = await createGroupBooking({ slotIds, facilityId });
      pendingGroupIdRef.current = result.groupId;
      pendingTokenRef.current = token;

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: result.clientSecret,
        merchantDisplayName: "Dome Sports",
        style: "alwaysDark",
        defaultBillingDetails: { address: { country: "CA" } },
      });
      if (initError) { Alert.alert("Setup Error", initError.message); return; }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== "Canceled") Alert.alert("Payment Failed", presentError.message);
        return;
      }

      stripeSucceededRef.current = true;
      setConfirming(true);

      const confirmRes = await fetch(
        `${API_URL}/bookings/group/${result.groupId}/confirm`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId: result.paymentIntentId }),
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

      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: result.groupId,
          facilityName: facilityName ?? "",
          date: date ?? "",
          startTime: slotLabels[0] ?? "",
          endTime: "",
          totalCAD: String(result.totalCAD),
        },
      });
    } catch (e) {
      const status = (e as { status?: number }).status;
      const serverMessage = (e as { serverMessage?: string }).serverMessage;
      if (status === 409) {
        Alert.alert(
          "⏱ Slot Unavailable",
          serverMessage ?? "One or more slots are no longer available.",
          [{ text: "Choose Different Slots", onPress: () => router.back() }, { text: "OK", style: "cancel" }]
        );
      }
    } finally {
      setConfirming(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Summary card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Group Booking Summary</Text>
        {facilityName ? <SummaryRow label="Facility" value={facilityName} /> : null}
        {date ? <SummaryRow label="Date" value={formatDisplayDate(date)} /> : null}
        <SummaryRow label="Courts" value={`${slotIds.length} selected`} />
      </View>

      {/* Selected slots */}
      {slotLabels.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected Time Slots</Text>
          {slotLabels.map((label, i) => (
            <View key={i} style={styles.slotRow}>
              <View style={styles.slotDot} />
              <Text style={styles.slotLabel}>Court {i + 1}: {label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Total */}
      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>C${displayTotal.toFixed(2)}</Text>
        </View>
        <Text style={styles.hint}>Taxes calculated at checkout</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {confirming ? (
        <View style={styles.confirmingRow}>
          <ActivityIndicator color={C.primary} size="small" />
          <Text style={styles.confirmingText}>Confirming bookings…</Text>
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
          <Text style={styles.payBtnText}>
            Confirm & Pay C${displayTotal.toFixed(2)}
          </Text>
        )}
      </Pressable>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 20, marginBottom: 14 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowValue: { color: C.text, fontSize: 14, fontWeight: "600", maxWidth: "58%" },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  slotDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  slotLabel: { color: C.text, fontSize: 14 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { color: C.muted, fontSize: 16 },
  totalValue: { color: C.primary, fontSize: 22, fontWeight: "800" },
  hint: { color: C.muted, fontSize: 12, marginTop: 6 },
  errorText: { color: "#ff6b6b", fontSize: 14, textAlign: "center", marginBottom: 14 },
  confirmingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 },
  confirmingText: { color: C.muted, fontSize: 14 },
  payBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  payBtnDisabled: { opacity: 0.55 },
  payBtnText: { color: C.text, fontSize: 17, fontWeight: "700" },
});
