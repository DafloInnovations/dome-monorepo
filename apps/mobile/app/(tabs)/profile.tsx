import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../../src/context/AuthContext";
import { useMyProfile } from "../../src/hooks/useMyProfile";
import { useAuthToken } from "../../src/hooks/useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

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
  soccer: "⚽", basketball: "🏀", tennis: "🎾", badminton: "🏸",
  volleyball: "🏐", hockey: "🏒", squash: "🏸", pickleball: "🏓",
  baseball: "⚾", cricket: "🏏",
};

const TIER_COLOR: Record<string, string> = {
  Beginner: "#6B6B6B",
  Rookie:   "#22C55E",
  Amateur:  "#3B82F6",
  Pro:      "#A855F7",
  Elite:    "#F59E0B",
};

const ACHIEVEMENTS = [
  { id: "first_game",    emoji: "🎉", label: "First Game",    threshold: 1  },
  { id: "five_games",    emoji: "🏅", label: "5 Games",       threshold: 5  },
  { id: "ten_games",     emoji: "🔟", label: "10 Games",      threshold: 10 },
  { id: "ten_hours",     emoji: "⏰", label: "10 Hours",      threshold: 10, stat: "hours" },
  { id: "streak_3",      emoji: "🔥", label: "3-Day Streak",  threshold: 3,  stat: "streak" },
  { id: "multi_sport",   emoji: "🌈", label: "Multi-Sport",   threshold: 2,  stat: "sports" },
];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user: authUser, clearSession } = useAuth();
  const { profile, isLoading, error, refetch } = useMyProfile();
  const { getValidToken } = useAuthToken();

  const [email, setEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailConfirmation, setEmailConfirmation] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);
  const [emailMarketing, setEmailMarketing] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

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
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setEmailSaving(false);
    }
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
    } catch { /* non-blocking */ } finally {
      setPrefsSaving(false);
    }
  }

  const initials = authUser?.firstName
    ? `${authUser.firstName[0] ?? ""}${authUser.lastName?.[0] ?? ""}`.toUpperCase()
    : (authUser?.phone?.slice(-2) ?? "?");

  const displayName = authUser?.firstName
    ? `${authUser.firstName} ${authUser.lastName ?? ""}`.trim()
    : authUser?.phone ?? "Player";

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  const stats = profile?.stats;
  const tier = stats?.tier;
  const tierColor = tier ? (TIER_COLOR[tier.name] ?? C.muted) : C.muted;
  const tierProgress = tier && tier.max !== Infinity
    ? Math.min(1, ((stats?.totalPoints ?? 0) - tier.min) / (tier.max - tier.min + 1))
    : 1;

  const sportEntries = stats?.sportBreakdown
    ? Object.entries(stats.sportBreakdown).sort((a, b) => b[1] - a[1])
    : [];

  const unlockedAchievements = new Set(
    ACHIEVEMENTS.filter((a) => {
      if (!stats) return false;
      if (a.stat === "hours")  return stats.totalHours >= a.threshold;
      if (a.stat === "streak") return stats.currentStreak >= a.threshold;
      if (a.stat === "sports") return Object.keys(stats.sportBreakdown).length >= a.threshold;
      return stats.totalGames >= a.threshold;
    }).map((a) => a.id)
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={C.primary} />
      }
    >
      {/* Avatar + name */}
      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {authUser?.phone ? (
          <Text style={styles.phone}>{authUser.phone}</Text>
        ) : null}

        {/* Tier badge */}
        {tier ? (
          <View style={[styles.tierBadge, { borderColor: tierColor }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{tier.name}</Text>
          </View>
        ) : null}
      </View>

      {/* XP bar */}
      {tier && tier.max !== Infinity && stats ? (
        <View style={styles.xpSection}>
          <View style={styles.xpLabels}>
            <Text style={styles.xpLabel}>{stats.totalPoints} pts</Text>
            <Text style={styles.xpLabel}>
              Next: {tier.name === "Beginner" ? "Rookie" :
                     tier.name === "Rookie"   ? "Amateur" :
                     tier.name === "Amateur"  ? "Pro" : "Elite"}{" "}
              ({tier.max + 1} pts)
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${Math.round(tierProgress * 100)}%`, backgroundColor: tierColor }]} />
          </View>
        </View>
      ) : tier?.name === "Elite" ? (
        <View style={styles.xpSection}>
          <Text style={[styles.xpLabel, { color: tierColor, textAlign: "center" }]}>
            ⚡ Elite — {stats?.totalPoints ?? 0} pts
          </Text>
        </View>
      ) : null}

      {/* Stats grid */}
      <Text style={styles.sectionTitle}>Stats</Text>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            label="Games Played"
            value={String(stats?.totalGames ?? 0)}
          />
          <StatCard
            label="Hours on Court"
            value={String(stats?.totalHours ?? 0)}
            sub="hrs"
          />
          <StatCard
            label="Dome Points"
            value={String(stats?.totalPoints ?? 0)}
            sub="pts"
          />
          <StatCard
            label="Current Streak"
            value={String(stats?.currentStreak ?? 0)}
            sub="days"
          />
          <StatCard
            label="💳 Credits"
            value={`C$${Number(profile?.user.creditBalanceCAD ?? 0).toFixed(2)}`}
          />
        </View>
      )}

      {/* Sport breakdown */}
      {sportEntries.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Sports</Text>
          <View style={styles.card}>
            {sportEntries.map(([sport, count], i) => (
              <View
                key={sport}
                style={[
                  styles.sportRow,
                  i < sportEntries.length - 1 && styles.sportRowBorder,
                ]}
              >
                <Text style={styles.sportEmoji}>
                  {SPORT_EMOJI[sport] ?? "🏟"}
                </Text>
                <Text style={styles.sportName}>
                  {sport.charAt(0).toUpperCase() + sport.slice(1)}
                </Text>
                <Text style={styles.sportCount}>
                  {count} game{count !== 1 ? "s" : ""}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Achievements */}
      <Text style={styles.sectionTitle}>Achievements</Text>
      <View style={styles.achievementsGrid}>
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedAchievements.has(a.id);
          return (
            <View
              key={a.id}
              style={[styles.achievement, !unlocked && styles.achievementLocked]}
            >
              <Text style={[styles.achievementEmoji, !unlocked && styles.achievementEmojiLocked]}>
                {a.emoji}
              </Text>
              <Text style={[styles.achievementLabel, !unlocked && styles.achievementLabelLocked]}>
                {a.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Email settings */}
      <Text style={styles.sectionTitle}>Email Notifications</Text>
      <View style={styles.card}>
        <Text style={styles.emailPrompt}>
          Add your email to receive booking receipts and reminders.
        </Text>
        <View style={styles.emailRow}>
          <TextInput
            style={styles.emailInput}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={C.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[styles.emailSaveBtn, emailSaving && styles.emailSaveBtnDisabled]}
            onPress={handleSaveEmail}
            disabled={emailSaving}
          >
            <Text style={styles.emailSaveBtnText}>{emailSaving ? "…" : "Save"}</Text>
          </Pressable>
        </View>

        <View style={styles.prefDivider} />

        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>📧 Booking confirmations</Text>
          <Switch
            value={emailConfirmation}
            onValueChange={(v) => {
              setEmailConfirmation(v);
              handleSaveEmailPrefs({ emailBookingConfirmation: v });
            }}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
            disabled={prefsSaving}
          />
        </View>
        <View style={styles.prefRow}>
          <Text style={styles.prefLabel}>🔔 Game reminders</Text>
          <Switch
            value={emailReminders}
            onValueChange={(v) => {
              setEmailReminders(v);
              handleSaveEmailPrefs({ emailReminders: v });
            }}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
            disabled={prefsSaving}
          />
        </View>
        <View style={[styles.prefRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.prefLabel}>📣 Promotions & news</Text>
          <Switch
            value={emailMarketing}
            onValueChange={(v) => {
              setEmailMarketing(v);
              handleSaveEmailPrefs({ emailMarketing: v });
            }}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#fff"
            disabled={prefsSaving}
          />
        </View>
      </View>

      {/* Sign out */}
      <Pressable style={styles.signOutBtn} onPress={clearSession}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: Platform.OS === "ios" ? 60 : 20, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center" },
  hero: { alignItems: "center", paddingHorizontal: 24, marginBottom: 20 },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: { color: C.text, fontSize: 32, fontWeight: "800" },
  displayName: { color: C.text, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  phone: { color: C.muted, fontSize: 14, marginBottom: 12 },
  tierBadge: {
    borderWidth: 1.5,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  tierText: { fontSize: 13, fontWeight: "700" },
  xpSection: { paddingHorizontal: 16, marginBottom: 8 },
  xpLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  xpLabel: { color: C.muted, fontSize: 12 },
  xpTrack: {
    height: 6,
    backgroundColor: C.surface,
    borderRadius: 3,
    overflow: "hidden",
  },
  xpFill: { height: 6, borderRadius: 3 },
  sectionTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    width: "47%",
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  statValue: { color: C.text, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  statSub: { color: C.muted, fontSize: 11, fontWeight: "600" },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    overflow: "hidden",
  },
  sportRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  sportRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  sportEmoji: { fontSize: 22 },
  sportName: { color: C.text, fontSize: 15, fontWeight: "600", flex: 1 },
  sportCount: { color: C.muted, fontSize: 13 },
  achievementsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
  },
  achievement: {
    width: "30%",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  achievementLocked: { opacity: 0.35 },
  achievementEmoji: { fontSize: 28 },
  achievementEmojiLocked: { opacity: 0.5 },
  achievementLabel: { color: C.text, fontSize: 10, fontWeight: "600", textAlign: "center" },
  achievementLabelLocked: { color: C.muted },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: "#EF4444",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  signOutText: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
  errorText: { color: "#ff6b6b", fontSize: 14, paddingHorizontal: 16 },

  // Email settings
  emailPrompt: { color: C.muted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  emailRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  emailInput: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emailSaveBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emailSaveBtnDisabled: { opacity: 0.5 },
  emailSaveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  prefDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  prefLabel: { color: C.text, fontSize: 14 },
});
