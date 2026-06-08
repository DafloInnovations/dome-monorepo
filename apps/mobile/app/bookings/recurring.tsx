import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useRecurring, type RecurringSeries } from "../../src/hooks/useRecurring";

const C = {
  bg: "#FFFFFF", primary: "#E85068", surface: "#F8F8F8",
  text: "#0A0A0A", muted: "#9E9E9E", chip: "#EBEBEB", green: "#22c55e",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREQ_LABELS: Record<string, string> = { WEEKLY: "Weekly", BIWEEKLY: "Biweekly", MONTHLY: "Monthly" };
const STATUS_COLORS: Record<string, string> = { ACTIVE: "#22c55e", PAUSED: "#f59e0b", CANCELLED: "#ef4444", COMPLETED: "#9E9E9E" };

function scheduleLabel(s: RecurringSeries): string {
  const days = s.daysOfWeek.length > 0
    ? s.daysOfWeek.map((d) => DAY_LABELS[d]).join(" + ")
    : "Every day";
  const [h, m] = s.startTime.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${FREQ_LABELS[s.frequency] ?? s.frequency} · ${days} · ${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

function formatDate(d: string): string {
  const [y, mo, day] = d.split("-").map(Number);
  return new Date(y!, mo! - 1, day!).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function RecurringSeriesScreen() {
  const { fetchRecurringSeries, cancelSeries, pauseSeries, loading } = useRecurring();
  const [series, setSeries] = useState<RecurringSeries[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchRecurringSeries().then(setSeries);
    }, [fetchRecurringSeries])
  );

  function handleCancel(s: RecurringSeries) {
    Alert.alert(
      "Cancel Series",
      `Cancel all remaining ${s.remainingSessions} session${s.remainingSessions !== 1 ? "s" : ""}?${s.paymentModel === "PAY_UPFRONT" ? " A prorated refund will be issued." : ""}`,
      [
        { text: "Keep It", style: "cancel" },
        {
          text: "Cancel Series",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelSeries(s.id, "NOW");
              setSeries((prev) => prev.map((x) => x.id === s.id ? { ...x, status: "CANCELLED" } : x));
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to cancel");
            }
          },
        },
      ]
    );
  }

  function handlePause(s: RecurringSeries) {
    // Simple pause until 2 weeks from now
    const pauseUntil = new Date();
    pauseUntil.setDate(pauseUntil.getDate() + 14);
    const pauseStr = pauseUntil.toISOString().split("T")[0]!;
    Alert.alert(
      "Pause Series",
      `Pause for 2 weeks until ${formatDate(pauseStr)}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Pause",
          onPress: async () => {
            try {
              await pauseSeries(s.id, pauseStr);
              setSeries((prev) => prev.map((x) => x.id === s.id ? { ...x, status: "PAUSED" } : x));
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to pause");
            }
          },
        },
      ]
    );
  }

  if (loading && series.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Recurring Bookings</Text>
        <Text style={styles.subtitle}>{series.filter((s) => s.status === "ACTIVE").length} active series</Text>
      </View>

      {series.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔄</Text>
          <Text style={styles.emptyTitle}>No recurring bookings</Text>
          <Text style={styles.emptyBody}>Book a court recurring series from any facility page.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {series.map((s) => (
            <View key={s.id} style={styles.card}>
              {/* Header row */}
              <View style={styles.cardHeader}>
                <View style={styles.cardTitles}>
                  <Text style={styles.facilityName}>{s.facility.name}</Text>
                  <Text style={styles.courtName}>{s.court.name}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[s.status] ?? "#9E9E9E"}22`, borderColor: `${STATUS_COLORS[s.status] ?? "#9E9E9E"}66` }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[s.status] ?? "#9E9E9E" }]}>{s.status}</Text>
                </View>
              </View>

              {/* Schedule */}
              <Text style={styles.schedule}>{scheduleLabel(s)}</Text>

              {/* Stats grid */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Next session</Text>
                  <Text style={styles.statValue}>{s.nextOccurrence ? formatDate(s.nextOccurrence) : "—"}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Remaining</Text>
                  <Text style={styles.statValue}>{s.remainingSessions} / {s.totalOccurrences}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Per session</Text>
                  <Text style={[styles.statValue, { color: C.primary }]}>C${s.pricePerSessionCAD.toFixed(2)}</Text>
                </View>
              </View>

              {/* Discount badge */}
              {s.discountPercent > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>🎉 {s.discountPercent}% upfront discount applied</Text>
                </View>
              )}

              {/* Actions */}
              {s.status === "ACTIVE" && (
                <View style={styles.actions}>
                  <Pressable style={styles.pauseBtn} onPress={() => handlePause(s)}>
                    <Text style={styles.pauseBtnText}>Pause</Text>
                  </Pressable>
                  <Pressable style={styles.cancelBtn} onPress={() => handleCancel(s)}>
                    <Text style={styles.cancelBtnText}>Cancel Series</Text>
                  </Pressable>
                </View>
              )}
              {s.status === "PAUSED" && (
                <Text style={styles.pausedNote}>Series paused · Contact support to resume</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  header: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardTitles: { flex: 1, marginRight: 10 },
  facilityName: { color: C.text, fontSize: 15, fontWeight: "700" },
  courtName: { color: C.muted, fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" },
  schedule: { color: C.muted, fontSize: 12, marginBottom: 14 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.chip, borderRadius: 10, padding: 10 },
  statLabel: { color: C.muted, fontSize: 10, marginBottom: 3 },
  statValue: { color: C.text, fontSize: 14, fontWeight: "700" },
  discountBadge: { backgroundColor: "#14532d33", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12 },
  discountText: { color: C.green, fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10 },
  pauseBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.muted, alignItems: "center" },
  pauseBtnText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#ef444460", alignItems: "center" },
  cancelBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },
  pausedNote: { color: C.muted, fontSize: 12, textAlign: "center" },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyBody: { color: C.muted, fontSize: 13, textAlign: "center", lineHeight: 20 },
});
