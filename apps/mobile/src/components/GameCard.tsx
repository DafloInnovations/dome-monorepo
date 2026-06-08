import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../theme";
import type { OpenGame } from "../hooks/useConnect";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

// Skill level colors — not sport colors, used as semantic tier indicators only
const SKILL_COLOR: Record<string, string> = {
  BEGINNER:     COLORS.textMuted,
  ROOKIE:       COLORS.success,
  INTERMEDIATE: "#3B82F6",
  ADVANCED:     "#A855F7",
  PRO:          COLORS.warning,
  ELITE:        COLORS.warning,
  ANY:          COLORS.textMuted,
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
  const skillColor = SKILL_COLOR[game.skillLevel.toUpperCase()] ?? COLORS.textMuted;
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

  // Use sport accent color for the sport badge border (subtle use ✅)
  const sportColors = COLORS.sports[sport as keyof typeof COLORS.sports];

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/connect/game/${game.id}`)}
    >
      {/* Sport header */}
      <View style={styles.header}>
        <View style={[styles.sportBadge, sportColors && { borderColor: sportColors.accent, backgroundColor: sportColors.bg }]}>
          <Text style={styles.sportEmoji}>{emoji}</Text>
          <Text style={[styles.sportName, sportColors && { color: sportColors.accent }]}>{sport}</Text>
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
          <Text style={[styles.joinBtnText, { color: COLORS.textMuted }]}>Game Full</Text>
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
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.surfaceElevated,
  },
  sportEmoji: { fontSize: 16 },
  sportName: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  skillBadge: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 10, fontWeight: "700" },
  facility: { color: COLORS.text, fontSize: 15, fontWeight: "600", marginBottom: 3 },
  datetime: { color: COLORS.textMuted, fontSize: 13, marginBottom: 4 },
  host: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12 },
  playersSection: { marginBottom: 14 },
  playersRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  playersLabel: { color: COLORS.textMuted, fontSize: 12 },
  spotsLeft: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  full: { color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  progressTrack: { height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: COLORS.primary, borderRadius: 3 },
  joinBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  joinBtnConfirmed: { backgroundColor: COLORS.success + "18", borderWidth: 1, borderColor: COLORS.success },
  joinBtnPending: { backgroundColor: COLORS.primaryUltraLight, borderWidth: 1, borderColor: COLORS.primaryLight },
  joinBtnDisabled: { backgroundColor: COLORS.surfaceElevated },
  joinBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  joinBtnConfirmedText: { color: COLORS.success, fontSize: 14, fontWeight: "800" },
  joinBtnPendingText: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  hostBadge: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  hostBadgeText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
});
