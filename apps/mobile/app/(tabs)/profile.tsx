import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { useMyProfile } from "../../src/hooks/useMyProfile";
import { useMyBookings } from "../../src/hooks/useMyBookings";
import { useAuthToken } from "../../src/hooks/useAuthToken";
import { useThreads } from "../../src/hooks/useChat";
import { useNotificationsContext } from "../../src/context/NotificationsContext";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  screenBg: "#F8F8F8",
  card:     "#FFFFFF",
  primary:  "#E85068",
  softPink: "#FFF5F7",
  text:     "#0A0A0A",
  muted:    "#9E9E9E",
  border:   "#F0F0F0",
  green:    "#22C55E",
};

// ─── Tier configuration ───────────────────────────────────────────────────────

interface TierStyle { bg: string; text: string; border: string }

const TIER_STYLE: Record<string, TierStyle> = {
  Beginner:     { bg: "#F5F5F5", text: "#9E9E9E", border: "#E0E0E0" },
  BEGINNER:     { bg: "#F5F5F5", text: "#9E9E9E", border: "#E0E0E0" },
  Rookie:       { bg: "#F0FFF4", text: "#22C55E", border: "#BBF7D0" },
  ROOKIE:       { bg: "#F0FFF4", text: "#22C55E", border: "#BBF7D0" },
  Intermediate: { bg: "#EFF6FF", text: "#2196F3", border: "#BFDBFE" },
  INTERMEDIATE: { bg: "#EFF6FF", text: "#2196F3", border: "#BFDBFE" },
  Amateur:      { bg: "#EFF6FF", text: "#2196F3", border: "#BFDBFE" },
  AMATEUR:      { bg: "#EFF6FF", text: "#2196F3", border: "#BFDBFE" },
  Advanced:     { bg: "#FAF5FF", text: "#9C27B0", border: "#E9D5FF" },
  ADVANCED:     { bg: "#FAF5FF", text: "#9C27B0", border: "#E9D5FF" },
  Pro:          { bg: "#FFF7ED", text: "#FF9800", border: "#FED7AA" },
  PRO:          { bg: "#FFF7ED", text: "#FF9800", border: "#FED7AA" },
  Elite:        { bg: "#FFFBEB", text: "#FFD700", border: "#FEF08A" },
  ELITE:        { bg: "#FFFBEB", text: "#FFD700", border: "#FEF08A" },
};
const DEFAULT_TIER: TierStyle = { bg: "#F5F5F5", text: "#9E9E9E", border: "#E0E0E0" };

const TIER_RANGES: Record<string, [number, number]> = {
  BEGINNER: [0, 99], ROOKIE: [100, 299], AMATEUR: [300, 699], PRO: [700, 1499], ELITE: [1500, 9999],
};
const NEXT_TIER: Record<string, string> = {
  BEGINNER: "Rookie", ROOKIE: "Amateur", AMATEUR: "Pro", PRO: "Elite",
};

// ─── Sport constants ──────────────────────────────────────────────────────────

const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽", basketball: "🏀", tennis: "🎾", badminton: "🏸",
  volleyball: "🏐", hockey: "🏒", squash: "🏸", pickleball: "🏓",
  baseball: "⚾", cricket: "🏏",
};

const SPORT_COLOR: Record<string, string> = {
  badminton: "#4CAF50", pickleball: "#FF9800", tennis: "#FFC107",
  basketball: "#FF5722", soccer: "#2196F3", volleyball: "#FF9800",
  hockey: "#2196F3", squash: "#9C27B0", cricket: "#4CAF50", baseball: "#FF9800",
};

// ─── Achievements ─────────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: "first_game",  icon: "🏆", title: "FIRST GAME",   progress: undefined            },
  { id: "streak_5",   icon: "🔥", title: "5 DAY STREAK", progress: undefined            },
  { id: "connect_pro",icon: "👥", title: "CONNECT PRO",  progress: "3/10"              },
  { id: "century",    icon: "💯", title: "CENTURY",       progress: "12/100"            },
  { id: "reviewer",   icon: "⭐", title: "REVIEWER",      progress: "1/5"              },
  { id: "elite",      icon: "👑", title: "ELITE PLAYER",  progress: "Rookie → Elite"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hr = h! % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionHeaderRow}>
      <Text style={s.sectionHeader}>{label}</Text>
      {right}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user: authUser, clearSession } = useAuth();
  const { profile, isLoading, error, refetch } = useMyProfile();
  const { bookings } = useMyBookings();
  const { getValidToken } = useAuthToken();

  const { threads }     = useThreads();
  const { unreadCount } = useNotificationsContext();
  const unreadMessages  = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);

  const [email,             setEmail]             = useState("");
  const [emailSaving,       setEmailSaving]       = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState(true);
  const [emailReminders,    setEmailReminders]    = useState(true);
  const [emailMarketing,    setEmailMarketing]    = useState(false);
  const [prefsSaving,       setPrefsSaving]       = useState(false);
  const [avatarSaving,      setAvatarSaving]      = useState(false);

  const [creditModalVisible, setCreditModalVisible] = useState(false);
  const [emailModalVisible,  setEmailModalVisible]  = useState(false);
  const [notifModalVisible,  setNotifModalVisible]  = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSaveEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    setEmailSaving(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/me/email`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        Alert.alert("Error", j.message ?? "Failed to save email");
      } else {
        Alert.alert("Saved", "Your email has been updated.");
        setEmail("");
        setEmailModalVisible(false);
      }
    } catch { Alert.alert("Error", "Network error. Please try again."); }
    finally { setEmailSaving(false); }
  }

  async function handleSaveEmailPrefs(patch: {
    emailBookingConfirmation?: boolean;
    emailReminders?: boolean;
    emailMarketing?: boolean;
  }) {
    setPrefsSaving(true);
    try {
      const token = await getValidToken();
      await fetch(`${API_URL}/users/me/email-preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
    } catch { /* non-blocking */ } finally { setPrefsSaving(false); }
  }

  async function updateAvatar(avatarUrl: string | null) {
    setAvatarSaving(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarUrl }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { message?: string };
        Alert.alert("Photo not saved", j.message ?? "Failed to update profile photo.");
        return;
      }
      await refetch();
    } catch { Alert.alert("Photo not saved", "Network error. Please try again."); }
    finally { setAvatarSaving(false); }
  }

  async function handlePickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow Dome to access your photos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true, aspect: [1, 1], quality: 0.55, base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("Photo not saved", "Could not read the selected image."); return; }
    const mimeType = asset.mimeType ?? (asset.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    await updateAvatar(`data:${mimeType};base64,${asset.base64}`);
  }

  function handleAvatarPress() {
    const hasAvatar = Boolean(profile?.user.avatarUrl);
    Alert.alert("Profile Photo", undefined, [
      { text: hasAvatar ? "Change Photo" : "Upload Photo", onPress: handlePickAvatar },
      ...(hasAvatar ? [{ text: "Remove Photo", style: "destructive" as const, onPress: () => updateAvatar(null) }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const initials = authUser?.firstName
    ? `${authUser.firstName[0] ?? ""}${authUser.lastName?.[0] ?? ""}`.toUpperCase()
    : (authUser?.phone?.slice(-2) ?? "?");

  const displayName = authUser?.firstName
    ? `${authUser.firstName} ${authUser.lastName ?? ""}`.trim()
    : authUser?.phone ?? "Player";

  if (isLoading && !profile) {
    return (
      <View style={[s.screen, s.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  const stats = profile?.stats;
  const tier  = stats?.tier;
  const tierName    = tier?.name ?? "Beginner";
  const tierNameUp  = tierName.toUpperCase();
  const tierStyle   = TIER_STYLE[tierName] ?? TIER_STYLE[tierNameUp] ?? DEFAULT_TIER;
  const totalPoints = stats?.totalPoints ?? 0;
  const [tierMin, tierMax] = TIER_RANGES[tierNameUp] ?? [0, 100];
  const tierProgress = Math.min(1, Math.max(0, (totalPoints - tierMin) / Math.max(1, tierMax - tierMin)));
  const nextTier  = NEXT_TIER[tierNameUp];
  const ptsToNext = tierMax - totalPoints;

  const sportEntries = stats?.sportBreakdown
    ? Object.entries(stats.sportBreakdown).sort((a, b) => b[1] - a[1])
    : [];
  const totalSportGames = sportEntries.reduce((s, [, n]) => s + n, 0) || 1;

  const unlockedIds = new Set<string>();
  if (stats) {
    if (stats.totalGames >= 1)    unlockedIds.add("first_game");
    if (stats.currentStreak >= 5) unlockedIds.add("streak_5");
    if (stats.totalGames >= 100)  unlockedIds.add("century");
    if (tierNameUp === "ELITE")   unlockedIds.add("elite");
  }

  const recentBookings = [...bookings]
    .filter((b) => b.status !== "CANCELLED")
    .sort((a, b) => b.slot.date.localeCompare(a.slot.date))
    .slice(0, 3);

  const ACCOUNT_ITEMS = [
    { icon: "👤", label: "Edit Profile",              onPress: () => Alert.alert("Coming soon", "Edit profile coming soon.") },
    { icon: "📧", label: "Add Email",                 onPress: () => setEmailModalVisible(true) },
    { icon: "🔔", label: "Notifications",             onPress: () => setNotifModalVisible(true) },
    { icon: "🎟️", label: "My Coupons",               onPress: () => Alert.alert("Coming soon", "Coupons coming soon.") },
    { icon: "💳", label: "Credit History",             onPress: () => setCreditModalVisible(true) },
    { icon: "❓", label: "Help & Support",             onPress: () => Alert.alert("Help", "Email us at support@domeapp.ca") },
    { icon: "📄", label: "Privacy Policy",             onPress: () => Alert.alert("Privacy Policy", "domeapp.ca/privacy") },
  ];

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />
        }
      >

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <Text style={s.screenTitle}>MY PROFILE</Text>
          <View style={s.topBarActions}>
            <Pressable style={s.iconBtn} onPress={() => router.push("/(tabs)/chats")} hitSlop={8}>
              <Ionicons name="chatbubbles-outline" size={22} color={C.text} />
              {unreadMessages > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
              )}
            </Pressable>
            <Pressable style={s.iconBtn} onPress={() => router.push("/notifications")} hitSlop={8}>
              <Ionicons name="notifications-outline" size={22} color={C.text} />
              {unreadCount > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Hero section (white card) ────────────────────────────────────── */}
        <View style={s.heroCard}>
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <Pressable style={s.avatar} onPress={handleAvatarPress} disabled={avatarSaving}>
              {profile?.user.avatarUrl ? (
                <Image source={{ uri: profile.user.avatarUrl }} style={s.avatarImage} />
              ) : (
                <Text style={s.avatarText}>{initials}</Text>
              )}
            </Pressable>
            <Pressable style={s.avatarEditBtn} onPress={handleAvatarPress} disabled={avatarSaving} hitSlop={4}>
              {avatarSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.avatarEditIcon}>✏️</Text>
              }
            </Pressable>
          </View>

          <Text style={s.displayName}>{displayName}</Text>
          {authUser?.phone ? <Text style={s.phone}>{authUser.phone}</Text> : null}
          {profile?.user.province ? (
            <Text style={s.location}>📍 {profile.user.province}, Canada</Text>
          ) : null}

          {/* Tier card */}
          {tier && (
            <Pressable
              style={[s.tierCard, { backgroundColor: tierStyle.bg, borderColor: tierStyle.border }]}
              onPress={() => router.navigate("/(tabs)/profile" as Parameters<typeof router.navigate>[0])}
            >
              <View style={s.tierTop}>
                <Text style={[s.tierName, { color: tierStyle.text }]}>🏆 {tierName.toUpperCase()}</Text>
                <Text style={[s.tierArrow, { color: tierStyle.text }]}>→</Text>
              </View>
              <Text style={s.tierSub}>
                {totalPoints} pts
                {nextTier && ptsToNext > 0 ? `  ·  ${ptsToNext} to ${nextTier}` : ""}
              </Text>
              <View style={s.tierTrack}>
                <View style={[s.tierFill, {
                  width: `${Math.round(tierProgress * 100)}%` as unknown as number,
                  backgroundColor: tierStyle.text,
                }]} />
              </View>
              <Text style={[s.tierPct, { color: tierStyle.text }]}>{Math.round(tierProgress * 100)}%</Text>
            </Pressable>
          )}
        </View>

        {/* ── Inner content (grey bg, 16px padding) ───────────────────────── */}
        <View style={s.inner}>

          {/* ── Stats grid ────────────────────────────────────────────────── */}
          <SectionHeader label="YOUR STATS" />
          {error ? (
            <Text style={s.errorText}>{error}</Text>
          ) : (
            <View style={s.statsGrid}>
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <Text style={s.statIcon}>🎮</Text>
                  <Text style={s.statValue}>{stats?.totalGames ?? 0}</Text>
                  <Text style={s.statLabel}>GAMES PLAYED</Text>
                </View>
                <View style={s.statCard}>
                  <Text style={s.statIcon}>⏱</Text>
                  <Text style={s.statValue}>{stats?.totalHours ?? 0}h</Text>
                  <Text style={s.statLabel}>COURT TIME</Text>
                </View>
              </View>
              <View style={s.statsRow}>
                <View style={s.statCard}>
                  <Text style={s.statIcon}>⭐</Text>
                  <Text style={s.statValue}>{totalPoints}</Text>
                  <Text style={s.statLabel}>DOME POINTS</Text>
                </View>
                <Pressable style={s.statCard} onPress={() => setCreditModalVisible(true)}>
                  <Text style={s.statIcon}>💳</Text>
                  <Text style={s.statValue}>
                    C${Number(profile?.user.creditBalanceCAD ?? 0).toFixed(2)}
                  </Text>
                  <Text style={s.statLabel}>CREDITS</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── My Sports ─────────────────────────────────────────────────── */}
          {sportEntries.length > 0 && (
            <>
              <SectionHeader label="MY SPORTS" />
              <View style={s.card}>
                {sportEntries.map(([sport, count], i) => {
                  const pct   = count / totalSportGames;
                  const color = SPORT_COLOR[sport.toLowerCase()] ?? C.primary;
                  const emoji = SPORT_EMOJI[sport.toLowerCase()] ?? "🏟";
                  return (
                    <View key={sport} style={[s.sportRow, i < sportEntries.length - 1 && s.sportRowBorder]}>
                      <View style={s.sportRowTop}>
                        <Text style={s.sportEmoji}>{emoji}</Text>
                        <Text style={s.sportName}>
                          {sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase().toUpperCase()}
                        </Text>
                        <Text style={s.sportCount}>{count} game{count !== 1 ? "s" : ""}</Text>
                      </View>
                      <View style={s.sportBarTrack}>
                        <View style={[s.sportBarFill, {
                          width: `${Math.round(pct * 100)}%` as unknown as number,
                          backgroundColor: color,
                        }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Achievements ──────────────────────────────────────────────── */}
          <SectionHeader
            label="ACHIEVEMENTS"
            right={
              <Text style={s.sectionRight}>
                {unlockedIds.size} / {ACHIEVEMENTS.length} unlocked
              </Text>
            }
          />
          <View style={s.achievementsGrid}>
            {ACHIEVEMENTS.map((a) => {
              const unlocked = unlockedIds.has(a.id);
              return (
                <View
                  key={a.id}
                  style={[s.achieveCard, unlocked ? s.achieveUnlocked : s.achieveLocked]}
                >
                  <Text style={s.achieveIcon}>{a.icon}</Text>
                  <Text style={[s.achieveTitle, !unlocked && s.achieveTitleLocked]}>{a.title}</Text>
                  <Text style={s.achieveSub}>
                    {unlocked ? "Unlocked ✓" : (a.progress ?? "Locked")}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ── Recent Activity ───────────────────────────────────────────── */}
          {recentBookings.length > 0 && (
            <>
              <SectionHeader
                label="RECENT ACTIVITY"
                right={
                  <Pressable onPress={() => router.navigate("/(tabs)/bookings" as Parameters<typeof router.navigate>[0])}>
                    <Text style={s.sectionLink}>View all →</Text>
                  </Pressable>
                }
              />
              <View style={s.card}>
                {recentBookings.map((b, i) => {
                  const sport = b.facility.sport.toLowerCase();
                  const emoji = SPORT_EMOJI[sport] ?? "🏟";
                  const color = SPORT_COLOR[sport] ?? C.primary;
                  const dateStr = b.slot.date.split("T")[0]!;
                  const completed = b.status === "CONFIRMED";
                  return (
                    <View key={b.id} style={[s.activityRow, i < recentBookings.length - 1 && s.activityRowBorder]}>
                      <View style={[s.activityCircle, { backgroundColor: `${color}20` }]}>
                        <Text style={s.activityEmoji}>{emoji}</Text>
                      </View>
                      <View style={s.activityMeta}>
                        <Text style={s.activityFacility} numberOfLines={1}>{b.facility.name}</Text>
                        <Text style={s.activityTime}>
                          {fmtDateShort(dateStr)} · {fmtTime(b.slot.startTime)}
                        </Text>
                        <Text style={[s.activityStatus, { color: completed ? C.green : "#EF4444" }]}>
                          {completed ? "✅ Completed" : "❌ Cancelled"}
                          {completed ? `  ·  C$${b.totalCAD.toFixed(2)}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Account settings ──────────────────────────────────────────── */}
          <SectionHeader label="ACCOUNT" />
          <View style={s.settingsCard}>
            {ACCOUNT_ITEMS.map((item, i) => (
              <Pressable
                key={item.label}
                style={[s.settingsRow, i < ACCOUNT_ITEMS.length - 1 && s.settingsRowBorder]}
                onPress={item.onPress}
              >
                <Text style={s.settingsIcon}>{item.icon}</Text>
                <Text style={s.settingsLabel}>{item.label}</Text>
                <Text style={s.settingsChevron}>›</Text>
              </Pressable>
            ))}
          </View>

          {/* ── Sign out ──────────────────────────────────────────────────── */}
          <Pressable style={s.signOutBtn} onPress={clearSession}>
            <Text style={s.signOutText}>SIGN OUT</Text>
          </Pressable>

          <Text style={s.appVersion}>Dome v1.2.0 · Made with ❤️ in Canada</Text>
        </View>

      </ScrollView>

      {/* ── Credit History Modal ────────────────────────────────────────────── */}
      <Modal visible={creditModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreditModalVisible(false)}>
        <View style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>Credit History</Text>
            <Pressable onPress={() => setCreditModalVisible(false)} hitSlop={12}>
              <Text style={m.done}>Done</Text>
            </Pressable>
          </View>
          <View style={m.body}>
            <Text style={m.balance}>C${Number(profile?.user.creditBalanceCAD ?? 0).toFixed(2)}</Text>
            <Text style={m.balanceLabel}>Current Balance</Text>
            <Text style={m.hint}>Credits are issued for cancellations and promotions.</Text>
          </View>
        </View>
      </Modal>

      {/* ── Add Email Modal ──────────────────────────────────────────────────── */}
      <Modal visible={emailModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEmailModalVisible(false)}>
        <View style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>Add Email</Text>
            <Pressable onPress={() => setEmailModalVisible(false)} hitSlop={12}>
              <Text style={m.done}>Done</Text>
            </Pressable>
          </View>
          <View style={m.body}>
            <Text style={m.hint}>Add your email to receive booking receipts and reminders.</Text>
            <TextInput
              style={m.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[m.saveBtn, emailSaving && m.saveBtnDisabled]}
              onPress={handleSaveEmail}
              disabled={emailSaving}
            >
              <Text style={m.saveBtnText}>{emailSaving ? "Saving…" : "SAVE EMAIL"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Notification Prefs Modal ─────────────────────────────────────────── */}
      <Modal visible={notifModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setNotifModalVisible(false)}>
        <View style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>Notification Preferences</Text>
            <Pressable onPress={() => setNotifModalVisible(false)} hitSlop={12}>
              <Text style={m.done}>Done</Text>
            </Pressable>
          </View>
          <View style={[m.body, { paddingTop: 0 }]}>
            {([
              { label: "📧 Booking confirmations", value: emailConfirmation, setter: setEmailConfirmation, key: "emailBookingConfirmation" as const },
              { label: "🔔 Game reminders",         value: emailReminders,   setter: setEmailReminders,   key: "emailReminders" as const },
              { label: "📣 Promotions & news",      value: emailMarketing,   setter: setEmailMarketing,   key: "emailMarketing" as const },
            ] as const).map((pref, i, arr) => (
              <View key={pref.label} style={[m.prefRow, i < arr.length - 1 && m.prefRowBorder]}>
                <Text style={m.prefLabel}>{pref.label}</Text>
                <Switch
                  value={pref.value}
                  onValueChange={(v) => { pref.setter(v); handleSaveEmailPrefs({ [pref.key]: v }); }}
                  trackColor={{ false: C.border, true: C.primary }}
                  thumbColor="#fff"
                  disabled={prefsSaving}
                />
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
} as const;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.screenBg },
  center: { alignItems: "center", justifyContent: "center" },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingBottom: 8,
    backgroundColor: C.screenBg,
  },
  screenTitle:   { color: C.text, fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  topBarActions: { flexDirection: "row", gap: 2 },
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
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.screenBg,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // Hero card
  heroCard: {
    backgroundColor: C.card, padding: 24,
    alignItems: "center", gap: 6,
    ...CARD_SHADOW,
  },
  avatarWrap: { position: "relative", marginBottom: 4 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatarImage:   { width: 80, height: 80, borderRadius: 40 },
  avatarText:    { color: "#fff", fontSize: 28, fontWeight: "900" },
  avatarEditBtn: {
    position: "absolute", bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.primary, borderWidth: 2, borderColor: C.card,
    alignItems: "center", justifyContent: "center",
  },
  avatarEditIcon: { fontSize: 11 },
  displayName:   { color: C.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  phone:         { color: C.muted, fontSize: 13 },
  location:      { color: C.muted, fontSize: 13 },

  // Tier card
  tierCard: {
    width: "100%", borderRadius: 14, borderWidth: 1,
    padding: 14, gap: 6, marginTop: 12,
  },
  tierTop:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tierName: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  tierArrow:{ fontSize: 16, fontWeight: "700" },
  tierSub:  { color: C.muted, fontSize: 12 },
  tierTrack: {
    height: 6, borderRadius: 3,
    backgroundColor: "#E8E8E8", overflow: "hidden",
  },
  tierFill:  { height: 6, borderRadius: 3 },
  tierPct:   { fontSize: 11, fontWeight: "700", alignSelf: "flex-end" },

  // Inner content
  inner: { padding: 16 },

  // Section header
  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28, marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12, fontWeight: "700", letterSpacing: 2,
    color: C.muted, textTransform: "uppercase",
  },
  sectionRight: { color: C.muted, fontSize: 12 },
  sectionLink:  { color: C.primary, fontSize: 13, fontWeight: "700" },

  // Stats grid
  statsGrid: { gap: 10 },
  statsRow:  { flexDirection: "row", gap: 10 },
  statCard: {
    ...CARD_SHADOW,
    flex: 1, backgroundColor: C.card,
    borderRadius: 16, padding: 16, gap: 4,
  },
  statIcon:  { fontSize: 24, marginBottom: 2 },
  statValue: { color: C.text, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  statLabel: {
    color: C.muted, fontSize: 10, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.8,
  },

  // Card (generic white shadow card)
  card: {
    ...CARD_SHADOW,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
  },

  // Sports
  sportRow:        { paddingVertical: 12, gap: 8 },
  sportRowBorder:  { borderBottomWidth: 1, borderBottomColor: C.border },
  sportRowTop:     { flexDirection: "row", alignItems: "center", gap: 10 },
  sportEmoji:      { fontSize: 20 },
  sportName:       { flex: 1, color: C.text, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  sportCount:      { color: C.muted, fontSize: 12, fontWeight: "600" },
  sportBarTrack:   { height: 6, borderRadius: 3, backgroundColor: "#F0F0F0", overflow: "hidden" },
  sportBarFill:    { height: 6, borderRadius: 3 },

  // Achievements
  achievementsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  achieveCard: {
    width: "30.5%", borderRadius: 14, padding: 12,
    alignItems: "center", gap: 5, overflow: "hidden",
  },
  achieveUnlocked: {
    backgroundColor: C.softPink,
    borderWidth: 1.5, borderColor: C.primary,
  },
  achieveLocked: {
    backgroundColor: "#F8F8F8",
    borderWidth: 1, borderColor: "#E8E8E8",
    opacity: 0.6,
  },
  achieveIcon:        { fontSize: 28 },
  achieveTitle:       { color: C.text, fontSize: 9, fontWeight: "800", textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase" },
  achieveTitleLocked: { color: C.muted },
  achieveSub:         { color: C.muted, fontSize: 9, textAlign: "center" },

  // Activity
  activityRow:        { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  activityRowBorder:  { borderBottomWidth: 1, borderBottomColor: C.border },
  activityCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  activityEmoji:    { fontSize: 22 },
  activityMeta:     { flex: 1 },
  activityFacility: { color: C.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  activityTime:     { color: C.muted, fontSize: 12, marginBottom: 2 },
  activityStatus:   { fontSize: 12, fontWeight: "600" },

  // Settings
  settingsCard: {
    ...CARD_SHADOW,
    backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16,
  },
  settingsRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, gap: 12,
  },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  settingsIcon:      { fontSize: 20, width: 28, textAlign: "center" },
  settingsLabel:     { flex: 1, color: C.text, fontSize: 15 },
  settingsChevron:   { color: C.muted, fontSize: 22 },

  // Sign out
  signOutBtn: {
    marginTop: 24,
    borderWidth: 1.5, borderColor: C.primary,
    borderRadius: 14, padding: 16, alignItems: "center",
    backgroundColor: "transparent",
  },
  signOutText: { color: C.primary, fontWeight: "700", fontSize: 15, letterSpacing: 0.5 },
  appVersion:  { color: C.muted, fontSize: 12, textAlign: "center", marginTop: 12 },

  errorText: { color: "#EF4444", fontSize: 14 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.card },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title:   { color: C.text, fontSize: 17, fontWeight: "700" },
  done:    { color: C.primary, fontSize: 16, fontWeight: "600" },
  body:    { padding: 20, gap: 16 },
  balance: { color: C.text, fontSize: 36, fontWeight: "900", textAlign: "center", marginTop: 20 },
  balanceLabel: { color: C.muted, fontSize: 13, textAlign: "center" },
  hint:    { color: C.muted, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: C.screenBg, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    color: C.text, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  saveBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  prefRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingVertical: 16,
  },
  prefRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  prefLabel: { color: C.text, fontSize: 15 },
});
