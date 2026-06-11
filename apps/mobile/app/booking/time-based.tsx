import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStripe } from "../../src/lib/stripe";
import { useAuthToken } from "../../src/hooks/useAuthToken";
import { isStripeConfigured } from "../../src/config/stripe";
import { useEquipment } from "../../src/hooks/useEquipment";
import { useCoupon } from "../../src/hooks/useCoupon";
import { useCredits, calcCreditSplit } from "../../src/hooks/useCredits";
import EquipmentItemRow from "../../src/components/EquipmentItem";
import { savePendingBooking, clearPendingBooking } from "../../src/hooks/usePendingBooking";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const C = {
  bg: "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text: "#0A0A0A",
  muted: "#9E9E9E",
  chip: "#EBEBEB",
};

interface TimeBookingResult {
  type: "single" | "group";
  bookingId: string | null;
  groupId: string | null;
  resumed?: boolean;
  fullyPaidWithCredits: boolean;
  clientSecret: string | null;
  paymentIntentId: string | null;
  totalCAD: number;
  subtotalCAD: number;
  taxCAD: number;
  creditsAppliedCAD: number;
  cardChargeCAD: number;
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

  const courtPrice = Number(totalPrice ?? 0);
  const subtotal = Math.round((courtPrice + (equipmentTotalCAD ?? 0)) * 100) / 100;

  const coupon = useCoupon(facilityId ?? "", subtotal);
  const credits = useCredits();
  const [useCreditsToggle, setUseCreditsToggle] = useState(false);
  const [creditsPartialInput, setCreditsPartialInput] = useState("");
  const [creditsMode, setCreditsMode] = useState<"all" | "partial">("all");

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
      clearPendingBooking().catch(() => null);
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
        body: JSON.stringify({
          slotIds,
          facilityId,
          useCredits: useCreditsToggle && creditsAvailable > 0,
          creditsToUse: creditsMode === "partial" && creditsPartialAmt > 0 ? creditsPartialAmt : undefined,
          couponCode: coupon.applied?.code,
        }),
      });
      checkResponse(bookRes);
      if (!bookRes.ok) {
        const body = (await bookRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${bookRes.status}`);
      }
      const { data: bookingResult } = (await bookRes.json()) as { data: TimeBookingResult };
      bookingResultRef.current = bookingResult;

      // 2. Add equipment if selected (updates PaymentIntent amount server-side)
      if (equipmentItems.length > 0 && bookingResult.bookingId && !bookingResult.fullyPaidWithCredits) {
        await addEquipmentToBooking(bookingResult.bookingId);
      }

      // 3a. Fully paid with credits — booking already confirmed server-side
      if (bookingResult.fullyPaidWithCredits) {
        stripeSucceededRef.current = true;
        setIsCreating(false);
        await clearPendingBooking();
        credits.refetch();
        const confirmedId = bookingResult.bookingId ?? bookingResult.groupId ?? "";
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
            creditsUsed: String(bookingResult.creditsAppliedCAD),
          },
        } as Parameters<typeof router.replace>[0]);
        return;
      }

      // 3b. Partial credits or no credits — save pending booking, then show Stripe sheet
      if (bookingResult.bookingId && bookingResult.paymentIntentId) {
        await savePendingBooking({
          bookingId: bookingResult.bookingId,
          facilityName: facilityName ?? "",
          sport: sport ?? "",
          date: date ?? "",
          startTime: startTime ?? "",
          endTime: endTime ?? "",
          totalCAD: bookingResult.totalCAD,
          paymentIntentId: bookingResult.paymentIntentId,
        });
      }

      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: bookingResult.clientSecret!,
        merchantDisplayName: "Dome Sports",
        style: "alwaysDark",
      });
      if (initErr) throw new Error(initErr.message);

      setIsCreating(false);

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

      await clearPendingBooking();
      credits.refetch();
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

  const discountCAD = coupon.discountCAD;
  const discountedSubtotal = Math.max(0, Math.round((subtotal - discountCAD) * 100) / 100);
  const estimatedTax = Math.round(discountedSubtotal * 0.13 * 100) / 100;
  const estimatedTotal = Math.round((discountedSubtotal + estimatedTax) * 100) / 100;

  // Credits calculation
  const creditsAvailable = credits.availableBalance;
  const creditsPartialAmt = parseFloat(creditsPartialInput) || 0;
  const creditsToUse = useCreditsToggle
    ? (creditsMode === "all" ? null : creditsPartialAmt)
    : null;
  const { creditsApplied, cardCharge } = useCreditsToggle && creditsAvailable > 0
    ? calcCreditSplit(estimatedTotal, creditsAvailable, creditsToUse)
    : { creditsApplied: 0, cardCharge: estimatedTotal };
  const fullyByCredits = cardCharge === 0 && creditsApplied > 0;

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

      {/* Dome Credits — only shown when balance > 0 */}
      {creditsAvailable > 0 && (
        <View style={styles.card}>
          <View style={styles.creditsHeader}>
            <View style={styles.creditsHeaderLeft}>
              <Text style={styles.cardTitle}>💳 Dome Credits</Text>
              <Text style={styles.creditsBalance}>C${creditsAvailable.toFixed(2)} available</Text>
            </View>
            <Switch
              value={useCreditsToggle}
              onValueChange={(v) => {
                setUseCreditsToggle(v);
                if (!v) setCreditsMode("all");
              }}
              trackColor={{ false: C.chip, true: C.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {useCreditsToggle && (
            <>
              {/* Mode selector */}
              <View style={styles.creditsModeRow}>
                <Pressable
                  style={[styles.creditsModeBtn, creditsMode === "all" && styles.creditsModeBtnActive]}
                  onPress={() => setCreditsMode("all")}
                >
                  <Text style={[styles.creditsModeBtnText, creditsMode === "all" && styles.creditsModeBtnTextActive]}>
                    Use all (C${Math.min(creditsAvailable, estimatedTotal).toFixed(2)})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.creditsModeBtn, creditsMode === "partial" && styles.creditsModeBtnActive]}
                  onPress={() => setCreditsMode("partial")}
                >
                  <Text style={[styles.creditsModeBtnText, creditsMode === "partial" && styles.creditsModeBtnTextActive]}>
                    Use partial
                  </Text>
                </Pressable>
              </View>

              {creditsMode === "partial" && (
                <View style={styles.couponRow}>
                  <Text style={styles.creditsPartialLabel}>C$</Text>
                  <TextInput
                    style={[styles.couponInput, { flex: 1, fontFamily: undefined, letterSpacing: 0 }]}
                    placeholder="Amount to use"
                    placeholderTextColor={C.muted}
                    keyboardType="decimal-pad"
                    value={creditsPartialInput}
                    onChangeText={setCreditsPartialInput}
                  />
                </View>
              )}

              {/* Result preview */}
              <View style={styles.creditsSplit}>
                <View style={styles.creditsSplitRow}>
                  <Text style={styles.creditsSplitLabel}>💳 Credits applied</Text>
                  <Text style={styles.creditsSplitGreen}>−C${creditsApplied.toFixed(2)}</Text>
                </View>
                <View style={styles.creditsSplitRow}>
                  <Text style={styles.creditsSplitLabel}>
                    {fullyByCredits ? "✅ Charge to card" : "Card charge"}
                  </Text>
                  <Text style={fullyByCredits ? styles.creditsSplitGreen : styles.creditsSplitValue}>
                    C${cardCharge.toFixed(2)}
                  </Text>
                </View>
              </View>
            </>
          )}

          {credits.soonExpiring && (
            <Text style={styles.creditsExpiry}>
              ⚠️ C${Number(credits.soonExpiring.amountCAD).toFixed(2)} expires{" "}
              {new Date(credits.soonExpiring.expiresAt!).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
            </Text>
          )}
        </View>
      )}

      {/* Coupon */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎟️ Coupon</Text>

        {coupon.applied ? (
          <View style={styles.couponApplied}>
            <View style={styles.couponAppliedLeft}>
              <Text style={styles.couponCode}>{coupon.applied.code}</Text>
              {coupon.applied.description && (
                <Text style={styles.couponDesc}>{coupon.applied.description}</Text>
              )}
              <Text style={styles.couponSaving}>−C${coupon.applied.discountCAD.toFixed(2)} saved</Text>
            </View>
            <Pressable onPress={coupon.remove} style={styles.couponRemoveBtn} hitSlop={8}>
              <Text style={styles.couponRemoveText}>✕ Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.couponRow}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter coupon code..."
              placeholderTextColor={C.muted}
              value={coupon.inputCode}
              onChangeText={coupon.setInputCode}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={coupon.validate}
            />
            <Pressable
              onPress={coupon.validate}
              disabled={!coupon.inputCode.trim() || coupon.isValidating}
              style={[styles.couponApplyBtn, (!coupon.inputCode.trim() || coupon.isValidating) && styles.couponApplyBtnDisabled]}
            >
              {coupon.isValidating
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.couponApplyText}>Apply</Text>
              }
            </Pressable>
          </View>
        )}

        {coupon.error && (
          <Text style={styles.couponError}>{coupon.error}</Text>
        )}
      </View>

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
        {discountCAD > 0 && (
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: "#22C55E" }]}>
              Coupon ({coupon.applied?.code})
            </Text>
            <Text style={[styles.rowValue, { color: "#22C55E" }]}>−C${discountCAD.toFixed(2)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Subtotal</Text>
          <Text style={styles.rowValue}>C${discountedSubtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Tax (est.)</Text>
          <Text style={styles.rowValue}>C${estimatedTax.toFixed(2)}</Text>
        </View>
        <View style={creditsApplied > 0 ? styles.row : [styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>Total</Text>
          <Text style={styles.rowValueHighlight}>C${estimatedTotal.toFixed(2)}</Text>
        </View>
        {creditsApplied > 0 && (
          <>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: "#22C55E" }]}>💳 Credits applied</Text>
              <Text style={[styles.rowValue, { color: "#22C55E" }]}>−C${creditsApplied.toFixed(2)}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>
                {fullyByCredits ? "✅ Charge to card" : "Card charge"}
              </Text>
              <Text style={[styles.rowValue, { fontWeight: "800", color: fullyByCredits ? "#22C55E" : C.text }]}>
                C${cardCharge.toFixed(2)}
              </Text>
            </View>
          </>
        )}
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
            <ActivityIndicator color="#E85068" size="small" />
            <Text style={styles.payBtnText}>
              {isCreating ? "Reserving courts…" : "Confirming booking…"}
            </Text>
          </View>
        ) : fullyByCredits ? (
          <Text style={styles.payBtnText}>
            Confirm Booking — Pay C$0.00 💳
          </Text>
        ) : creditsApplied > 0 ? (
          <Text style={styles.payBtnText}>
            Pay C${cardCharge.toFixed(2)} by Card
          </Text>
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
    borderBottomColor: "#EBEBEB",
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
  payBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lockNote: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  // Credits
  creditsHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  creditsHeaderLeft: { flex: 1 },
  creditsBalance: { color: "#22C55E", fontSize: 15, fontWeight: "700" },
  creditsModeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  creditsModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.chip,
    alignItems: "center",
    backgroundColor: C.bg,
  },
  creditsModeBtnActive: { borderColor: C.primary, backgroundColor: "#FFF5F7" },
  creditsModeBtnText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  creditsModeBtnTextActive: { color: C.primary, fontWeight: "700" },
  creditsPartialLabel: { color: C.muted, fontSize: 15, alignSelf: "center", marginRight: 4 },
  creditsSplit: {
    marginTop: 12,
    backgroundColor: "#F1F8F1",
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  creditsSplitRow: { flexDirection: "row", justifyContent: "space-between" },
  creditsSplitLabel: { color: C.muted, fontSize: 13 },
  creditsSplitGreen: { color: "#22C55E", fontSize: 13, fontWeight: "700" },
  creditsSplitValue: { color: C.text, fontSize: 13, fontWeight: "700" },
  creditsExpiry: { color: "#F59E0B", fontSize: 11, marginTop: 8 },
  // Coupon
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.chip,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  couponApplyBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  couponApplyBtnDisabled: { opacity: 0.4 },
  couponApplyText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  couponError: { color: "#EF4444", fontSize: 12, marginTop: 6 },
  couponApplied: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#22C55E14",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#22C55E33",
  },
  couponAppliedLeft: { flex: 1, gap: 2 },
  couponCode: { color: "#22C55E", fontSize: 14, fontWeight: "800", fontFamily: "monospace" },
  couponDesc: { color: C.muted, fontSize: 12 },
  couponSaving: { color: "#22C55E", fontSize: 13, fontWeight: "700" },
  couponRemoveBtn: { paddingLeft: 12 },
  couponRemoveText: { color: C.muted, fontSize: 12, fontWeight: "600" },
});
