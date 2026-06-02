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
import { useAuth } from "../../src/context/AuthContext";
import { useSocket } from "../../src/context/SocketContext";
import { useThreads, type ChatThread } from "../../src/hooks/useChat";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function initials(firstName = "", lastName = ""): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", BASKETBALL: "🏀",
  SOCCER: "⚽", CRICKET: "🏏", SQUASH: "🎯", VOLLEYBALL: "🏐",
  HOCKEY: "🏒", BASEBALL: "⚾",
};

function ThreadRow({ thread, currentUserId }: { thread: ChatThread; currentUserId: string }) {
  const router = useRouter();
  const other = thread.otherParticipants[0];
  const otherUserName = other
    ? [other.user.firstName, other.user.lastName].filter(Boolean).join(" ") || "User"
    : "Chat";
  const otherInitials = other ? initials(other.user.firstName, other.user.lastName) : "?";

  const lastMsg = thread.lastMessage;
  const preview = lastMsg
    ? lastMsg.senderId === currentUserId
      ? `You: ${lastMsg.content}`
      : lastMsg.content
    : "No messages yet";
  const time = lastMsg ? formatRelativeTime(lastMsg.createdAt) : formatRelativeTime(thread.updatedAt);
  const hasUnread = thread.unreadCount > 0;

  const game = thread.game;
  const gameContextLine = game?.sport
    ? `${SPORT_EMOJI[game.sport] ?? "🏟️"} ${game.sport.charAt(0) + game.sport.slice(1).toLowerCase()}${game.facility ? ` · ${game.facility}` : ""}`
    : null;

  return (
    <Pressable
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: "/chat/[threadId]",
          params: {
            threadId: thread.id,
            otherUserName,
            ...(thread.openGameId ? { gameId: thread.openGameId } : {}),
            ...(game?.sport ? { gameSport: game.sport } : {}),
            ...(game?.facility ? { gameFacility: game.facility } : {}),
            ...(game?.date ? { gameDate: game.date } : {}),
            ...(game?.startTime ? { gameStartTime: game.startTime } : {}),
            ...(game?.endTime ? { gameEndTime: game.endTime } : {}),
          },
        })
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{otherInitials}</Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
            {otherUserName}
          </Text>
          <Text style={[styles.rowTime, hasUnread && styles.rowTimeUnread]}>{time}</Text>
        </View>
        {gameContextLine ? (
          <Text style={styles.gameContext} numberOfLines={1}>{gameContextLine}</Text>
        ) : null}
        <View style={styles.rowFooter}>
          <Text
            style={[styles.rowPreview, hasUnread && styles.rowPreviewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatsTab() {
  const { user } = useAuth();
  const { isConnected, isConnecting } = useSocket();
  const { threads, isLoading, error, refetch } = useThreads();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Chats</Text>
          <View style={styles.connectionPill}>
            <View style={[styles.connDot, isConnected ? styles.connOnline : styles.connOffline]} />
            <Text style={styles.connText}>
              {isConnecting ? "Connecting…" : isConnected ? "Live" : "Offline"}
            </Text>
          </View>
        </View>
      </View>

      {isLoading && !threads.length ? (
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
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <ThreadRow thread={item} currentUserId={user?.id ?? ""} />
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySub}>
                Tap "Message Host" on any game to start a conversation.
              </Text>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: C.text, fontSize: 28, fontWeight: "800" },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.surface,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  connOnline: { backgroundColor: "#22C55E" },
  connOffline: { backgroundColor: C.muted },
  connText: { color: C.muted, fontSize: 11, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#ff6b6b", fontSize: 14, marginBottom: 14, textAlign: "center" },
  retryBtn: { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: C.text, fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.primary + "22",
    borderWidth: 1.5,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: C.primary, fontSize: 17, fontWeight: "800" },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  rowName: { color: C.muted, fontSize: 15, fontWeight: "600", flex: 1 },
  rowNameUnread: { color: C.text, fontWeight: "700" },
  rowTime: { color: C.muted, fontSize: 12, marginLeft: 8 },
  rowTimeUnread: { color: C.primary, fontWeight: "700" },
  gameContext: { color: C.primary, fontSize: 12, fontWeight: "600", marginBottom: 3 },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPreview: { color: C.muted, fontSize: 13, flex: 1 },
  rowPreviewUnread: { color: C.text, fontWeight: "600" },
  badge: {
    backgroundColor: C.primary,
    borderRadius: 99,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: C.text, fontSize: 11, fontWeight: "800" },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 80 },

  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
