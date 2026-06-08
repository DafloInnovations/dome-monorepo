import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { useSocket } from "../../src/context/SocketContext";
import { useThreads, type ChatThread } from "../../src/hooks/useChat";
import { useNotificationsContext } from "../../src/context/NotificationsContext";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#F5F5F5",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#F0F0F0",
  green:   "#22C55E",
};

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", BASKETBALL: "🏀",
  SOCCER: "⚽", CRICKET: "🏏", SQUASH: "🎯", VOLLEYBALL: "🏐",
  HOCKEY: "🏒", BASEBALL: "⚾",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "Now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function initials(first = "", last = ""): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

type TimeGroup = "today" | "yesterday" | "week" | "older";

function timeGroup(iso: string): TimeGroup {
  const msgDay = new Date(new Date(iso).setHours(0, 0, 0, 0)).getTime();
  const todayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const diff = todayMs - msgDay;
  if (diff === 0)                  return "today";
  if (diff === 86_400_000)         return "yesterday";
  if (diff <= 6 * 86_400_000)      return "week";
  return "older";
}

const GROUP_LABEL: Record<TimeGroup, string> = {
  today:     "TODAY",
  yesterday: "YESTERDAY",
  week:      "THIS WEEK",
  older:     "OLDER",
};

const GROUP_ORDER: TimeGroup[] = ["today", "yesterday", "week", "older"];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const bg = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["#F0F0F0", "#E4E4E4"] });
  return (
    <View style={sk.row}>
      <Animated.View style={[sk.avatar, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <View style={sk.topRow}>
          <Animated.View style={[sk.line, { width: "40%", backgroundColor: bg }]} />
          <Animated.View style={[sk.line, { width: "12%", backgroundColor: bg }]} />
        </View>
        <Animated.View style={[sk.line, { width: "65%", backgroundColor: bg, marginTop: 6 }]} />
        <Animated.View style={[sk.line, { width: "80%", backgroundColor: bg, marginTop: 5 }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  row:    { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: "center" },
  avatar: { width: 52, height: 52, borderRadius: 26, flexShrink: 0 },
  body:   { flex: 1, gap: 2 },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  line:   { height: 11, borderRadius: 6 },
});

// ─── Thread Row ───────────────────────────────────────────────────────────────

function ThreadRow({ thread, currentUserId }: { thread: ChatThread; currentUserId: string }) {
  const router = useRouter();
  const other = thread.otherParticipants[0];
  const name  = other
    ? [other.user.firstName, other.user.lastName].filter(Boolean).join(" ") || "User"
    : "Chat";
  const inis = other ? initials(other.user.firstName, other.user.lastName) : "?";

  const lastMsg  = thread.lastMessage;
  const isMine   = lastMsg?.senderId === currentUserId;
  const preview  = lastMsg
    ? (isMine ? `You: ${lastMsg.content}` : lastMsg.content)
    : "No messages yet";
  const time = lastMsg
    ? fmtRelative(lastMsg.createdAt)
    : fmtRelative(thread.updatedAt);
  const hasUnread = thread.unreadCount > 0;

  const game = thread.game;
  const sportEmoji = game?.sport ? (SPORT_EMOJI[game.sport.toUpperCase()] ?? "🏟️") : null;
  const gameContext = game?.sport
    ? `${sportEmoji} ${game.sport.charAt(0) + game.sport.slice(1).toLowerCase()}${game.facility ? ` · ${game.facility}` : ""}`
    : null;

  return (
    <Pressable
      style={[styles.row, hasUnread && styles.rowUnread]}
      onPress={() =>
        router.push({
          pathname: "/chat/[threadId]",
          params: {
            threadId: thread.id,
            otherUserName: name,
            ...(thread.openGameId  ? { gameId: thread.openGameId }       : {}),
            ...(game?.sport        ? { gameSport: game.sport }            : {}),
            ...(game?.facility     ? { gameFacility: game.facility }      : {}),
            ...(game?.date         ? { gameDate: game.date }              : {}),
            ...(game?.startTime    ? { gameStartTime: game.startTime }    : {}),
            ...(game?.endTime      ? { gameEndTime: game.endTime }        : {}),
          },
        })
      }
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{inis}</Text>
        </View>
        {/* Online dot placeholder — real presence requires ws presence events */}
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameBold]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.rowTime, hasUnread && { color: C.primary }]}>{time}</Text>
        </View>
        {gameContext ? (
          <Text style={styles.gameCtx} numberOfLines={1}>{gameContext}</Text>
        ) : null}
        <View style={styles.rowBottom}>
          <Text
            style={[styles.rowPreview, hasUnread && styles.rowPreviewBold]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
              </Text>
            </View>
          ) : isMine ? (
            <Text style={styles.checkmark}>✓</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ─── List item type ───────────────────────────────────────────────────────────

type ListItem =
  | { kind: "header"; label: string; key: string }
  | { kind: "thread"; thread: ChatThread; key: string };

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatsTab() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { unreadCount } = useNotificationsContext();
  const { threads, isLoading, error, refetch } = useThreads();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter((t) => {
      const name = t.otherParticipants[0]
        ? [t.otherParticipants[0].user.firstName, t.otherParticipants[0].user.lastName]
            .filter(Boolean).join(" ").toLowerCase()
        : "";
      const preview = t.lastMessage?.content?.toLowerCase() ?? "";
      return name.includes(q) || preview.includes(q);
    });
  }, [threads, search]);

  // Build flat list with section headers
  const listItems = useMemo<ListItem[]>(() => {
    const groups: Partial<Record<TimeGroup, ChatThread[]>> = {};
    for (const t of filtered) {
      const g = timeGroup(t.lastMessage?.createdAt ?? t.updatedAt);
      (groups[g] = groups[g] ?? []).push(t);
    }
    const items: ListItem[] = [];
    for (const g of GROUP_ORDER) {
      const group = groups[g];
      if (!group?.length) continue;
      items.push({ kind: "header", label: GROUP_LABEL[g], key: `h-${g}` });
      for (const t of group) {
        items.push({ kind: "thread", thread: t, key: t.id });
      }
    }
    return items;
  }, [filtered]);

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>MESSAGES</Text>
          <Text style={styles.subtitle}>
            {threads.length} conversation{threads.length !== 1 ? "s" : ""}
            {isConnected ? "" : "  ·  Offline"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => alert("Start a chat by joining or hosting a game!")}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={22} color={C.text} />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={C.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Search ──────────────────────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return <Text style={styles.sectionLabel}>{item.label}</Text>;
            }
            return (
              <ThreadRow
                thread={item.thread}
                currentUserId={user?.id ?? ""}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && threads.length > 0}
              onRefresh={refetch}
              tintColor={C.primary}
            />
          }
          ListHeaderComponent={
            isLoading && threads.length === 0 ? (
              <View>
                <ThreadSkeleton />
                <ThreadSkeleton />
                <ThreadSkeleton />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySub}>
                  {search.trim()
                    ? "No conversations match your search"
                    : "Join a game to start chatting"}
                </Text>
                {!search.trim() && (
                  <Pressable
                    style={styles.emptyBtn}
                    onPress={() => router.navigate("/(tabs)/connect" as Parameters<typeof router.navigate>[0])}
                  >
                    <Text style={styles.emptyBtnText}>Browse Games</Text>
                  </Pressable>
                )}
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 48 }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  // Header
  header: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingBottom: 14,
  },
  title:    { color: C.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 2, marginTop: 4 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: 5, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.bg,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.surface, borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1, borderColor: C.border,
  },
  searchIcon:  { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1, paddingVertical: 12,
    color: C.text, fontSize: 15,
  },

  // Section header
  sectionLabel: {
    color: C.muted,
    fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase",
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },

  // Thread row
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bg,
  },
  rowUnread: {
    borderLeftWidth: 3, borderLeftColor: C.primary,
    backgroundColor: "#FFFBFC",
  },

  // Avatar
  avatarWrap: { position: "relative", flexShrink: 0 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },

  // Row content
  rowContent: { flex: 1 },
  rowTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  rowName:   { color: C.muted, fontSize: 15, fontWeight: "500", flex: 1, marginRight: 8 },
  rowNameBold: { color: C.text, fontWeight: "700" },
  rowTime:   { color: C.muted, fontSize: 12 },
  gameCtx:   { color: C.primary, fontSize: 12, fontWeight: "700", marginBottom: 3 },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPreview:     { color: C.muted, fontSize: 13, flex: 1, marginRight: 6 },
  rowPreviewBold: { color: C.text, fontWeight: "600" },
  checkmark: { color: C.muted, fontSize: 13 },
  unreadBadge: {
    backgroundColor: C.primary, borderRadius: 99,
    minWidth: 20, height: 20,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  // Empty
  emptyWrap:  { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySub:   { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 20 },
  emptyBtn: {
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Error
  errorText: { color: "#EF4444", fontSize: 14, marginBottom: 14, textAlign: "center" },
  retryBtn:  { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
