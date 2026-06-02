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
import { useNotifications, type AppNotification } from "../src/hooks/useNotifications";

const C = {
  bg: "#000000",
  unreadBg: "#111111",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const TYPE_ICON: Record<string, string> = {
  BOOKING_CONFIRMED: "✅",
  BOOKING_REMINDER:  "🏟️",
  JOIN_REQUEST:      "🤝",
  PLAYER_CONFIRMED:  "🎉",
  PLAYER_DECLINED:   "❌",
  NEW_MESSAGE:       "💬",
  GAME_FULL:         "🔥",
  GAME_CANCELLED:    "🚫",
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function resolveRoute(
  type: string,
  data: Record<string, string> | null
): Parameters<ReturnType<typeof useRouter>["push"]>[0] | null {
  switch (type) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_REMINDER":
      return "/(tabs)/bookings";
    case "JOIN_REQUEST":
    case "PLAYER_CONFIRMED":
    case "PLAYER_DECLINED":
    case "GAME_FULL":
    case "GAME_CANCELLED":
      return data?.gameId
        ? { pathname: "/connect/game/[gameId]", params: { gameId: data.gameId } }
        : null;
    case "NEW_MESSAGE":
      return data?.threadId
        ? { pathname: "/chat/[threadId]", params: { threadId: data.threadId } }
        : null;
    default:
      return null;
  }
}

function NotificationCard({
  notif,
  onPress,
}: {
  notif: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const icon = TYPE_ICON[notif.type] ?? "🔔";
  return (
    <Pressable
      style={[styles.card, notif.isRead ? styles.cardRead : styles.cardUnread]}
      onPress={() => onPress(notif)}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, !notif.isRead && styles.cardTitleUnread]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={styles.cardBodyText} numberOfLines={2}>{notif.body}</Text>
        <Text style={styles.cardTime}>{formatTimeAgo(notif.createdAt)}</Text>
      </View>
      {!notif.isRead && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllRead } =
    useNotifications();

  function handlePress(notif: AppNotification) {
    if (!notif.isRead) markAsRead(notif.id);
    const route = resolveRoute(notif.type, notif.data);
    if (route) router.push(route as any);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>NOTIFICATIONS</Text>
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {isLoading && !notifications.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchNotifications}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NotificationCard notif={item} onPress={handlePress} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchNotifications} tintColor={C.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>We'll let you know when something happens.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 12,
  },
  backBtn: { marginRight: 4 },
  backBtnText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  title: { flex: 1, color: C.text, fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  markAllBtn: {
    backgroundColor: C.surface,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: { color: C.primary, fontSize: 13, fontWeight: "700" },

  list: { paddingBottom: 32 },
  separator: { height: 1, backgroundColor: C.border },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardRead:   { backgroundColor: C.bg },
  cardUnread: { backgroundColor: C.unreadBg },
  icon: { fontSize: 22, marginTop: 1, flexShrink: 0 },
  cardBody: { flex: 1 },
  cardTitle: { color: C.muted, fontSize: 14, fontWeight: "600", marginBottom: 3 },
  cardTitleUnread: { color: C.text, fontWeight: "700" },
  cardBodyText: { color: C.muted, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  cardTime: { color: C.muted, fontSize: 11 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
    marginTop: 6,
    flexShrink: 0,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#ff6b6b", fontSize: 14, marginBottom: 14, textAlign: "center" },
  retryBtn: { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: C.text, fontWeight: "700" },

  emptyWrap: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center" },
});
