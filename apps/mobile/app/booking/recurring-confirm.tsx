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
import { useStripe } from "../../src/lib/stripe";
import { isStripeConfigured } from "../../src/config/stripe";
import { useRecurring } from "../../src/hooks/useRecurring";

const C = {
  bg: "#FFFFFF", primary: "#E85068", surface: "#F8F8F8",
  text: "#0A0A0A", muted: "#9E9E9E", green: "#22c55e",
  border: "#F0F0F0",
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtAmPm(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const p = h! >= 12 ? "PM" : "AM";
  return `${h! % 12 || 12}:${String(m!).padStart(2, "0")} ${p}`;
}

function fmtDate(d: string): string {
  const [y, mo, day] = d.split("-").map(Number);
  return new Date(y!, mo! - 1, day!).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function RecurringConfirmScreen() {
  const {
    facilityId, facilityName, courtId, courtName,
    startDate, endDate, startTime, endTime,
    durationMinutes, frequency, daysOfWeek,
    paymentModel, pricePerSession, weeks, discount,
  } = useLocalSearchParams<Record<string, string>>();

  const router = useRouter();
  const navigation = useNavigation();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { createRecurringSeries, confirmRecurringSeries } = useRecurring();

  const [isCreating, setIsCreating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occurrences, setOccurrences] = useState<string[]>([]);

  const seriesIdRef = useRef<string | null>(null);
  const tokenRef    = useRef<string | null>(null);
  const piIdRef     = useRef<string | null>(null);
  const succeededRef = useRef(false);

  const priceNum   = Number(pricePerSession ?? 0);
  const weeksNum   = Number(weeks ?? 8);
  const discNum    = Number(discount ?? 0);
  const subtotal   = priceNum * weeksNum;
  const saved      = Math.round(subtotal * (discNum / 100) * 100) / 100;
  const total      = subtotal - saved;
  const dayNum     = Number(daysOfWeek ?? 1);

  // On back-out before Stripe succeeds → cancel series
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      if (succeededRef.current || !seriesIdRef.current || !tokenRef.current) return;
      fetch(`${process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1"}/bookings/recurring/${seriesIdRef.current}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
        body: JSON.stringify({ cancelFrom: "NOW", reason: "Abandoned checkout" }),
      }).catch(() => null);
    });
    return unsub;
  }, [navigation]);

  async function handleConfirmAndPay() {
    if (!facilityId || !courtId) return;
    if (!isStripeConfigured()) {
      Alert.alert("Payment Setup Missing", "Stripe is not configured.");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const { result, token } = await createRecurringSeries({
        facilityId,
        courtId,
        startDate: startDate!,
        endDate: endDate!,
        startTime: startTime!,
        durationMinutes: Number(durationMinutes ?? 60),
        frequency: (frequency as "WEEKLY" | "BIWEEKLY") ?? "WEEKLY",
        daysOfWeek: [dayNum],
        paymentModel: (paymentModel as "PAY_PER_SESSION" | "PAY_UPFRONT") ?? "PAY_PER_SESSION",
      });

      seriesIdRef.current = result.series.id;
      tokenRef.current = token;
      piIdRef.current = null;
      setOccurrences(result.occurrences);

      if (result.clientSecret) {
        const { error: initErr } = await initPaymentSheet({
          paymentIntentClientSecret: result.clientSecret,
          merchantDisplayName: "Dome Sports",
          style: "alwaysDark",
          setupIntentClientSecret: undefined,
        });
        if (initErr) throw new Error(initErr.message);
        setIsCreating(false);

        const { error: presentErr } = await presentPaymentSheet();
        if (presentErr) {
          if (presentErr.code === "Canceled") return;
          throw new Error(presentErr.message);
        }

        succeededRef.current = true;
        setIsConfirming(true);

        // Retrieve PI id from result metadata — passed back via confirm route
        await confirmRecurringSeries(result.series.id, result.paymentIntentId, token);
        router.replace("/booking/success");
      } else {
        // No client secret = something went wrong
        throw new Error("No payment intent returned");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      succeededRef.current = false;
    } finally {
      setIsCreating(false);
      setIsConfirming(false);
    }
  }

  const isLoading = isCreating || isConfirming;
  const durationLabel = (() => {
    const d = Number(durationMinutes ?? 60);
    const h = Math.floor(d / 60); const m = d % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  })();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{facilityName}</Text>
        <Text style={styles.subtitle}>{courtName} · Recurring Series</Text>
      </View>

      {/* Schedule summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Schedule</Text>
        <Row label="Day" value={`Every ${DAY_SHORT[dayNum] ?? "—"}`} />
        <Row label="Time" value={`${fmtAmPm(startTime ?? "")} – ${fmtAmPm(endTime ?? "")}`} />
        <Row label="Duration" value={durationLabel} />
        <Row label="Frequency" value={frequency === "BIWEEKLY" ? "Every 2 weeks" : "Every week"} />
        <Row label="Sessions" value={`${weeksNum} (${fmtDate(startDate ?? "")} – ${fmtDate(endDate ?? "")})`} />
        <Row label="Payment" value={paymentModel === "PAY_UPFRONT" ? "Pay upfront" : "Pay per session"} last />
      </View>

      {/* Upcoming dates preview */}
      {occurrences.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upcoming Dates</Text>
          <View style={styles.datesWrap}>
            {occurrences.slice(0, 6).map((d) => (
              <View key={d} style={styles.datePill}>
                <Text style={styles.datePillText}>{fmtDate(d)}</Text>
              </View>
            ))}
            {occurrences.length > 6 && (
              <View style={styles.datePill}>
                <Text style={styles.datePillText}>+{occurrences.length - 6} more</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Price breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pricing</Text>
        <Row label="Per session" value={`C$${priceNum.toFixed(2)}`} />
        <Row label={`${weeksNum} sessions`} value={`C$${subtotal.toFixed(2)}`} />
        {discNum > 0 && <Row label={`Upfront discount (${discNum}%)`} value={`−C$${saved.toFixed(2)}`} valueStyle={{ color: C.green }} />}
        <Row label="Total" value={`C$${total.toFixed(2)}`} valueStyle={{ color: C.primary, fontSize: 16, fontWeight: "800" }} last />
        {saved > 0 && (
          <Text style={styles.saveNote}>🎉 You save C${saved.toFixed(2)} by committing upfront!</Text>
        )}
      </View>

      {error && <View style={styles.errBox}><Text style={styles.errText}>{error}</Text></View>}

      <Pressable style={[styles.cta, isLoading && styles.ctaDisabled]} onPress={handleConfirmAndPay} disabled={isLoading}>
        {isLoading ? (
          <View style={styles.ctaRow}>
            <ActivityIndicator color="#FFF" size="small" />
            <Text style={styles.ctaText}>{isCreating ? "Setting up series…" : "Confirming…"}</Text>
          </View>
        ) : (
          <Text style={styles.ctaText}>
            {paymentModel === "PAY_UPFRONT"
              ? `Subscribe & Pay — C$${total.toFixed(2)}`
              : `Subscribe — C$${priceNum.toFixed(2)} / session`}
          </Text>
        )}
      </Pressable>

      <Text style={styles.note}>
        {paymentModel === "PAY_UPFRONT"
          ? "All sessions charged now. Cancel anytime for a prorated refund."
          : "First session charged now. Future sessions charged automatically each week."}
      </Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value, last, valueStyle }: { label: string; value: string; last?: boolean; valueStyle?: object }) {
  return (
    <View style={[rowStyles.row, last && rowStyles.last]}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0F0F0" },
  last: { borderBottomWidth: 0 },
  label: { color: "#9E9E9E", fontSize: 14 },
  value: { color: "#0A0A0A", fontSize: 14, fontWeight: "600" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingTop: 24 },
  header: { marginBottom: 20 },
  title: { color: C.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 14 },
  cardTitle: { color: C.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 },
  datesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  datePill: { backgroundColor: "#F0F0F0", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  datePillText: { color: "#0A0A0A", fontSize: 12, fontWeight: "600" },
  saveNote: { color: C.green, fontSize: 12, marginTop: 10, textAlign: "center" },
  errBox: { backgroundColor: "#FFF0F0", borderRadius: 10, padding: 12, marginBottom: 14 },
  errText: { color: "#D32F2F", fontSize: 13 },
  cta: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaDisabled: { opacity: 0.55 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ctaText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  note: { color: C.muted, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 17 },
});
