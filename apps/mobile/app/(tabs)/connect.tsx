import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConnectActions, useGames, type GamesFilter, type OpenGame } from "../../src/hooks/useConnect";
import { useAuth } from "../../src/context/AuthContext";
import { useThreads } from "../../src/hooks/useChat";
import { useNotificationsContext } from "../../src/context/NotificationsContext";
import { Alert } from "react-native";

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
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  CRICKET: "🏏", BASEBALL: "⚾",
};

const SPORT_ACCENT: Record<string, string> = {
  BADMINTON:  "#4CAF50",
  PICKLEBALL: "#FF9800",
  TENNIS:     "#FFC107",
  BASKETBALL: "#FF5722",
  SOCCER:     "#2196F3",
  VOLLEYBALL: "#FF9800",
  HOCKEY:     "#2196F3",
  CRICKET:    "#9C27B0",
  SQUASH:     "#9C27B0",
};

const SKILL_COLOR: Record<string, string> = {
  BEGINNER:     "#9E9E9E",
  ROOKIE:       "#22C55E",
  INTERMEDIATE: "#3B82F6",
  ADVANCED:     "#A855F7",
  PRO:          "#F59E0B",
  ELITE:        "#F59E0B",
  ANY:          "#9E9E9E",
};

const SPORTS = ["BADMINTON", "PICKLEBALL", "TENNIS", "BASKETBALL", "SOCCER", "VOLLEYBALL", "HOCKEY", "CRICKET"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtGameDate(dateStr: string | null): string {
  if (!dateStr) return "";
  if (dateStr === localDateStr(0)) return "Today";
  if (dateStr === localDateStr(1)) return "Tomorrow";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hr = h! % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GameCardSkeleton() {
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
      <View style={sk.row}>
        <Animated.View style={[sk.line, { width: "35%", backgroundColor: bg }]} />
        <Animated.View style={[sk.pill, { backgroundColor: bg }]} />
      </View>
      <View style={sk.divider} />
      <Animated.View style={[sk.line, { width: "70%", backgroundColor: bg }]} />
      <Animated.View style={[sk.line, { width: "55%", backgroundColor: bg, marginTop: 6 }]} />
      <Animated.View style={[sk.line, { width: "45%", backgroundColor: bg, marginTop: 6 }]} />
      <View style={sk.divider} />
      <Animated.View style={[sk.line, { width: "85%", backgroundColor: bg }]} />
      <Animated.View style={[sk.line, { width: "100%", backgroundColor: bg, marginTop: 8 }]} />
    </View>
  );
}
const sk = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 20, padding: 16,
    marginBottom: 14, borderLeftWidth: 4, borderLeftColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  row:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  line:    { height: 11, borderRadius: 6 },
  pill:    { width: 72, height: 22, borderRadius: 11 },
});

// ─── My Game Chip ─────────────────────────────────────────────────────────────

function MyGameChip({ game, currentUserId }: { game: OpenGame; currentUserId?: string }) {
  const router = useRouter();
  const sportRaw   = game.sport.toUpperCase();
  const emoji      = SPORT_EMOJI[sportRaw] ?? "🏟";
  const sportColor = SPORT_ACCENT[sportRaw] ?? C.primary;
  const isHost     = currentUserId === game.hostUserId;

  return (
    <Pressable
      style={[myg.chip, { borderTopColor: sportColor }]}
      onPress={() => router.push(`/connect/game/${game.id}`)}
    >
      <Text style={[myg.chipSport, { color: sportColor }]}>
        {emoji} {isHost ? "YOUR GAME" : "JOINED"}
      </Text>
      <Text style={myg.chipTime} numberOfLines={1}>
        {fmtGameDate(game.gameDate)}
        {game.startTime ? `  ${fmtTime(game.startTime)}` : ""}
      </Text>
      <Text style={myg.chipPlayers}>
        {game.playersConfirmed}/{game.playersNeeded ?? "?"} players
      </Text>
      <View style={[myg.chipBtn, isHost && { backgroundColor: C.primary }]}>
        <Text style={[myg.chipBtnText, isHost && { color: "#fff" }]}>
          {isHost ? "Manage" : "View"}
        </Text>
      </View>
    </Pressable>
  );
}
const myg = StyleSheet.create({
  chip: {
    width: 150, backgroundColor: "#fff", borderRadius: 16,
    borderTopWidth: 3, padding: 12, marginRight: 10, gap: 5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  chipSport:     { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  chipTime:      { color: C.text, fontSize: 12, fontWeight: "600" },
  chipPlayers:   { color: C.muted, fontSize: 11 },
  chipBtn: {
    marginTop: 4, backgroundColor: C.surface,
    borderRadius: 8, paddingVertical: 6, alignItems: "center",
  },
  chipBtnText: { color: C.text, fontSize: 11, fontWeight: "700" },
});

// ─── Inline Game Card ─────────────────────────────────────────────────────────

function InlineGameCard({
  game,
  onJoin,
  joinedIds,
  currentUserId,
}: {
  game: OpenGame;
  onJoin: (id: string) => void;
  joinedIds: Set<string>;
  currentUserId?: string;
}) {
  const router     = useRouter();
  const sportRaw   = game.sport.toUpperCase();
  const emoji      = SPORT_EMOJI[sportRaw] ?? "🏟";
  const sportColor = SPORT_ACCENT[sportRaw] ?? C.primary;

  const isHost  = currentUserId === game.hostUserId;
  const myPart  = currentUserId
    ? game.participants?.find((p) => p.userId === currentUserId)
    : undefined;
  const isJoined    = joinedIds.has(game.id);
  const isConfirmed = myPart?.status === "CONFIRMED";
  const isPending   = myPart?.status === "PENDING" || (!myPart && isJoined);
  const isFull      = game.status === "FULL" || (game.spotsLeft ?? 1) <= 0;

  const needed    = game.playersNeeded ?? 0;
  const confirmed = game.playersConfirmed ?? 0;
  const fillRatio = needed > 0 ? Math.min(1, confirmed / needed) : 0;
  const spotsLeft = game.spotsLeft ?? 0;
  const skillKey  = (game.skillLevel ?? "ANY").toUpperCase();
  const skillColor = SKILL_COLOR[skillKey] ?? C.muted;

  const hostInitials = [game.host.firstName?.[0], game.host.lastName?.[0]]
    .filter(Boolean).join("").toUpperCase() || "?";
  const hostName = [game.host.firstName, game.host.lastName].filter(Boolean).join(" ") || "Host";

  const addressText = game.facility.address
    ? `${game.facility.address.street}, ${game.facility.address.city}`
    : null;
  const distText = game.distanceKm != null ? `${game.distanceKm.toFixed(1)} km` : null;

  // Status badge
  let badge: { label: string; color: string; bg: string };
  if (isHost)          badge = { label: "👑 YOUR GAME", color: "#1565C0", bg: "#E3F2FD" };
  else if (isConfirmed)badge = { label: "✓ JOINED",     color: "#7B1FA2", bg: "#F3E5F5" };
  else if (isPending)  badge = { label: "⏳ PENDING",   color: C.primary, bg: "#FFF5F7" };
  else if (isFull)     badge = { label: "● FULL",        color: "#EF4444", bg: "#FEF2F2" };
  else                 badge = { label: "● OPEN",        color: "#22C55E", bg: "#F0FDF4" };

  // Player slots
  const totalSlots = Math.min(Math.max(needed, 1), 6);

  return (
    <Pressable
      style={[gc.card, { borderLeftColor: sportColor }]}
      onPress={() => router.push(`/connect/game/${game.id}`)}
    >
      {/* Header: sport + status */}
      <View style={gc.cardHeader}>
        <Text style={[gc.sportLabel, { color: sportColor }]}>
          {emoji}  {sportRaw}
        </Text>
        <View style={[gc.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[gc.statusText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>

      <View style={gc.divider} />

      {/* Venue / time */}
      <Text style={gc.venueName} numberOfLines={1}>{game.facility.name}</Text>
      {(addressText || distText) ? (
        <Text style={gc.venueAddr} numberOfLines={1}>
          📍 {[addressText, distText].filter(Boolean).join("  ·  ")}
        </Text>
      ) : null}
      {(game.gameDate || game.startTime) ? (
        <Text style={gc.datetime}>
          📅 {fmtGameDate(game.gameDate)}
          {game.startTime && game.endTime
            ? `  ·  ${fmtTime(game.startTime)} — ${fmtTime(game.endTime)}`
            : ""}
        </Text>
      ) : null}

      {game.description ? (
        <Text style={gc.desc} numberOfLines={2}>{game.description}</Text>
      ) : null}

      <View style={gc.divider} />

      {/* Host */}
      <Text style={gc.sectionLabel}>HOST</Text>
      <View style={gc.hostRow}>
        <View style={gc.hostAvatar}>
          <Text style={gc.hostAvatarText}>{hostInitials}</Text>
        </View>
        <View style={gc.hostMeta}>
          <Text style={gc.hostName}>{hostName}</Text>
          <View style={[gc.skillBadge, { borderColor: skillColor, backgroundColor: `${skillColor}18` }]}>
            <Text style={[gc.skillText, { color: skillColor }]}>{game.skillLevel}</Text>
          </View>
        </View>
      </View>

      {/* Players */}
      <Text style={[gc.sectionLabel, { marginTop: 14 }]}>PLAYERS</Text>
      <View style={gc.playersRow}>
        <View style={gc.avatarRow}>
          {Array.from({ length: totalSlots }).map((_, i) => (
            <View key={i} style={[gc.slot, i < confirmed && gc.slotFilled]}>
              <Text style={i < confirmed ? gc.slotFilledIcon : gc.slotEmptyIcon}>
                {i < confirmed ? "👤" : "+"}
              </Text>
            </View>
          ))}
        </View>
        <Text style={gc.spotsText}>
          {confirmed}/{needed > 0 ? needed : "?"}
          {!isFull && spotsLeft > 0 ? ` · ${spotsLeft} left` : ""}
        </Text>
      </View>
      <View style={gc.progressTrack}>
        <View style={[gc.progressFill, {
          width: `${Math.round(fillRatio * 100)}%` as unknown as number,
          backgroundColor: sportColor,
        }]} />
      </View>

      <View style={{ height: 14 }} />

      {/* Action button */}
      {isHost ? (
        <Pressable
          style={gc.btnDark}
          onPress={() => router.push(`/connect/game/${game.id}`)}
        >
          <Text style={gc.btnDarkText}>👑  MANAGE GAME</Text>
        </Pressable>
      ) : isConfirmed ? (
        <View style={gc.btnGreen}>
          <Text style={gc.btnGreenText}>✓  YOU'RE IN!</Text>
        </View>
      ) : isPending ? (
        <View style={gc.btnPending}>
          <Text style={gc.btnPendingText}>⏳  REQUEST PENDING</Text>
        </View>
      ) : isFull ? (
        <View style={gc.btnDisabled}>
          <Text style={gc.btnDisabledText}>🔒  GAME FULL</Text>
        </View>
      ) : (
        <Pressable
          style={gc.btnPrimary}
          onPress={(e) => { e.stopPropagation?.(); onJoin(game.id); }}
        >
          <Text style={gc.btnPrimaryText}>REQUEST TO JOIN</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const gc = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderLeftWidth: 4,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sportLabel:  { fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: "800" },
  divider:     { height: 1, backgroundColor: "#F0F0F0", marginVertical: 12 },
  venueName:   { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 5 },
  venueAddr:   { color: C.muted, fontSize: 13, marginBottom: 4 },
  datetime:    { color: C.muted, fontSize: 13, marginBottom: 4 },
  desc:        { color: "#6B6B6B", fontSize: 13, lineHeight: 18, marginTop: 4 },
  sectionLabel: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  hostRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  hostAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  hostAvatarText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  hostMeta:    { flexDirection: "row", alignItems: "center", gap: 8 },
  hostName:    { color: C.text, fontSize: 14, fontWeight: "700" },
  skillBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:  { fontSize: 10, fontWeight: "800" },
  playersRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  avatarRow:   { flexDirection: "row", gap: 5 },
  slot: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1.5, borderColor: "#E0E0E0",
    borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  slotFilled:      { backgroundColor: "#F0F0F0", borderStyle: "solid", borderColor: "#E0E0E0" },
  slotFilledIcon:  { fontSize: 14 },
  slotEmptyIcon:   { fontSize: 12, color: "#CCCCCC", fontWeight: "700" },
  spotsText:       { color: C.muted, fontSize: 12, fontWeight: "600" },
  progressTrack:   { height: 5, backgroundColor: "#F0F0F0", borderRadius: 3, overflow: "hidden" },
  progressFill:    { height: 5, borderRadius: 3 },
  btnPrimary: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  btnGreen: {
    backgroundColor: "#F0FDF4", borderRadius: 12,
    borderWidth: 1, borderColor: "#22C55E",
    paddingVertical: 14, alignItems: "center",
  },
  btnGreenText: { color: "#22C55E", fontSize: 14, fontWeight: "800" },
  btnPending: {
    backgroundColor: "#FFF5F7", borderRadius: 12,
    borderWidth: 1, borderColor: C.primary,
    paddingVertical: 14, alignItems: "center",
  },
  btnPendingText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  btnDark: {
    backgroundColor: C.text, borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  btnDarkText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  btnDisabled: {
    backgroundColor: "#F5F5F5", borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  btnDisabledText: { color: C.muted, fontSize: 14, fontWeight: "700" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ConnectScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const { threads }     = useThreads();
  const { unreadCount } = useNotificationsContext();
  const unreadMessages  = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);

  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [joinedIds, setJoinedIds]     = useState<Set<string>>(new Set());

  const gamesFilter = useMemo<GamesFilter>(() => {
    const f: GamesFilter = {};
    if (sportFilter) f.sport = sportFilter;
    return f;
  }, [sportFilter]);

  const { games, isLoading, error, refetch } = useGames(gamesFilter);
  const { joinGame } = useConnectActions();

  useFocusEffect(
    useCallback(() => { void refetch(); }, [refetch])
  );

  const filtered = games;

  // My active games
  const myGames = useMemo(() => {
    if (!user?.id) return [];
    return games.filter(
      (g) =>
        g.hostUserId === user.id ||
        g.participants?.some(
          (p) => p.userId === user.id && p.status !== "DECLINED"
        ) ||
        joinedIds.has(g.id)
    );
  }, [games, user?.id, joinedIds]);

  // Stats bar
  const stats = useMemo(() => {
    const open = games.filter((g) => g.status !== "FULL").length;
    const fillRates = games
      .filter((g) => (g.playersNeeded ?? 0) > 0)
      .map((g) => (g.playersConfirmed ?? 0) / (g.playersNeeded ?? 1));
    const avgFill =
      fillRates.length > 0
        ? Math.round((fillRates.reduce((s, r) => s + r, 0) / fillRates.length) * 100)
        : 89;
    return { open, fillRate: avgFill };
  }, [games]);

  const handleJoin = useCallback(
    async (gameId: string) => {
      if (!user) { router.push("/(auth)/phone"); return; }
      try {
        await joinGame(gameId);
        setJoinedIds((prev) => new Set([...prev, gameId]));
        Alert.alert("Request Sent! 🎉", "The host will confirm your spot shortly.");
      } catch (e) {
        Alert.alert("Error", e instanceof Error ? e.message : "Could not join game.");
      }
    },
    [user, joinGame, router]
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasFilters = sportFilter !== null;

  const ListHeader = (
    <>
      {/* My active games */}
      {myGames.length > 0 && (
        <View style={styles.myGamesSection}>
          <Text style={styles.myGamesSectionLabel}>YOUR ACTIVE GAMES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {myGames.map((g) => (
              <MyGameChip key={g.id} game={g} currentUserId={user?.id} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Skeleton loading */}
      {isLoading && games.length === 0 && (
        <>
          <GameCardSkeleton />
          <GameCardSkeleton />
          <GameCardSkeleton />
        </>
      )}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>CONNECT</Text>
            <Text style={styles.titleDot}>.</Text>
          </View>
          <Text style={styles.subtitle}>Find players · Join games</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/(tabs)/chats")} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={22} color={C.text} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {!isLoading && games.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.open}</Text>
            <Text style={styles.statLabel}>{"OPEN\nGAMES"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.fillRate}%</Text>
            <Text style={styles.statLabel}>{"FILL\nRATE"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4.8⭐</Text>
            <Text style={styles.statLabel}>{"AVG\nRATING"}</Text>
          </View>
        </View>
      )}

      {/* ── Filter section ──────────────────────────────────────────────────── */}
      <View style={styles.filterSection}>
        {/* Sport filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <Pressable
            style={[styles.pill, sportFilter === null && styles.pillActive]}
            onPress={() => setSportFilter(null)}
          >
            <Text style={[styles.pillText, sportFilter === null && styles.pillTextActive]}>
              🏟 All
            </Text>
          </Pressable>
          {SPORTS.map((s) => (
            <Pressable
              key={s}
              style={[styles.pill, sportFilter === s && styles.pillActive]}
              onPress={() => setSportFilter(sportFilter === s ? null : s)}
            >
              <Text style={[styles.pillText, sportFilter === s && styles.pillTextActive]}>
                {SPORT_EMOJI[s]} {s.charAt(0) + s.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Post Game CTA */}
        <Pressable
          style={styles.postBtn}
          onPress={() => router.push("/connect/post-game")}
        >
          <Text style={styles.postBtnText}>＋  POST A GAME</Text>
        </Pressable>
      </View>

      {/* ── Game list ───────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InlineGameCard
              game={item}
              onJoin={handleJoin}
              joinedIds={joinedIds}
              currentUserId={user?.id}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && games.length > 0}
              onRefresh={refetch}
              tintColor={C.primary}
              title="Finding games near you…"
              titleColor={C.muted}
            />
          }
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.emptyWrap}>
                {hasFilters ? (
                  <>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>
                      No {sportFilter ? (sportFilter.charAt(0) + sportFilter.slice(1).toLowerCase()) : ""} games
                    </Text>
                    <View style={styles.emptyBtnRow}>
                      <Pressable
                        style={styles.emptyBtnOutline}
                        onPress={() => setSportFilter(null)}
                      >
                        <Text style={styles.emptyBtnOutlineText}>Clear filters</Text>
                      </Pressable>
                      <Pressable
                        style={styles.emptyBtnPrimary}
                        onPress={() => router.push("/connect/post-game")}
                      >
                        <Text style={styles.emptyBtnPrimaryText}>Post one!</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyEmoji}>🏸</Text>
                    <Text style={styles.emptyTitle}>No open games yet</Text>
                    <Text style={styles.emptySub}>Be the first to post a game!</Text>
                    <Pressable
                      style={styles.emptyBtnPrimary}
                      onPress={() => router.push("/connect/post-game")}
                    >
                      <Text style={styles.emptyBtnPrimaryText}>+ Post a Game</Text>
                    </Pressable>
                  </>
                )}
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
  center:  { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingBottom: 12,
  },
  titleRow:    { flexDirection: "row", alignItems: "baseline", gap: 0 },
  title:       { color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  titleDot:    { color: C.primary, fontSize: 28, fontWeight: "900" },
  subtitle:    { color: C.muted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 2 },
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

  // Stats bar
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem:    { flex: 1, alignItems: "center", gap: 3 },
  statValue:   { color: C.primary, fontSize: 20, fontWeight: "900" },
  statLabel:   { color: C.muted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", textAlign: "center", letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  // Filter section
  filterSection: { paddingBottom: 12 },
  filterRow:     { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: C.surface,
  },
  pillActive:     { backgroundColor: C.primary },
  pillText:       { color: C.text, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: "#fff", fontWeight: "700" },

  // Post Game button
  postBtn: {
    marginHorizontal: 16, marginTop: 12,
    backgroundColor: C.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  postBtnText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },

  // My games section
  myGamesSection: { marginBottom: 16, paddingLeft: 16 },
  myGamesSectionLabel: {
    color: C.muted, fontSize: 11, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase",
    marginBottom: 10,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4 },

  // Empty
  emptyWrap:    { alignItems: "center", paddingTop: 56, paddingHorizontal: 32, gap: 10 },
  emptyEmoji:   { fontSize: 52, marginBottom: 6 },
  emptyTitle:   { color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySub:     { color: C.muted, fontSize: 14, textAlign: "center" },
  emptyBtnRow:  { flexDirection: "row", gap: 10, marginTop: 8 },
  emptyBtnPrimary: {
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  emptyBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyBtnOutline: {
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 20,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  emptyBtnOutlineText: { color: C.primary, fontWeight: "700", fontSize: 14 },

  // Error
  errorText: { color: "#EF4444", fontSize: 15, marginBottom: 14, textAlign: "center" },
  retryBtn:  { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
