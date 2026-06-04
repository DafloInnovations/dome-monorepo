import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { OpenGame } from "../hooks/useConnect";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
  green: "#22C55E",
};

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

const SKILL_COLOR: Record<string, string> = {
  BEGINNER: "#6B6B6B", ROOKIE: "#22C55E", INTERMEDIATE: "#3B82F6",
  ADVANCED: "#A855F7", PRO: "#F59E0B", ELITE: "#F59E0B", ANY: "#6B6B6B",
};

function formatGameDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

interface Props {
  game: OpenGame;
  onJoin?: (gameId: string) => void;
  joinedGameIds?: Set<string>;
  currentUserId?: string;
}

export default function GameCard({ game, onJoin, joinedGameIds, currentUserId }: Props) {
  const router = useRouter();
  const sport = game.sport.toUpperCase();
  const emoji = SPORT_EMOJI[sport] ?? "🏟";
  const skillColor = SKILL_COLOR[game.skillLevel.toUpperCase()] ?? C.muted;
  const spotsLeft = game.spotsLeft ?? 0;
  const playersNeeded = game.playersNeeded ?? 0;
  const playersConfirmed = game.playersConfirmed ?? 0;
  const fillRatio = playersNeeded > 0 ? Math.min(1, playersConfirmed / playersNeeded) : 0;

  const isHost = currentUserId === game.host.id;
  const isJoined = joinedGameIds?.has(game.id) ?? false;
  const myParticipation = currentUserId
    ? game.participants?.find((participant) => participant.userId === currentUserId)
    : undefined;
  const hasServerParticipation = myParticipation != null;
  const isConfirmed = myParticipation?.status === "CONFIRMED";
  const isPending = myParticipation?.status === "PENDING" || (!hasServerParticipation && isJoined);
  const isFull = game.status === "FULL" || spotsLeft <= 0;

  const hostName = [game.host.firstName, game.host.lastName].filter(Boolean).join(" ") || "Host";

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/connect/game/${game.id}`)}
    >
      {/* Sport header */}
      <View style={styles.header}>
        <View style={styles.sportRow}>
          <Text style={styles.sportEmoji}>{emoji}</Text>
          <Text style={styles.sportName}>{sport}</Text>
        </View>
        <View style={[styles.skillBadge, { borderColor: skillColor }]}>
          <Text style={[styles.skillText, { color: skillColor }]}>
            {game.skillLevel}
          </Text>
        </View>
      </View>

      {/* Facility + time */}
      <Text style={styles.facility} numberOfLines={1}>
        {game.facility.name}
      </Text>
      {game.gameDate || game.startTime ? (
        <Text style={styles.datetime}>
          {formatGameDate(game.gameDate)}
          {game.startTime && game.endTime ? ` · ${game.startTime}–${game.endTime}` : ""}
        </Text>
      ) : null}

      {/* Host */}
      <Text style={styles.host}>Hosted by {hostName}</Text>

      {/* Players bar */}
      <View style={styles.playersSection}>
        <View style={styles.playersRow}>
          <Text style={styles.playersLabel}>
            {playersConfirmed}/{playersNeeded} players
          </Text>
          {!isFull ? (
            <Text style={styles.spotsLeft}>
              {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
            </Text>
          ) : (
            <Text style={styles.full}>Full</Text>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(fillRatio * 100)}%` }]} />
        </View>
      </View>

      {/* Action button */}
      {isHost ? (
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>Your Game</Text>
        </View>
      ) : isConfirmed ? (
        <View style={[styles.joinBtn, styles.joinBtnConfirmed]}>
          <Text style={styles.joinBtnConfirmedText}>✓ You're In!</Text>
        </View>
      ) : isPending ? (
        <View style={[styles.joinBtn, styles.joinBtnPending]}>
          <Text style={styles.joinBtnPendingText}>⏳ Request Pending</Text>
        </View>
      ) : isFull ? (
        <View style={[styles.joinBtn, styles.joinBtnDisabled]}>
          <Text style={[styles.joinBtnText, { color: C.muted }]}>Game Full</Text>
        </View>
      ) : (
        <Pressable
          style={styles.joinBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onJoin?.(game.id);
          }}
        >
          <Text style={styles.joinBtnText}>Request to Join</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sportRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sportEmoji: { fontSize: 22 },
  sportName: { color: C.text, fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  skillBadge: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 10, fontWeight: "700" },
  facility: { color: C.text, fontSize: 15, fontWeight: "600", marginBottom: 3 },
  datetime: { color: C.muted, fontSize: 13, marginBottom: 4 },
  host: { color: C.muted, fontSize: 12, marginBottom: 12 },
  playersSection: { marginBottom: 14 },
  playersRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  playersLabel: { color: C.muted, fontSize: 12 },
  spotsLeft: { color: C.primary, fontSize: 12, fontWeight: "700" },
  full: { color: C.muted, fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: C.primary, borderRadius: 3 },
  joinBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  joinBtnConfirmed: { backgroundColor: C.green + "22", borderWidth: 1, borderColor: C.green },
  joinBtnPending: { backgroundColor: C.primary + "22", borderWidth: 1, borderColor: C.primary },
  joinBtnDisabled: { backgroundColor: "#2A2A2A" },
  joinBtnText: { color: C.text, fontSize: 14, fontWeight: "700" },
  joinBtnConfirmedText: { color: C.green, fontSize: 14, fontWeight: "800" },
  joinBtnPendingText: { color: C.primary, fontSize: 14, fontWeight: "800" },
  hostBadge: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  hostBadgeText: { color: C.primary, fontSize: 14, fontWeight: "700" },
});
