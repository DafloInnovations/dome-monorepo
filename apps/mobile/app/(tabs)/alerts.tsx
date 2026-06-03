import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useAlerts, type AvailabilityAlert, type AlertStatus } from "../../src/hooks/useAlerts";

const C = {
  bg: "#000000",
  surface: "#1C1C1E",
  primary: "#E85068",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
  DEFAULT: "🏟️",
};

function StatusBadge({ status }: { status: AlertStatus }) {
  const map: Record<AlertStatus, { label: string; color: string; bg: string }> = {
    PENDING:   { label: "Watching for availability", color: "#fbbf24", bg: "#78350f33" },
    TRIGGERED: { label: "Court opened! Book now →",  color: "#4ade80", bg: "#14532d33" },
    EXPIRED:   { label: "This time has passed",      color: "#6B6B6B", bg: "#1C1C1E" },
    CANCELLED: { label: "Cancelled",                 color: "#6B6B6B", bg: "#1C1C1E" },
  };
  const s = map[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

function AlertCard({ alert, onCancel, onBookNow }: {
  alert: AvailabilityAlert;
  onCancel: (id: string) => void;
  onBookNow: (alert: AvailabilityAlert) => void;
}) {
  const emoji = SPORT_EMOJI[alert.facility.sport?.toUpperCase() ?? ""] ?? SPORT_EMOJI["DEFAULT"]!;
  const dateLabel = formatDateLabel(alert.date);
  const startLabel = formatTimeLabel(alert.startTime);
  const endLabel = formatTimeLabel(alert.endTime);

  function confirmCancel() {
    Alert.alert(
      "Cancel Alert",
      "Stop watching for availability at this time?",
      [
        { text: "Keep Alert", style: "cancel" },
        { text: "Cancel Alert", style: "destructive", onPress: () => onCancel(alert.id) },
      ]
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardFacility} numberOfLines={1}>{alert.facility.name}</Text>
          {alert.court && (
            <Text style={styles.cardCourt} numberOfLines={1}>{alert.court.name}</Text>
          )}
          <Text style={styles.cardTime}>
            {dateLabel} · {startLabel} – {endLabel}
          </Text>
        </View>
      </View>

      <StatusBadge status={alert.status} />

      {alert.status === "TRIGGERED" && (
        <Pressable style={styles.bookNowBtn} onPress={() => onBookNow(alert)}>
          <Text style={styles.bookNowText}>Book Now →</Text>
        </Pressable>
      )}
      {alert.status === "PENDING" && (
        <Pressable style={styles.cancelBtn} onPress={confirmCancel}>
          <Text style={styles.cancelText}>Cancel Alert</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const { alerts, loading, fetchAlerts, cancelAlert } = useAlerts();

  useFocusEffect(
    useCallback(() => {
      fetchAlerts();
    }, [fetchAlerts])
  );

  async function handleCancel(id: string) {
    try {
      await cancelAlert(id);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to cancel alert");
    }
  }

  function handleBookNow(alert: AvailabilityAlert) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).push({
      pathname: "/facility/[facilityId]",
      params: { facilityId: alert.facilityId },
    });
  }

  const pending   = alerts.filter((a) => a.status === "PENDING");
  const triggered = alerts.filter((a) => a.status === "TRIGGERED");
  const past      = alerts.filter((a) => a.status === "EXPIRED" || a.status === "CANCELLED");

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => fetchAlerts()}
            tintColor={C.primary}
          />
        }
      >
        {loading && alerts.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.primary} size="large" />
          </View>
        ) : alerts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>No alerts set</Text>
            <Text style={styles.emptySub}>
              Find a fully booked facility and tap{"\n"}"Alert Me" to get notified instantly.
            </Text>
          </View>
        ) : (
          <>
            {triggered.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Available Now</Text>
                {triggered.map((a) => (
                  <AlertCard key={a.id} alert={a} onCancel={handleCancel} onBookNow={handleBookNow} />
                ))}
              </View>
            )}
            {pending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Watching</Text>
                {pending.map((a) => (
                  <AlertCard key={a.id} alert={a} onCancel={handleCancel} onBookNow={handleBookNow} />
                ))}
              </View>
            )}
            {past.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past</Text>
                {past.map((a) => (
                  <AlertCard key={a.id} alert={a} onCancel={handleCancel} onBookNow={handleBookNow} />
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700" },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardEmoji: { fontSize: 28, marginTop: 2 },
  cardInfo: { flex: 1, gap: 2 },
  cardFacility: { color: C.text, fontSize: 15, fontWeight: "700" },
  cardCourt: { color: C.muted, fontSize: 12 },
  cardTime: { color: C.muted, fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  bookNowBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  bookNowText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  cancelText: { color: C.muted, fontSize: 13 },
});
