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
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function initials(firstName = "", lastName = ""): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

function ThreadRow({ thread, currentUserId }: { thread: ChatThread; currentUserId: string }) {
  const router = useRouter();
  const other = thread.otherParticipants[0];
  const otherName = other
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

  return (
    <Pressable
      style={styles.row}
      onPress={() =>
        router.push({
          pathname: "/chat/[threadId]",
          params: { threadId: thread.id, otherName },
        })
      }
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{otherInitials}</Text>
      </View>

      {/* Content */}
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowName} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.rowTime}>{time}</Text>
        </View>
        <View style={styles.rowFooter}>
          <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
          {thread.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>
                {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatListScreen() {
  const { user } = useAuth();
  const { threads, isLoading, error, refetch } = useThreads();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
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
              <Text style={styles.emptySub}>Message a host from a game to start chatting.</Text>
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
  title: { color: C.text, fontSize: 28, fontWeight: "800" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#ff6b6b", fontSize: 14, marginBottom: 14, textAlign: "center" },
  retryBtn: {
    backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10,
  },
  retryText: { color: C.text, fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.bg,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.primary + "33",
    borderWidth: 1.5,
    borderColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: C.primary, fontSize: 16, fontWeight: "800" },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  rowName: { color: C.text, fontSize: 15, fontWeight: "700", flex: 1 },
  rowTime: { color: C.muted, fontSize: 12, flexShrink: 0, marginLeft: 8 },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPreview: { color: C.muted, fontSize: 13, flex: 1 },
  unreadBadge: {
    backgroundColor: C.primary,
    borderRadius: 99,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
  unreadCount: { color: C.text, fontSize: 11, fontWeight: "800" },
  separator: { height: 1, backgroundColor: C.border, marginLeft: 78 },

  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center" },
});
