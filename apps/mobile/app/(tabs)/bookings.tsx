import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMyBookings, type MyBooking } from "../../src/hooks/useMyBookings";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽", basketball: "🏀", tennis: "🎾", badminton: "🏸",
  volleyball: "🏐", hockey: "🏒", squash: "🏸", pickleball: "🏓",
  baseball: "⚾", cricket: "🏏",
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "#22C55E",
  PENDING: "#F59E0B",
  CANCELLED: "#EF4444",
};

// Parse "YYYY-MM-DD" as local date (never UTC) then format
function formatSlotDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BookingCard({ booking }: { booking: MyBooking }) {
  const sportKey = booking.facility.sport.toLowerCase();
  const emoji = SPORT_EMOJI[sportKey] ?? "🏟";
  const statusColor = STATUS_COLOR[booking.status] ?? C.muted;
  const dateLabel = formatSlotDate(booking.slot.date.split("T")[0]!);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.sportEmoji}>{emoji}</Text>
          <View>
            <Text style={styles.facilityName} numberOfLines={1}>
              {booking.facility.name}
            </Text>
            {booking.slot.court ? (
              <Text style={styles.courtName}>{booking.slot.court.name}</Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {booking.status}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.dateTime}>
          {dateLabel} · {booking.slot.startTime}–{booking.slot.endTime}
        </Text>
        <Text style={styles.price}>C${booking.totalCAD.toFixed(2)}</Text>
      </View>
    </View>
  );
}

function EmptyState({ onFindCourt }: { onFindCourt: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🏟</Text>
      <Text style={styles.emptyTitle}>No bookings yet</Text>
      <Text style={styles.emptySub}>Find a court and start playing!</Text>
      <Pressable style={styles.findBtn} onPress={onFindCourt}>
        <Text style={styles.findBtnText}>Find a Court</Text>
      </Pressable>
    </View>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const { bookings, isLoading, error, refetch } = useMyBookings();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const today = todayLocalStr();

  const { upcoming, past } = useMemo(() => {
    const up: MyBooking[] = [];
    const pa: MyBooking[] = [];
    for (const b of bookings) {
      const slotDate = b.slot.date.split("T")[0]!;
      if (slotDate >= today && b.status !== "CANCELLED") {
        up.push(b);
      } else {
        pa.push(b);
      }
    }
    // Upcoming: nearest first; Past: most recent first
    up.sort((a, b) => a.slot.date.localeCompare(b.slot.date));
    pa.sort((a, b) => b.slot.date.localeCompare(a.slot.date));
    return { upcoming: up, past: pa };
  }, [bookings, today]);

  const displayed = activeTab === "upcoming" ? upcoming : past;

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.screenTitle}>My Bookings</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["upcoming", "past"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "upcoming" ? "Upcoming" : "Past"}
            </Text>
            {tab === "upcoming" && upcoming.length > 0 ? (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{upcoming.length}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {isLoading && !bookings.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState onFindCourt={() => router.navigate("/(tabs)")} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 8,
  },
  screenTitle: { color: C.text, fontSize: 28, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: C.surface,
  },
  tabActive: { backgroundColor: C.primary },
  tabText: { color: C.muted, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: C.text },
  tabBadge: {
    backgroundColor: C.text,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  tabBadgeText: { color: C.primary, fontSize: 11, fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sportEmoji: { fontSize: 26 },
  facilityName: { color: C.text, fontSize: 15, fontWeight: "700", maxWidth: 180 },
  courtName: { color: C.muted, fontSize: 12, marginTop: 2 },
  statusBadge: {
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 10,
  },
  dateTime: { color: C.muted, fontSize: 13 },
  price: { color: C.text, fontSize: 14, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  errorText: { color: "#ff6b6b", fontSize: 15, marginBottom: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 99,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: C.text, fontWeight: "700" },
  emptyWrap: { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 24 },
  findBtn: {
    backgroundColor: C.primary,
    borderRadius: 99,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  findBtnText: { color: C.text, fontWeight: "700", fontSize: 15 },
});
