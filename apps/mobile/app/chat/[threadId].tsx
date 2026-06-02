import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useSocket } from "../../src/context/SocketContext";
import { useChat, type ChatMessage } from "../../src/hooks/useChat";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
  own: "#E85068",
  other: "#1C1C1E",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// Parses YYYY-MM-DD as local date (avoids UTC-midnight timezone shift)
function formatDisplayDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n!))) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", BASKETBALL: "🏀",
  SOCCER: "⚽", CRICKET: "🏏", SQUASH: "🎯", VOLLEYBALL: "🏐",
  HOCKEY: "🏒", BASEBALL: "⚾",
};

function getSportEmoji(sport: string): string {
  return SPORT_EMOJI[sport.toUpperCase()] ?? "🏟️";
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      ).start();

    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    opacity: dot,
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.typingWrap}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

interface BubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showDate: boolean;
  dateLabel: string;
}

function MessageBubble({ message, isOwn, showDate, dateLabel }: BubbleProps) {
  const senderInitials = [message.sender.firstName, message.sender.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <View>
      {showDate && (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{dateLabel}</Text>
        </View>
      )}
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
        {/* Avatar on the left for incoming messages */}
        {!isOwn && (
          <View style={styles.senderAvatar}>
            <Text style={styles.senderAvatarText}>{senderInitials}</Text>
          </View>
        )}

        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          <Text style={styles.bubbleText}>{message.content}</Text>
          <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
            {formatTime(message.createdAt)}
          </Text>
        </View>

        {/* Right-side spacer so incoming bubbles never push flush to the right edge */}
        {!isOwn && <View style={styles.bubbleSpacer} />}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const {
    threadId,
    otherUserName,
    gameId,
    gameSport,
    gameFacility,
    gameDate,
    gameStartTime,
    gameEndTime,
  } = useLocalSearchParams<{
    threadId: string;
    otherUserName?: string;
    gameId?: string;
    gameSport?: string;
    gameFacility?: string;
    gameDate?: string;
    gameStartTime?: string;
    gameEndTime?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected, isConnecting } = useSocket();

  const {
    messages,
    isLoading,
    isSending,
    error,
    hasMore,
    typingUsers,
    loadMore,
    sendMessage,
    emitTypingStart,
    emitTypingStop,
    markRead,
  } = useChat(threadId!);

  const [inputText, setInputText] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Mark read when screen focuses
  useEffect(() => {
    markRead();
  }, [markRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending) return;
    setInputText("");
    emitTypingStop();
    isTypingRef.current = false;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    await sendMessage(text);
  }, [inputText, isSending, sendMessage, emitTypingStop]);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      emitTypingStart();
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      emitTypingStop();
      isTypingRef.current = false;
    }, 2000);
  }, [emitTypingStart, emitTypingStop]);

  // Build display data with date separators
  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const prev = messages[index - 1];
    const showDate =
      index === 0 ||
      (prev != null && formatDate(item.createdAt) !== formatDate(prev.createdAt));
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        showDate={showDate}
        dateLabel={formatDate(item.createdAt)}
      />
    );
  }, [messages, user?.id]);

  const isOtherTyping = typingUsers.size > 0;
  const hasGameContext = !!gameSport;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Rich header */}
      <View style={styles.header}>
        {/* Back + name row */}
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <View style={styles.headerMid}>
            <Text style={styles.headerName} numberOfLines={1}>
              {otherUserName ?? "Chat"}
            </Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
              <Text style={styles.statusText}>
                {isConnecting ? "Connecting…" : isConnected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </View>

        {/* Game context card */}
        {hasGameContext && (
          <View style={styles.gameCard}>
            <Text style={styles.gameEmoji}>{getSportEmoji(gameSport!)}</Text>
            <View style={styles.gameInfo}>
              <Text style={styles.gameTitle} numberOfLines={1}>
                {gameSport!.charAt(0) + gameSport!.slice(1).toLowerCase()}
                {gameFacility ? ` · ${gameFacility}` : ""}
              </Text>
              {(gameDate || gameStartTime) ? (
                <Text style={styles.gameTime}>
                  {formatDisplayDate(gameDate)}
                  {gameStartTime && gameEndTime ? ` · ${gameStartTime}–${gameEndTime}` : ""}
                </Text>
              ) : null}
            </View>
            {gameId ? (
              <Pressable
                onPress={() => router.push({ pathname: "/connect/game/[gameId]", params: { gameId } })}
              >
                <Text style={styles.viewGameLink}>View →</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      {/* Messages */}
      {isLoading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.2}
          onEndReached={() => {}} // scroll up to load more handled by header
          ListHeaderComponent={
            hasMore ? (
              <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator color={C.muted} size="small" />
                ) : (
                  <Text style={styles.loadMoreText}>Load earlier messages</Text>
                )}
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
        />
      )}

      {/* Typing indicator */}
      {isOtherTyping && <TypingIndicator />}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder="Message…"
          placeholderTextColor={C.muted}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <Pressable
          style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color={C.text} size="small" />
          ) : (
            <Text style={styles.sendBtnText}>↑</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: "#0A0A0A",
    paddingTop: Platform.OS === "ios" ? 52 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.surface,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  backBtn: { padding: 2 },
  backBtnText: { color: C.primary, fontSize: 16, fontWeight: "600" },
  headerMid: { flex: 1 },
  headerName: { color: C.text, fontSize: 17, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusOnline: { backgroundColor: "#22C55E" },
  statusOffline: { backgroundColor: C.muted },
  statusText: { color: C.muted, fontSize: 11 },

  gameCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gameEmoji: { fontSize: 20 },
  gameInfo: { flex: 1 },
  gameTitle: { color: C.text, fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  gameTime: { color: C.muted, fontSize: 12, marginTop: 2 },
  viewGameLink: { color: C.primary, fontSize: 12, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: "#ff6b6b", fontSize: 14, textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 14, textAlign: "center" },

  messageList: { paddingVertical: 16, flexGrow: 1 },

  loadMoreBtn: { alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: C.muted, fontSize: 13 },

  dateSeparator: { alignItems: "center", marginVertical: 12 },
  dateSeparatorText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: C.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: "hidden",
  },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 4,
    marginHorizontal: 12,
  },
  bubbleRowOwn: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },

  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    flexShrink: 0,
  },
  senderAvatarText: { color: C.primary, fontSize: 12, fontWeight: "700" },

  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: { backgroundColor: C.own, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.other, borderBottomLeftRadius: 4 },
  bubbleSpacer: { width: 40 },

  bubbleText: { color: C.text, fontSize: 15, lineHeight: 20 },
  timestamp: { fontSize: 11, marginTop: 4 },
  timestampOwn: { color: "rgba(255,255,255,0.6)", textAlign: "right" },
  timestampOther: { color: C.muted, textAlign: "left" },

  typingWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  typingBubble: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: C.other,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignSelf: "flex-start",
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  input: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: C.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: C.border },
  sendBtnText: { color: C.text, fontSize: 18, fontWeight: "800" },
});
