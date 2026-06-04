import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import GameCard from "../../src/components/GameCard";
import { useConnectActions, useGames } from "../../src/hooks/useConnect";
import { useAuth } from "../../src/context/AuthContext";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const SPORTS = ["BADMINTON", "PICKLEBALL", "TENNIS", "SOCCER", "BASKETBALL", "VOLLEYBALL", "HOCKEY", "CRICKET"];

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thisWeekEnd() {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ConnectScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "week">("all");
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const gamesFilter = useMemo(() => {
    const f: Record<string, string> = {};
    if (timeFilter === "today") f["date"] = todayStr();
    if (sportFilter) f["sport"] = sportFilter;
    return f;
  }, [timeFilter, sportFilter]);

  const { games, isLoading, error, refetch } = useGames(gamesFilter);
  const { joinGame, isLoading: isJoining } = useConnectActions();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch])
  );

  const filtered = useMemo(() => {
    if (timeFilter !== "week") return games;
    const end = thisWeekEnd();
    const today = todayStr();
    return games.filter((g) => g.gameDate != null && g.gameDate >= today && g.gameDate <= end);
  }, [games, timeFilter]);

  const handleJoin = useCallback(async (gameId: string) => {
    if (!user) {
      router.push("/(auth)/phone");
      return;
    }
    try {
      await joinGame(gameId);
      setJoinedIds((prev) => new Set([...prev, gameId]));
      Alert.alert("Request Sent!", "The host will confirm your spot.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not join game.");
    }
  }, [user, joinGame, router]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>CONNECT</Text>
          <View style={styles.redDot} />
        </View>
        <Pressable
          style={styles.postBtn}
          onPress={() => router.push("/connect/post-game")}
        >
          <Text style={styles.postBtnText}>+ Post a Game</Text>
        </Pressable>
      </View>

      {/* Filter pills */}
      <View style={styles.filterScroll}>
        {/* Time filters */}
        {(["all", "today", "week"] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.pill, timeFilter === f && styles.pillActive]}
            onPress={() => setTimeFilter(f)}
          >
            <Text style={[styles.pillText, timeFilter === f && styles.pillTextActive]}>
              {f === "all" ? "All" : f === "today" ? "Today" : "This Week"}
            </Text>
          </Pressable>
        ))}

        {/* Sport filters */}
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
      </View>

      {/* Content */}
      {isLoading && !games.length ? (
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
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GameCard
              game={item}
              onJoin={handleJoin}
              joinedGameIds={joinedIds}
              currentUserId={user?.id}
            />
          )}
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
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🏟</Text>
              <Text style={styles.emptyTitle}>No open games near you.</Text>
              <Text style={styles.emptySub}>Be the first to post!</Text>
              <Pressable
                style={styles.postBtnLarge}
                onPress={() => router.push("/connect/post-game")}
              >
                <Text style={styles.postBtnText}>Post a Game</Text>
              </Pressable>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginTop: 4 },
  postBtn: {
    backgroundColor: C.primary,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postBtnText: { color: C.text, fontSize: 13, fontWeight: "700" },
  filterScroll: {
    flexDirection: "row",
    flexWrap: "nowrap",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    overflow: "scroll" as any,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: C.text },
  list: { paddingBottom: 32, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  errorText: { color: "#ff6b6b", fontSize: 15, marginBottom: 14, textAlign: "center", paddingHorizontal: 32 },
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
  postBtnLarge: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
});
