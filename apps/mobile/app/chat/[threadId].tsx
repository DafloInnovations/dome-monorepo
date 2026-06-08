import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useSocket } from "../../src/context/SocketContext";
import { useChat, type ChatMessage } from "../../src/hooks/useChat";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#F5F5F5",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#F0F0F0",
  own:     "#E85068",
  other:   "#F0F0F0",
};

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", PICKLEBALL: "🏓", TENNIS: "🎾", BASKETBALL: "🏀",
  SOCCER: "⚽", CRICKET: "🏏", SQUASH: "🎯", VOLLEYBALL: "🏐",
  HOCKEY: "🏒", BASEBALL: "⚾",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}

function fmtDateLabel(iso: string): string {
  const d = new Date(iso);
  const today     = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function fmtDisplayDate(dateStr?: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n!))) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function initials(first = "", last = ""): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(560 - delay),
        ])
      ).start();
    animate(d1, 0);
    animate(d2, 180);
    animate(d3, 360);
  }, [d1, d2, d3]);

  const dotAnim = (d: Animated.Value) => ({
    opacity: d,
    transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={ty.wrap}>
      <View style={ty.bubble}>
        <Animated.View style={[ty.dot, dotAnim(d1)]} />
        <Animated.View style={[ty.dot, dotAnim(d2)]} />
        <Animated.View style={[ty.dot, dotAnim(d3)]} />
      </View>
    </View>
  );
}
const ty = StyleSheet.create({
  wrap:   { paddingHorizontal: 16, paddingBottom: 4 },
  bubble: {
    flexDirection: "row", gap: 4,
    backgroundColor: C.other,
    borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    alignSelf: "flex-start",
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message:   ChatMessage;
  isOwn:     boolean;
  showDate:  boolean;
  dateLabel: string;
  showAvatar: boolean;
}

function MessageBubble({ message, isOwn, showDate, dateLabel, showAvatar }: BubbleProps) {
  const inis = initials(message.sender.firstName, message.sender.lastName);

  return (
    <View>
      {showDate && (
        <View style={mb.dateSep}>
          <View style={mb.dateLine} />
          <Text style={mb.dateText}>{dateLabel}</Text>
          <View style={mb.dateLine} />
        </View>
      )}

      <View style={[mb.row, isOwn ? mb.rowOwn : mb.rowOther]}>
        {/* Incoming avatar — only on first of a sequence */}
        {!isOwn && (
          <View style={mb.avatarSlot}>
            {showAvatar ? (
              <View style={mb.avatar}>
                <Text style={mb.avatarText}>{inis}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={[mb.bubble, isOwn ? mb.bubbleOwn : mb.bubbleOther]}>
          <Text style={[mb.text, isOwn ? mb.textOwn : mb.textOther]}>
            {message.content}
          </Text>
          <Text style={[mb.time, isOwn ? mb.timeOwn : mb.timeOther]}>
            {fmtTime(message.createdAt)}
            {isOwn ? "  ✓" : ""}
          </Text>
        </View>

        {/* Right spacer so incoming bubbles never reach right edge */}
        {!isOwn && <View style={{ width: 48 }} />}
      </View>
    </View>
  );
}

const mb = StyleSheet.create({
  dateSep: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 14, paddingHorizontal: 16, gap: 10,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: C.border },
  dateText: {
    color: C.muted, fontSize: 11, fontWeight: "600",
    backgroundColor: C.bg, paddingHorizontal: 8,
  },
  row:      { flexDirection: "row", alignItems: "flex-end", marginVertical: 2, paddingHorizontal: 8 },
  rowOwn:   { justifyContent: "flex-end" },
  rowOther: { justifyContent: "flex-start" },
  avatarSlot: { width: 36, marginRight: 4, alignItems: "center" },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarText:  { color: "#fff", fontSize: 11, fontWeight: "800" },
  bubble: {
    maxWidth: "72%", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleOwn:   { backgroundColor: C.own,   borderBottomRightRadius: 4, marginRight: 8 },
  bubbleOther: { backgroundColor: C.other, borderBottomLeftRadius: 4 },
  text:        { fontSize: 15, lineHeight: 21 },
  textOwn:     { color: "#FFFFFF" },
  textOther:   { color: C.text },
  time:        { fontSize: 11, marginTop: 4 },
  timeOwn:     { color: "rgba(255,255,255,0.55)", textAlign: "right" },
  timeOther:   { color: C.muted },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const {
    threadId, otherUserName,
    gameId, gameSport, gameFacility, gameDate, gameStartTime, gameEndTime,
  } = useLocalSearchParams<{
    threadId: string; otherUserName?: string;
    gameId?: string; gameSport?: string; gameFacility?: string;
    gameDate?: string; gameStartTime?: string; gameEndTime?: string;
  }>();

  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { isConnected, isConnecting } = useSocket();

  const {
    messages, isLoading, isSending, error,
    hasMore, typingUsers,
    loadMore, sendMessage, emitTypingStart, emitTypingStop, markRead,
  } = useChat(threadId!);

  const [inputText, setInputText] = useState("");
  const listRef     = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => { markRead(); }, [markRead]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
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

  const renderItem = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn   = item.senderId === user?.id;
    const prev    = messages[index - 1];
    const next    = messages[index + 1];
    const showDate = index === 0 || (prev != null && fmtDateLabel(item.createdAt) !== fmtDateLabel(prev.createdAt));
    // Show avatar on the first message of each incoming sequence (sender change after prev)
    const showAvatar = !isOwn && (index === 0 || prev?.senderId !== item.senderId);
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        showDate={showDate}
        dateLabel={fmtDateLabel(item.createdAt)}
        showAvatar={showAvatar}
      />
    );
  }, [messages, user?.id]);

  const isOtherTyping = typingUsers.size > 0;
  const hasText       = inputText.trim().length > 0;

  const sportEmoji = gameSport ? (SPORT_EMOJI[gameSport.toUpperCase()] ?? "🏟️") : null;
  const headerTitle = otherUserName ?? "Chat";
  const headerInis  = headerTitle
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.screen, { paddingTop: insets.top }]}>

        {/* ── Header ──────────────────────────────────────────────────────────*/}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={C.primary} />
          </Pressable>

          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{headerInis}</Text>
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.headerName} numberOfLines={1}>{headerTitle}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isConnected ? styles.statusOnline : styles.statusOffline]} />
              <Text style={styles.statusText}>
                {isConnecting ? "Connecting…" : isConnected ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.menuBtn}
            onPress={() =>
              Alert.alert(headerTitle, undefined, [
                { text: "View Profile",       onPress: () => {} },
                { text: "Report",             style: "destructive", onPress: () => {} },
                { text: "Cancel",             style: "cancel" },
              ])
            }
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
          </Pressable>
        </View>

        {/* ── Game context card ────────────────────────────────────────────── */}
        {gameSport && (
          <Pressable
            style={styles.gameCard}
            onPress={gameId ? () => router.push({ pathname: "/connect/game/[gameId]", params: { gameId } }) : undefined}
          >
            <Text style={styles.gameEmoji}>{sportEmoji}</Text>
            <View style={styles.gameInfo}>
              <Text style={styles.gameTitle} numberOfLines={1}>
                {gameSport.charAt(0) + gameSport.slice(1).toLowerCase()}
                {gameFacility ? `  ·  ${gameFacility}` : ""}
              </Text>
              {(gameDate || gameStartTime) ? (
                <Text style={styles.gameTime}>
                  {fmtDisplayDate(gameDate)}
                  {gameStartTime && gameEndTime ? `  ·  ${gameStartTime} – ${gameEndTime}` : ""}
                </Text>
              ) : null}
            </View>
            {gameId ? <Text style={styles.gameLink}>View →</Text> : null}
          </Pressable>
        )}

        {/* ── Messages + input ─────────────────────────────────────────────── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {isLoading && messages.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>Loading messages…</Text>
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
              ListHeaderComponent={
                hasMore ? (
                  <Pressable style={styles.loadMoreBtn} onPress={loadMore} disabled={isLoading}>
                    <Text style={styles.loadMoreText}>
                      {isLoading ? "Loading…" : "Load earlier messages"}
                    </Text>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>No messages yet. Say hello! 👋</Text>
                </View>
              }
            />
          )}

          {/* Typing indicator */}
          {isOtherTyping && <TypingIndicator />}

          {/* ── Input bar ─────────────────────────────────────────────────── */}
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            {!hasText && (
              <Pressable
                style={styles.attachBtn}
                onPress={() =>
                  Alert.alert("Attachments", "Coming soon: Camera, Gallery, Location")
                }
                hitSlop={8}
              >
                <Ionicons name="attach" size={22} color={C.muted} />
              </Pressable>
            )}

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder={`Message ${headerTitle}…`}
              placeholderTextColor={C.muted}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />

            {!hasText && (
              <Pressable
                style={styles.emojiBtn}
                onPress={() => {}} // emoji picker not wired
                hitSlop={8}
              >
                <Text style={{ fontSize: 20 }}>😊</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.sendBtn, hasText && styles.sendBtnActive]}
              onPress={handleSend}
              disabled={!hasText || isSending}
            >
              {isSending ? (
                <Text style={[styles.sendBtnIcon, hasText && styles.sendBtnIconActive]}>…</Text>
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={hasText ? "#FFFFFF" : C.muted}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  headerMeta:  { flex: 1 },
  headerName:  { color: C.text, fontSize: 16, fontWeight: "700" },
  statusRow:   { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusOnline:  { backgroundColor: "#22C55E" },
  statusOffline: { backgroundColor: C.muted },
  statusText:  { color: C.muted, fontSize: 11 },
  menuBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },

  // Game context card
  gameCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface,
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  gameEmoji: { fontSize: 20 },
  gameInfo:  { flex: 1 },
  gameTitle: { color: C.text, fontSize: 13, fontWeight: "700" },
  gameTime:  { color: C.muted, fontSize: 11, marginTop: 2 },
  gameLink:  { color: C.primary, fontSize: 13, fontWeight: "600" },

  // Messages
  messageList: { paddingVertical: 12, flexGrow: 1 },
  loadMoreBtn: { alignItems: "center", paddingVertical: 12 },
  loadMoreText: { color: C.muted, fontSize: 13 },
  loadingText: { color: C.muted, fontSize: 14 },
  errorText:   { color: "#EF4444", fontSize: 14, textAlign: "center" },
  emptyText:   { color: C.muted, fontSize: 15, textAlign: "center" },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  attachBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end",
  },
  emojiBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end",
  },
  input: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    color: C.text, fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#D8D8D8",
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end",
  },
  sendBtnActive: { backgroundColor: C.primary },
  sendBtnIcon:       { color: C.muted, fontSize: 18, fontWeight: "800" },
  sendBtnIconActive: { color: "#fff" },
});
