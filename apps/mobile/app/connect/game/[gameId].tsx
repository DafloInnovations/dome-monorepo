import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConnectActions, useGameDetail, type GameParticipant } from "../../../src/hooks/useConnect";
import { useAuth } from "../../../src/context/AuthContext";
import { useOpenThread } from "../../../src/hooks/useChat";

const C = {
  bg: "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text: "#0A0A0A",
  muted: "#9E9E9E",
  border: "#EBEBEB",
  green: "#22C55E",
};

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

const SKILL_COLOR: Record<string, string> = {
  BEGINNER: "#9E9E9E", ROOKIE: "#22C55E", INTERMEDIATE: "#3B82F6",
  ADVANCED: "#A855F7", PRO: "#F59E0B", ELITE: "#F59E0B", ANY: "#9E9E9E",
};

function formatGameDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

interface PlayerRowProps {
  participant: GameParticipant;
  isHost: boolean;
  gameId: string;
  onAction: () => void;
}

function PlayerRow({ participant, isHost, gameId, onAction }: PlayerRowProps) {
  const { confirmPlayer, declinePlayer } = useConnectActions();
  const name = [participant.user.firstName, participant.user.lastName]
    .filter(Boolean)
    .join(" ") || "Player";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  async function handleConfirm() {
    try {
      await confirmPlayer(gameId, participant.userId);
      onAction();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not confirm player.");
    }
  }

  async function handleDecline() {
    try {
      await declinePlayer(gameId, participant.userId);
      onAction();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not decline player.");
    }
  }

  return (
    <View style={styles.playerRow}>
      <View style={styles.playerAvatar}>
        <Text style={styles.playerInitials}>{initials}</Text>
      </View>
      <Text style={styles.playerName} numberOfLines={1}>{name}</Text>

      <View style={styles.playerActions}>
        {participant.status === "CONFIRMED" && (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedBadgeText}>✓ Confirmed</Text>
          </View>
        )}
        {participant.status === "DECLINED" && (
          <View style={styles.declinedBadge}>
            <Text style={styles.declinedBadgeText}>Declined</Text>
          </View>
        )}
        {participant.status === "PENDING" && isHost && (
          <>
            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>✓ Confirm</Text>
            </Pressable>
            <Pressable style={styles.declineBtn} onPress={handleDecline}>
              <Text style={styles.declineBtnText}>✕ Decline</Text>
            </Pressable>
          </>
        )}
        {participant.status === "PENDING" && !isHost && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export default function GameDetailScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { game, isLoading, error, refetch } = useGameDetail(gameId!);
  const { joinGame, isLoading: isJoining } = useConnectActions();
  const { openThread, isLoading: isOpeningThread } = useOpenThread();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (error || !game) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "Game not found."}</Text>
        <Pressable style={styles.retryBtn} onPress={refetch}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const sport = game.sport.toUpperCase();
  const emoji = SPORT_EMOJI[sport] ?? "🏟";
  const skillColor = SKILL_COLOR[game.skillLevel.toUpperCase()] ?? C.muted;
  const hostName = [game.host.firstName, game.host.lastName].filter(Boolean).join(" ") || "Host";
  const spotsLeft = game.spotsLeft ?? 0;
  const playersNeeded = game.playersNeeded ?? 0;
  const playersConfirmed = game.playersConfirmed ?? 0;
  const fillRatio = playersNeeded > 0 ? Math.min(1, playersConfirmed / playersNeeded) : 0;

  const isHost = game.hostUserId === user?.id;
  const myParticipation = game.participants.find((p) => p.userId === user?.id);
  const isConfirmed = myParticipation?.status === "CONFIRMED";
  const isPending = myParticipation?.status === "PENDING";
  const isFull = game.status === "FULL" || spotsLeft <= 0;

  async function handleJoin() {
    if (!user) {
      router.push("/(auth)/phone");
      return;
    }
    try {
      await joinGame(gameId!);
      refetch();
      Alert.alert("Request Sent!", "The host will confirm your spot soon.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not join game.");
    }
  }

  const visibleParticipants = isHost
    ? game.participants
    : game.participants.filter((p) => p.status !== "DECLINED");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Nav */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      {/* Sport badge + title */}
      <View style={styles.sportHeader}>
        <Text style={styles.sportEmoji}>{emoji}</Text>
        <View style={styles.sportMeta}>
          <Text style={styles.sportName}>{sport}</Text>
          <View style={[styles.skillBadge, { borderColor: skillColor }]}>
            <Text style={[styles.skillText, { color: skillColor }]}>{game.skillLevel}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, game.status === "OPEN" ? styles.statusOpen : styles.statusFull]}>
          <Text style={styles.statusText}>{game.status}</Text>
        </View>
      </View>

      {/* Facility + time */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>Location & Time</Text>
        <Text style={styles.facilityName}>{game.facility.name}</Text>
        {game.facility.address ? (
          <Text style={styles.facilityAddr}>
            {game.facility.address.street}, {game.facility.address.city}
          </Text>
        ) : null}
        {game.gameDate ? (
          <Text style={styles.gameDate}>{formatGameDate(game.gameDate)}</Text>
        ) : null}
        {game.startTime && game.endTime ? (
          <Text style={styles.gameTime}>{game.startTime} – {game.endTime}</Text>
        ) : null}
      </View>

      {/* Host card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>Host</Text>
        <View style={styles.hostRow}>
          <View style={styles.hostAvatar}>
            <Text style={styles.hostAvatarText}>
              {hostName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.hostName}>{hostName}</Text>
            <View style={[styles.skillBadge, { borderColor: skillColor, marginTop: 4 }]}>
              <Text style={[styles.skillText, { color: skillColor }]}>{game.skillLevel}</Text>
            </View>
          </View>
        </View>
        {game.description ? (
          <Text style={styles.description}>{game.description}</Text>
        ) : null}
      </View>

      {/* Players */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>Players</Text>
        <View style={styles.playersRow}>
          <Text style={styles.playersCount}>{playersConfirmed}/{playersNeeded} confirmed</Text>
          {!isFull ? (
            <Text style={styles.spotsLeft}>{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</Text>
          ) : (
            <Text style={styles.fullText}>Game Full</Text>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(fillRatio * 100)}%` }]} />
        </View>

        {visibleParticipants.length > 0 ? (
          <View style={styles.playerList}>
            {visibleParticipants.map((p) => (
              <PlayerRow
                key={p.id}
                participant={p}
                isHost={isHost}
                gameId={gameId!}
                onAction={refetch}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.noPlayersText}>No players yet.</Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {isHost ? (
          <View style={styles.hostTagBtn}>
            <Text style={styles.hostTagBtnText}>Your Game</Text>
          </View>
        ) : isConfirmed ? (
          <View style={styles.confirmedBtn}>
            <Text style={styles.confirmedBtnText}>✓ You're In!</Text>
          </View>
        ) : isPending ? (
          <View style={[styles.joinBtn, styles.joinBtnPending]}>
            <Text style={styles.joinBtnText}>⏳ Request Pending</Text>
          </View>
        ) : isFull ? (
          <View style={[styles.joinBtn, styles.joinBtnDisabled]}>
            <Text style={[styles.joinBtnText, { color: C.muted }]}>Game Full</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.joinBtn, isJoining && styles.joinBtnDisabled]}
            onPress={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color={C.text} />
            ) : (
              <Text style={styles.joinBtnText}>Request to Join</Text>
            )}
          </Pressable>
        )}

        {!isHost && (
          <Pressable
            style={[styles.messageBtn, isOpeningThread && styles.messageBtnDisabled]}
            disabled={isOpeningThread}
            onPress={async () => {
              if (!user) { router.push("/(auth)/phone"); return; }
              try {
                const thread = await openThread(game.host.id, gameId!);
                const otherUserName = [game.host.firstName, game.host.lastName].filter(Boolean).join(" ") || "Host";
                router.push({
                  pathname: "/chat/[threadId]",
                  params: {
                    threadId: thread.id,
                    otherUserName,
                    gameId: gameId!,
                    gameSport: game.sport,
                    gameFacility: game.facility.name,
                    gameDate: game.gameDate ?? "",
                    gameStartTime: game.startTime ?? "",
                    gameEndTime: game.endTime ?? "",
                  },
                });
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Could not open chat.");
              }
            }}
          >
            {isOpeningThread ? (
              <ActivityIndicator color={C.text} size="small" />
            ) : (
              <Text style={styles.messageBtnText}>Message Host</Text>
            )}
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 16, paddingTop: Platform.OS === "ios" ? 60 : 20, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  backBtn: { marginBottom: 20 },
  backBtnText: { color: C.primary, fontSize: 15, fontWeight: "600" },

  sportHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sportEmoji: { fontSize: 36 },
  sportMeta: { flex: 1, gap: 6 },
  sportName: { color: C.text, fontSize: 20, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  skillBadge: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  skillText: { fontSize: 10, fontWeight: "700" },
  statusBadge: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  statusOpen: { backgroundColor: C.green + "22", borderWidth: 1, borderColor: C.green },
  statusFull: { backgroundColor: C.primary + "22", borderWidth: 1, borderColor: C.primary },
  statusText: { color: C.text, fontSize: 11, fontWeight: "700" },

  card: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardSectionLabel: {
    color: C.muted, fontSize: 11, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10,
  },
  facilityName: { color: C.text, fontSize: 17, fontWeight: "700", marginBottom: 4 },
  facilityAddr: { color: C.muted, fontSize: 13, marginBottom: 8 },
  gameDate: { color: C.text, fontSize: 15, fontWeight: "600", marginBottom: 2 },
  gameTime: { color: C.primary, fontSize: 22, fontWeight: "800" },

  hostRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hostAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.primary + "33", borderWidth: 2, borderColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  hostAvatarText: { color: C.primary, fontSize: 16, fontWeight: "800" },
  hostName: { color: C.text, fontSize: 16, fontWeight: "700" },
  description: { color: C.muted, fontSize: 14, marginTop: 12, lineHeight: 20 },

  playersRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  playersCount: { color: C.muted, fontSize: 13 },
  spotsLeft: { color: C.primary, fontSize: 13, fontWeight: "700" },
  fullText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, backgroundColor: C.border, borderRadius: 3, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: 6, backgroundColor: C.primary, borderRadius: 3 },

  playerList: { gap: 10 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  playerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.border, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  playerInitials: { color: C.text, fontSize: 12, fontWeight: "700" },
  playerName: { color: C.text, fontSize: 14, fontWeight: "600", flex: 1 },
  playerActions: { flexDirection: "row", gap: 6, alignItems: "center" },

  confirmBtn: {
    backgroundColor: C.green + "22",
    borderWidth: 1,
    borderColor: C.green,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confirmBtnText: { color: C.green, fontSize: 12, fontWeight: "700" },
  declineBtn: {
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  declineBtnText: { color: C.muted, fontSize: 12, fontWeight: "700" },

  confirmedBadge: {
    backgroundColor: C.green + "22",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confirmedBadgeText: { color: C.green, fontSize: 11, fontWeight: "700" },
  declinedBadge: {
    backgroundColor: "#F0F0F0",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  declinedBadgeText: { color: C.muted, fontSize: 11, fontWeight: "700" },
  pendingBadge: {
    backgroundColor: "#F59E0B22",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: { color: "#F59E0B", fontSize: 11, fontWeight: "700" },

  noPlayersText: { color: C.muted, fontSize: 13, textAlign: "center", paddingVertical: 8 },

  actions: { gap: 10, marginTop: 4 },
  joinBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  joinBtnPending: { backgroundColor: "#EBEBEB", borderWidth: 1, borderColor: "#F59E0B" },
  joinBtnDisabled: { backgroundColor: "#F0F0F0" },
  joinBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  confirmedBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
    backgroundColor: C.green + "22", borderWidth: 1.5, borderColor: C.green,
  },
  confirmedBtnText: { color: C.green, fontSize: 16, fontWeight: "800" },
  hostTagBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: "center",
    borderWidth: 1.5, borderColor: C.primary,
  },
  hostTagBtnText: { color: C.primary, fontSize: 16, fontWeight: "800" },
  messageBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: "center",
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  messageBtnDisabled: { opacity: 0.5 },
  messageBtnText: { color: C.text, fontSize: 15, fontWeight: "600" },

  errorText: { color: "#EF4444", fontSize: 15, marginBottom: 14, textAlign: "center" },
  retryBtn: { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
});
