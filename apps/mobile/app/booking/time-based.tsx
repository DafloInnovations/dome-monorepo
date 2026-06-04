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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "../../src/lib/stripe";
import { useAuthToken } from "../../src/hooks/useAuthToken";
import { isStripeConfigured } from "../../src/config/stripe";
import { useEquipment } from "../../src/hooks/useEquipment";
import EquipmentItemRow from "../../src/components/EquipmentItem";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  chip: "#2C2C2E",
};

interface TimeBookingResult {
  type: "single" | "group";
  bookingId: string | null;
  groupId: string | null;
  clientSecret: string | null;
  paymentIntentId: string;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  lockExpiresInSeconds: number;
}

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function TimeBasedBookingScreen() {
  const {
    slotIds: slotIdsParam,
    facilityId,
    facilityName,
    facilityCity,
    sport,
    date,
    startTime,
    endTime,
    durationMinutes,
    courts: courtsParam,
    totalPrice,
  } = useLocalSearchParams<{
    slotIds: string;
    facilityId: string;
    facilityName: string;
    facilityCity: string;
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: string;
    courts: string;
    totalPrice: string;
  }>();

  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { getValidToken, checkResponse } = useAuthToken();

  const {
    equipment,
    loading: equipmentLoading,
    selected: equipmentSelected,
    selectedItems: equipmentItems,
    equipmentTotalCAD,
    setQuantity: setEquipmentQty,
    addToBooking: addEquipmentToBooking,
  } = useEquipment(facilityId ?? "", sport ?? "");

  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookingResultRef = useRef<TimeBookingResult | null>(null);
  const tokenRef = useRef<string | null>(null);
  const stripeSucceededRef = useRef(false);

  const slotIds = slotIdsParam?.split(",").filter(Boolean) ?? [];
  const courtNames: string[] = courtsParam ? (JSON.parse(courtsParam) as string[]) : [];

  // Release lock if user backs out before Stripe succeeds
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      if (stripeSucceededRef.current) return;
      const result = bookingResultRef.current;
      const token = tokenRef.current;
      if (!result || !token) return;

      const url = result.type === "single"
        ? `${API_URL}/bookings/${result.bookingId}/lock`
        : `${API_URL}/bookings/group/${result.groupId}/cancel`;
      const method = result.type === "single" ? "DELETE" : "PUT";
      fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: result.type === "group" ? JSON.stringify({ reason: "Abandoned checkout" }) : undefined,
      }).catch(() => null);
    });
    return unsubscribe;
  }, [navigation]);

  async function handleConfirmAndPay() {
    if (!slotIds.length || !facilityId) return;

    if (!isStripeConfigured()) {
      Alert.alert(
        "Payment Setup Missing",
        "Stripe is not configured. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY and restart."
      );
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const token = await getValidToken();
      tokenRef.current = token;

      // 1. Create time-based booking (locks slots + creates payment intent)
      const bookRes = await fetch(`${API_URL}/bookings/time-based`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ slotIds, facilityId }),
      });
      checkResponse(bookRes);
      if (!bookRes.ok) {
        const body = (await bookRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${bookRes.status}`);
      }
      const { data: bookingResult } = (await bookRes.json()) as { data: TimeBookingResult };
      bookingResultRef.current = bookingResult;

      // 2. Add equipment if selected (updates PaymentIntent amount server-side)
      if (equipmentItems.length > 0 && bookingResult.bookingId) {
        await addEquipmentToBooking(bookingResult.bookingId);
      }

      // 3. Init Stripe payment sheet (amount already updated by equipment step)
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: bookingResult.clientSecret!,
        merchantDisplayName: "Dome Sports",
        style: "alwaysDark",
      });
      if (initErr) throw new Error(initErr.message);

      setIsCreating(false);

      // 3. Present Stripe payment UI
      const { error: presentErr } = await presentPaymentSheet();
      if (presentErr) {
        if (presentErr.code === "Canceled") return;
        throw new Error(presentErr.message);
      }

      stripeSucceededRef.current = true;
      setIsConfirming(true);

      // 4. Confirm with backend
      const confirmUrl = bookingResult.type === "single"
        ? `${API_URL}/bookings/${bookingResult.bookingId}/confirm`
        : `${API_URL}/bookings/group/${bookingResult.groupId}/confirm`;

      const confirmRes = await fetch(confirmUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: bookingResult.paymentIntentId }),
      });
      checkResponse(confirmRes);
      if (!confirmRes.ok) {
        Alert.alert(
          "Payment Received",
          "Your payment was successful but we couldn't confirm the booking. Please contact support.",
          [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
        );
        return;
      }

      const confirmData = (await confirmRes.json()) as { data?: { id?: string; slot?: { startTime?: string; endTime?: string } } };
      const confirmedId = confirmData.data?.id ?? bookingResult.bookingId ?? bookingResult.groupId ?? "";
      router.replace({
        pathname: "/booking/success",
        params: {
          bookingId: confirmedId,
          facilityName: facilityName ?? "",
          facilityCity: facilityCity ?? "",
          sport: sport ?? "",
          date: date ?? "",
          startTime: startTime ?? "",
          endTime: endTime ?? "",
          totalCAD: String(bookingResult.totalCAD),
        },
      } as Parameters<typeof router.replace>[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      stripeSucceededRef.current = false;
    } finally {
      setIsCreating(false);
      setIsConfirming(false);
    }
  }

  const isLoading = isCreating || isConfirming;
  const durationMins = Number(durationMinutes ?? 60);
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const durationLabel = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

  const courtPrice = Number(totalPrice ?? 0);
  const subtotal = Math.round((courtPrice + equipmentTotalCAD) * 100) / 100;
  const estimatedTax = Math.round(subtotal * 0.13 * 100) / 100;
  const estimatedTotal = Math.round((subtotal + estimatedTax) * 100) / 100;

  function handleBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    router.replace("/(tabs)");
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack} hitSlop={10}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.facilityName} numberOfLines={1}>{facilityName}</Text>
        <Text style={styles.dateStr}>{date ? formatDisplayDate(date) : ""}</Text>
      </View>

      {/* Booking summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Details</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Time</Text>
          <Text style={styles.rowValue}>
            {startTime ? formatAmPm(startTime) : "—"} → {endTime ? formatAmPm(endTime) : "—"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Duration</Text>
          <Text style={styles.rowValue}>{durationLabel}</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>Courts</Text>
          <Text style={styles.rowValue}>{courtNames.length || slotIds.length}</Text>
        </View>

        {courtNames.length > 0 && (
          <View style={styles.courtList}>
            {courtNames.map((name, i) => (
              <View key={i} style={styles.courtItem}>
                <Text style={styles.courtBullet}>•</Text>
                <Text style={styles.courtName}>{name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Equipment upsell */}
      {equipment.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎒 Add Equipment (Optional)</Text>
          {equipmentLoading ? (
            <ActivityIndicator color={C.primary} size="small" style={{ marginVertical: 8 }} />
          ) : (
            equipment.map((item) => (
              <EquipmentItemRow
                key={item.id}
                item={item}
                quantity={equipmentSelected[item.id] ?? 0}
                onChangeQuantity={(qty) => setEquipmentQty(item.id, qty)}
              />
            ))
          )}
        </View>
      )}

      {/* Live price breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Price</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Court</Text>
          <Text style={styles.rowValue}>C${courtPrice.toFixed(2)}</Text>
        </View>
        {equipmentTotalCAD > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Equipment</Text>
            <Text style={styles.rowValue}>C${equipmentTotalCAD.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Subtotal</Text>
          <Text style={styles.rowValue}>C${subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tax (est.)</Text>
          <Text style={styles.rowValue}>C${estimatedTax.toFixed(2)}</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>Total</Text>
          <Text style={styles.rowValueHighlight}>C${estimatedTotal.toFixed(2)}</Text>
        </View>
        <Text style={styles.taxNote}>Exact tax calculated at checkout based on your province</Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* CTA */}
      <Pressable
        style={[styles.payBtn, isLoading && styles.payBtnDisabled]}
        onPress={handleConfirmAndPay}
        disabled={isLoading}
      >
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.payBtnText}>
              {isCreating ? "Reserving courts…" : "Confirming booking…"}
            </Text>
          </View>
        ) : (
          <Text style={styles.payBtnText}>
            Confirm & Pay — C${estimatedTotal.toFixed(2)}
          </Text>
        )}
      </Pressable>

      <Text style={styles.lockNote}>
        Courts will be held for 5 minutes while you complete payment
      </Text>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 16 },
  header: { marginBottom: 20 },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  backIcon: { color: C.primary, fontSize: 30, fontWeight: "500", lineHeight: 30 },
  backText: { color: C.text, fontSize: 16, fontWeight: "700" },
  facilityName: { color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  dateStr: { color: C.muted, fontSize: 14 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2C2C2E",
  },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowValue: { color: C.text, fontSize: 14, fontWeight: "600" },
  rowValueHighlight: { color: C.primary, fontSize: 16, fontWeight: "800" },
  courtList: { marginTop: 10, gap: 4 },
  courtItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  courtBullet: { color: C.primary, fontSize: 16 },
  courtName: { color: C.text, fontSize: 14 },
  taxNote: { color: C.muted, fontSize: 11, marginTop: 8 },
  errorBox: {
    backgroundColor: "#3B0000",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#FF6B6B", fontSize: 13 },
  payBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  payBtnDisabled: { opacity: 0.55 },
  payBtnText: { color: C.text, fontSize: 16, fontWeight: "800" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockNote: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
});
