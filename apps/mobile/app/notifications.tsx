import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications, type AppNotification } from "../src/hooks/useNotifications";
import { useConnectActions } from "../src/hooks/useConnect";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#F5F5F5",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#F0F0F0",
  green:   "#22C55E",
  amber:   "#F59E0B",
};

// ─── Type configuration ───────────────────────────────────────────────────────

interface TypeCfg {
  icon: string;
  iconBg: string;
  ctaVariant: "outline" | "filled" | "double_join" | "double_reminder" | "stars" | "none";
  ctaLabel?: string;
  cta2Label?: string;
}

const TYPE_CFG: Record<string, TypeCfg> = {
  BOOKING_CONFIRMED:  { icon: "✅", iconBg: "#E8F5E9", ctaVariant: "outline",         ctaLabel: "View Booking"      },
  BOOKING_REMINDER:   { icon: "🏟️", iconBg: "#F3E5F5", ctaVariant: "double_reminder", ctaLabel: "Directions",       cta2Label: "View Booking"  },
  BOOKING_CANCELLED:  { icon: "❌", iconBg: "#FFEBEE", ctaVariant: "outline",         ctaLabel: "Book Again"        },
  JOIN_REQUEST:       { icon: "🤝", iconBg: "#FFE8EC", ctaVariant: "double_join",     ctaLabel: "✓ Approve",        cta2Label: "✗ Decline"     },
  PLAYER_CONFIRMED:   { icon: "🎉", iconBg: "#FFF8E1", ctaVariant: "outline",         ctaLabel: "View Game"         },
  PLAYER_DECLINED:    { icon: "😔", iconBg: "#F5F5F5", ctaVariant: "outline",         ctaLabel: "Find Another Game" },
  NEW_MESSAGE:        { icon: "💬", iconBg: "#E8F0FE", ctaVariant: "outline",         ctaLabel: "Reply"             },
  AVAILABILITY_ALERT: { icon: "🔔", iconBg: "#FFF3E0", ctaVariant: "filled",          ctaLabel: "Book Now"          },
  GAME_FULL:          { icon: "🔥", iconBg: "#FFF3E0", ctaVariant: "outline",         ctaLabel: "View Game"         },
  GAME_CANCELLED:     { icon: "🚫", iconBg: "#FFEBEE", ctaVariant: "outline",         ctaLabel: "Find Another Game" },
  REVIEW_PROMPT:      { icon: "⭐", iconBg: "#FFFDE7", ctaVariant: "stars",           ctaLabel: "Write Review"      },
  COUPON:             { icon: "🎟️", iconBg: "#E8F5E9", ctaVariant: "outline",         ctaLabel: "Use Now"           },
};
const DEFAULT_CFG: TypeCfg = { icon: "🔔", iconBg: "#F5F5F5", ctaVariant: "none" };

// ─── Filter tab types ─────────────────────────────────────────────────────────

type FilterKey = "all" | "bookings" | "games" | "messages";
const FILTER_TYPES: Record<FilterKey, string[] | null> = {
  all:      null,
  bookings: ["BOOKING_CONFIRMED", "BOOKING_REMINDER", "BOOKING_CANCELLED"],
  games:    ["JOIN_REQUEST", "PLAYER_CONFIRMED", "PLAYER_DECLINED", "GAME_FULL", "GAME_CANCELLED", "AVAILABILITY_ALERT"],
  messages: ["NEW_MESSAGE"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "Now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

type TimeGroup = "TODAY" | "YESTERDAY" | "THIS WEEK" | "EARLIER";

function getTimeGroup(iso: string): TimeGroup {
  const day    = new Date(new Date(iso).setHours(0, 0, 0, 0)).getTime();
  const today  = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const diff   = today - day;
  if (diff === 0)               return "TODAY";
  if (diff === 86_400_000)      return "YESTERDAY";
  if (diff <= 6 * 86_400_000)   return "THIS WEEK";
  return "EARLIER";
}

const GROUP_ORDER: TimeGroup[] = ["TODAY", "YESTERDAY", "THIS WEEK", "EARLIER"];

function resolveRoute(type: string, data: Record<string, string> | null) {
  switch (type) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_REMINDER":
    case "BOOKING_CANCELLED":
      return data?.bookingId
        ? { pathname: "/(tabs)/bookings" as const }
        : "/(tabs)/bookings" as const;
    case "JOIN_REQUEST":
    case "PLAYER_CONFIRMED":
    case "PLAYER_DECLINED":
    case "GAME_FULL":
    case "GAME_CANCELLED":
      return data?.gameId
        ? { pathname: "/connect/game/[gameId]" as const, params: { gameId: data.gameId } }
        : null;
    case "NEW_MESSAGE":
      return data?.threadId
        ? { pathname: "/chat/[threadId]" as const, params: { threadId: data.threadId, otherUserName: data.senderName ?? "Chat" } }
        : null;
    case "AVAILABILITY_ALERT":
      return data?.facilityId
        ? { pathname: "/facility/[facilityId]" as const, params: { facilityId: data.facilityId } }
        : null;
    case "REVIEW_PROMPT":
      return data?.bookingId
        ? { pathname: "/review/[bookingId]" as const, params: { bookingId: data.bookingId, facilityName: data.facilityName ?? "", sport: data.sport ?? "", slotDate: data.slotDate ?? "" } }
        : null;
    default:
      return null;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
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
    <View style={sk.card}>
      <Animated.View style={[sk.icon, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <View style={sk.row}>
          <Animated.View style={[sk.line, { width: "55%", backgroundColor: bg }]} />
          <Animated.View style={[sk.line, { width: "12%", backgroundColor: bg }]} />
        </View>
        <Animated.View style={[sk.line, { width: "85%", backgroundColor: bg, marginTop: 6 }]} />
        <Animated.View style={[sk.line, { width: "65%", backgroundColor: bg, marginTop: 5 }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card: {
    flexDirection: "row", gap: 12, padding: 16,
    backgroundColor: "#fff", borderRadius: 16,
    marginHorizontal: 16, marginBottom: 8,
  },
  icon: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
  body: { flex: 1 },
  row:  { flexDirection: "row", justifyContent: "space-between" },
  line: { height: 11, borderRadius: 6 },
});

// ─── Notification Card ────────────────────────────────────────────────────────

interface CardProps {
  notif:       AppNotification;
  onPress:     () => void;
  onPrimary:   () => void;
  onSecondary: () => void;
  actedState?: "approved" | "declined";
  starRating:  number;
  onStarPress: (s: number) => void;
}

function NotificationCard({
  notif, onPress, onPrimary, onSecondary,
  actedState, starRating, onStarPress,
}: CardProps) {
  const cfg = TYPE_CFG[notif.type] ?? DEFAULT_CFG;

  return (
    <Pressable
      style={[nc.card, notif.isRead ? nc.cardRead : nc.cardUnread]}
      onPress={onPress}
    >
      {/* Left icon */}
      <View style={[nc.iconCircle, { backgroundColor: cfg.iconBg }]}>
        <Text style={nc.iconText}>{cfg.icon}</Text>
      </View>

      {/* Content */}
      <View style={nc.content}>
        <View style={nc.topRow}>
          <Text style={[nc.title, !notif.isRead && nc.titleUnread]} numberOfLines={1}>
            {notif.title}
          </Text>
          <View style={nc.rightCol}>
            <Text style={nc.time}>{fmtAgo(notif.createdAt)}</Text>
            {!notif.isRead && <View style={nc.dot} />}
          </View>
        </View>

        <Text style={nc.body} numberOfLines={3}>{notif.body}</Text>

        {/* Extra details for BOOKING_CANCELLED */}
        {notif.type === "BOOKING_CANCELLED" && notif.data?.creditAmount && (
          <Text style={nc.creditLine}>💳 C${notif.data.creditAmount} credits issued</Text>
        )}

        {/* CTAs */}
        {cfg.ctaVariant !== "none" && (
          <>
            <View style={nc.divider} />

            {cfg.ctaVariant === "stars" ? (
              <View style={nc.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable key={s} onPress={() => onStarPress(s)} hitSlop={4}>
                    <Text style={[nc.star, s <= starRating && nc.starFilled]}>★</Text>
                  </Pressable>
                ))}
                <Pressable style={nc.ctaOutline} onPress={onPrimary}>
                  <Text style={nc.ctaOutlineText}>{cfg.ctaLabel}</Text>
                </Pressable>
              </View>
            ) : cfg.ctaVariant === "double_join" ? (
              actedState ? (
                <View style={[nc.ctaOutline, actedState === "approved" ? nc.ctaActedApproved : nc.ctaActedDeclined]}>
                  <Text style={[nc.ctaOutlineText, { color: actedState === "approved" ? C.green : C.muted }]}>
                    {actedState === "approved" ? "✓ Approved" : "✗ Declined"}
                  </Text>
                </View>
              ) : (
                <View style={nc.doubleRow}>
                  <Pressable style={[nc.ctaOutline, nc.ctaApprove]} onPress={onPrimary}>
                    <Text style={[nc.ctaOutlineText, { color: C.green }]}>{cfg.ctaLabel}</Text>
                  </Pressable>
                  <Pressable style={[nc.ctaOutline, nc.ctaDecline]} onPress={onSecondary}>
                    <Text style={[nc.ctaOutlineText, { color: "#EF4444" }]}>{cfg.cta2Label}</Text>
                  </Pressable>
                </View>
              )
            ) : cfg.ctaVariant === "double_reminder" ? (
              <View style={nc.doubleRow}>
                <Pressable style={nc.ctaOutline} onPress={onSecondary}>
                  <Text style={nc.ctaOutlineText}>{cfg.ctaLabel}</Text>
                </Pressable>
                <Pressable style={nc.ctaOutline} onPress={onPrimary}>
                  <Text style={nc.ctaOutlineText}>{cfg.cta2Label}</Text>
                </Pressable>
              </View>
            ) : cfg.ctaVariant === "filled" ? (
              <Pressable style={nc.ctaFilled} onPress={onPrimary}>
                <Text style={nc.ctaFilledText}>{cfg.ctaLabel}</Text>
              </Pressable>
            ) : (
              <Pressable style={nc.ctaOutline} onPress={onPrimary}>
                <Text style={nc.ctaOutlineText}>{cfg.ctaLabel}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}

const nc = StyleSheet.create({
  card: {
    flexDirection: "row", gap: 12,
    padding: 16, borderRadius: 16,
    marginHorizontal: 16, marginBottom: 8,
  },
  cardRead: {
    backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
  },
  cardUnread: {
    backgroundColor: "#FFFBFC",
    borderLeftWidth: 3, borderLeftColor: C.primary,
    borderWidth: 0,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  iconText:    { fontSize: 20 },
  content:     { flex: 1 },
  topRow:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 3 },
  title:       { color: C.muted, fontSize: 14, fontWeight: "600", flex: 1, marginRight: 6 },
  titleUnread: { color: C.text, fontWeight: "700" },
  rightCol:    { alignItems: "flex-end", gap: 4 },
  time:        { color: C.muted, fontSize: 11 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
  body:        { color: "#6B6B6B", fontSize: 13, lineHeight: 18, marginBottom: 4 },
  creditLine:  { color: "#6B6B6B", fontSize: 12, marginTop: 3, fontStyle: "italic" },
  divider:     { height: 1, backgroundColor: "#F5F5F5", marginVertical: 10 },
  doubleRow:   { flexDirection: "row", gap: 8 },
  ctaOutline: {
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  ctaApprove:        { borderColor: C.green },
  ctaDecline:        { borderColor: "#EF4444" },
  ctaActedApproved:  { borderColor: C.green, backgroundColor: `${C.green}18` },
  ctaActedDeclined:  { borderColor: C.muted, backgroundColor: "#F5F5F5" },
  ctaOutlineText:    { color: C.primary, fontSize: 12, fontWeight: "700" },
  ctaFilled: {
    backgroundColor: C.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: "flex-start",
  },
  ctaFilledText:   { color: "#fff", fontSize: 12, fontWeight: "700" },
  starsRow:        { flexDirection: "row", alignItems: "center", gap: 8 },
  star:            { fontSize: 22, color: "#D0D0D0" },
  starFilled:      { color: "#FFD700" },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sh.wrap}>
      <View style={sh.line} />
      <Text style={sh.label}>{title}</Text>
      <View style={sh.line} />
    </View>
  );
}
const sh = StyleSheet.create({
  wrap:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  line:  { flex: 1, height: 1, backgroundColor: C.border },
  label: { color: C.muted, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllRead } =
    useNotifications();
  const { confirmPlayer, declinePlayer } = useConnectActions();

  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [actedMap,  setActedMap]  = useState<Record<string, "approved" | "declined">>({});
  const [starMap,   setStarMap]   = useState<Record<string, number>>({});

  // ── Filter counts ──────────────────────────────────────────────────────────
  const filterCounts = useMemo<Record<FilterKey, number>>(() => {
    const counts: Record<FilterKey, number> = { all: notifications.length, bookings: 0, games: 0, messages: 0 };
    for (const n of notifications) {
      for (const [key, types] of Object.entries(FILTER_TYPES)) {
        if (types && types.includes(n.type)) {
          counts[key as FilterKey]++;
        }
      }
    }
    return counts;
  }, [notifications]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const types = FILTER_TYPES[activeFilter];
    if (!types) return notifications;
    return notifications.filter((n) => types.includes(n.type));
  }, [notifications, activeFilter]);

  // ── Grouped sections ───────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const map: Partial<Record<TimeGroup, AppNotification[]>> = {};
    for (const n of filtered) {
      const g = getTimeGroup(n.createdAt);
      (map[g] = map[g] ?? []).push(n);
    }
    return GROUP_ORDER
      .filter((g) => (map[g]?.length ?? 0) > 0)
      .map((g) => ({ title: g, data: map[g]! }));
  }, [filtered]);

  // ── Action handlers ────────────────────────────────────────────────────────

  function handlePress(notif: AppNotification) {
    if (!notif.isRead) markAsRead(notif.id);
    const route = resolveRoute(notif.type, notif.data);
    if (route) router.push(route as Parameters<typeof router.push>[0]);
  }

  const handlePrimary = useCallback((notif: AppNotification) => {
    if (!notif.isRead) markAsRead(notif.id);
    const { type, data } = notif;

    if (type === "JOIN_REQUEST") {
      const gameId = data?.gameId;
      const userId = data?.requestUserId ?? data?.userId;
      if (gameId && userId) {
        setActedMap((p) => ({ ...p, [notif.id]: "approved" }));
        confirmPlayer(gameId, userId).catch(() => {});
      } else if (gameId) {
        router.push({ pathname: "/connect/game/[gameId]", params: { gameId } });
      }
      return;
    }

    if (type === "BOOKING_REMINDER") {
      const route = resolveRoute(type, data);
      if (route) router.push(route as Parameters<typeof router.push>[0]);
      return;
    }

    if (type === "AVAILABILITY_ALERT" && data?.facilityId) {
      router.push({ pathname: "/facility/[facilityId]", params: { facilityId: data.facilityId } });
      return;
    }

    if (type === "BOOKING_CANCELLED" && data?.facilityId) {
      router.push({ pathname: "/facility/[facilityId]", params: { facilityId: data.facilityId } });
      return;
    }

    if (type === "PLAYER_DECLINED" || type === "GAME_CANCELLED") {
      router.navigate("/(tabs)/connect" as Parameters<typeof router.navigate>[0]);
      return;
    }

    if (type === "REVIEW_PROMPT") {
      const route = resolveRoute(type, data);
      if (route) router.push(route as Parameters<typeof router.push>[0]);
      return;
    }

    if (type === "COUPON") {
      router.navigate("/(tabs)/venues" as Parameters<typeof router.navigate>[0]);
      return;
    }

    const route = resolveRoute(type, data);
    if (route) router.push(route as Parameters<typeof router.push>[0]);
  }, [confirmPlayer, markAsRead, router]);

  const handleSecondary = useCallback((notif: AppNotification) => {
    if (!notif.isRead) markAsRead(notif.id);
    const { type, data } = notif;

    if (type === "JOIN_REQUEST") {
      const gameId = data?.gameId;
      const userId = data?.requestUserId ?? data?.userId;
      if (gameId && userId) {
        setActedMap((p) => ({ ...p, [notif.id]: "declined" }));
        declinePlayer(gameId, userId).catch(() => {});
      }
      return;
    }

    if (type === "BOOKING_REMINDER") {
      const addr = data?.address;
      const city = data?.city;
      if (addr && city) {
        const q = encodeURIComponent(`${addr}, ${city}`);
        const url = Platform.OS === "ios"
          ? `maps://maps.apple.com/?address=${q}`
          : `https://maps.google.com/?q=${q}`;
        Linking.openURL(url).catch(() => {});
      }
      return;
    }
  }, [declinePlayer, markAsRead]);

  async function handleMarkAllRead() {
    await markAllRead();
    Alert.alert("", "All caught up! ✓");
  }

  const FILTER_TABS: { key: FilterKey; label: string }[] = [
    { key: "all",      label: "All"      },
    { key: "bookings", label: "Bookings" },
    { key: "games",    label: "Games"    },
    { key: "messages", label: "Messages" },
  ];

  const unreadFiltered = filtered.filter((n) => !n.isRead).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={C.primary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>NOTIFICATIONS</Text>
          {unreadFiltered > 0 && (
            <Text style={styles.subtitle}>{unreadFiltered} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" }}>
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.key;
            const count  = filterCounts[tab.key];
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active ? "#E85068" : "#F5F5F5",
                  borderWidth: active ? 0 : 1,
                  borderColor: "#E8E8E8",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: active ? "#FFFFFF" : "#0A0A0A",
                  }}
                >
                  {tab.label}
                </Text>
                <View
                  style={{
                    backgroundColor: active ? "rgba(255,255,255,0.25)" : "#E0E0E0",
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    minWidth: 22,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: active ? "#FFFFFF" : "#666666",
                    }}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchNotifications}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          renderSectionHeader={({ section }) => <SectionHeader title={section.title} />}
          renderItem={({ item: notif }) => (
            <NotificationCard
              notif={notif}
              onPress={() => handlePress(notif)}
              onPrimary={() => handlePrimary(notif)}
              onSecondary={() => handleSecondary(notif)}
              actedState={actedMap[notif.id]}
              starRating={starMap[notif.id] ?? 0}
              onStarPress={(s) => setStarMap((p) => ({ ...p, [notif.id]: s }))}
            />
          )}
          contentContainerStyle={{ paddingBottom: 48, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && notifications.length > 0}
              onRefresh={fetchNotifications}
              tintColor={C.primary}
              title="Checking for updates…"
              titleColor={C.muted}
            />
          }
          ListHeaderComponent={
            isLoading && notifications.length === 0 ? (
              <View>
                <NotifSkeleton />
                <NotifSkeleton />
                <NotifSkeleton />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🔔</Text>
                <Text style={styles.emptyTitle}>You're all caught up!</Text>
                <Text style={styles.emptySub}>
                  {activeFilter === "all"
                    ? "No new notifications"
                    : `No ${activeFilter} notifications`}
                </Text>
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.navigate("/(tabs)/venues" as Parameters<typeof router.navigate>[0])}
                >
                  <Text style={styles.emptyBtnText}>Browse Courts</Text>
                </Pressable>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1 },
  title:        { color: C.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  subtitle:     { color: C.muted, fontSize: 13, marginTop: 1 },
  markAllText:  { color: C.primary, fontSize: 13, fontWeight: "700" },

  // Filter tabs
  // filter tabs rendered with inline styles above

  // Empty
  emptyWrap:  { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptySub:   { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 24 },
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
