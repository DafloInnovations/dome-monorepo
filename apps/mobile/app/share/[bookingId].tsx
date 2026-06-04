import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import ViewShot from "react-native-view-shot";
import ShareCard, { CARD_WIDTH, CARD_HEIGHT } from "../../src/components/ShareCard";
import { useShareCard } from "../../src/hooks/useShareCard";
import { useMyProfile } from "../../src/hooks/useMyProfile";

const C = {
  bg: "#000000",
  surface: "#1C1C1E",
  primary: "#E85068",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

// Sport gradient themes for the selector chips (same keys as ShareCard)
const SPORT_THEMES: Record<string, { label: string; bg: string; emoji: string }> = {
  badminton:   { label: "Badminton",   bg: "#1a4731", emoji: "🏸" },
  pickleball:  { label: "Pickleball",  bg: "#2d4a1e", emoji: "🥒" },
  tennis:      { label: "Tennis",      bg: "#8b3a0f", emoji: "🎾" },
  basketball:  { label: "Basketball",  bg: "#8b4513", emoji: "🏀" },
  soccer:      { label: "Soccer",      bg: "#1a5c2a", emoji: "⚽" },
  cricket:     { label: "Cricket",     bg: "#4a3728", emoji: "🏏" },
  bowling:     { label: "Bowling",     bg: "#1a1a4a", emoji: "🎳" },
  golf:        { label: "Golf",        bg: "#2d5a1e", emoji: "⛳" },
  volleyball:  { label: "Volleyball",  bg: "#5c3a1a", emoji: "🏐" },
  hockey:      { label: "Hockey",      bg: "#1a2d4a", emoji: "🏒" },
};

const PRESET_CAPTIONS = [
  "Just played an amazing game! 🔥",
  "Court life 🏸",
  "Getting better every week 💪",
  "Who's up for a game? 🎾",
];

function PointsBurst({ points, visible }: { points: number; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(1);
    translateY.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -60, duration: 1800, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.pointsBurst, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.pointsBurstText}>+{points} pts</Text>
    </Animated.View>
  );
}

export default function ShareCardScreen() {
  const {
    bookingId, facilityName, facilityCity, sport,
    date, startTime, endTime,
  } = useLocalSearchParams<{
    bookingId: string;
    facilityName: string;
    facilityCity: string;
    sport: string;
    date: string;
    startTime: string;
    endTime: string;
  }>();

  const router = useRouter();
  const viewShotRef = useRef<ViewShot>(null);
  const { pickPhoto, saveToPhotos, shareGeneral, shareToInstagram, shareToWhatsApp, logShare, saving, sharing } = useShareCard();
  const { profile } = useMyProfile();

  const [userPhotoUri, setUserPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState(PRESET_CAPTIONS[0]!);
  const [showPoints, setShowPoints] = useState(true);
  const [showTier, setShowTier] = useState(true);
  const [showFacility, setShowFacility] = useState(true);
  const [pointsBurstVisible, setPointsBurstVisible] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState(0);

  const sportKey = (sport ?? "").toLowerCase();
  const totalPoints = profile?.stats.totalPoints ?? 0;
  const tierName = profile?.stats.tier.name ?? "Beginner";

  const sportBgChips = [
    { key: "sport", label: "Sport Theme", bg: SPORT_THEMES[sportKey]?.bg ?? "#1a0505", emoji: SPORT_THEMES[sportKey]?.emoji ?? "🏟️", isPhoto: false },
    { key: "photo", label: "My Photo", bg: "#2C2C2E", emoji: "📷", isPhoto: true },
    ...Object.entries(SPORT_THEMES)
      .filter(([k]) => k !== sportKey)
      .map(([k, v]) => ({ key: k, label: v.label, bg: v.bg, emoji: v.emoji, isPhoto: false })),
  ];

  const [selectedBg, setSelectedBg] = useState("sport");

  async function handleBgSelect(key: string, isPhoto: boolean) {
    if (isPhoto) {
      const uri = await pickPhoto();
      if (uri) {
        setUserPhotoUri(uri);
        setSelectedBg("photo");
      }
    } else {
      setUserPhotoUri(null);
      setSelectedBg(key);
    }
  }

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await (viewShotRef.current as any)?.capture();
      return uri ?? null;
    } catch {
      return null;
    }
  }, []);

  async function handleShare(platform: "instagram" | "whatsapp" | "other") {
    const uri = await captureCard();
    if (!uri) return;

    if (platform === "instagram") await shareToInstagram(uri);
    else if (platform === "whatsapp") await shareToWhatsApp(uri);
    else await shareGeneral(uri);

    if (bookingId) {
      const result = await logShare(bookingId, platform);
      if (result && result.pointsAwarded > 0) {
        setAwardedPoints(result.pointsAwarded);
        setPointsBurstVisible(true);
        setTimeout(() => setPointsBurstVisible(false), 2000);
      }
    }
  }

  async function handleSave() {
    const uri = await captureCard();
    if (!uri) return;
    const saved = await saveToPhotos(uri);
    if (saved) {
      setAwardedPoints(0);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Share Your Game</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Card preview */}
        <View style={styles.cardWrap}>
          <PointsBurst points={awardedPoints} visible={pointsBurstVisible} />
          <ViewShot
            ref={viewShotRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          >
            <ShareCard
              facilityName={facilityName ?? ""}
              facilityCity={facilityCity ?? ""}
              sport={sport ?? ""}
              date={date ?? ""}
              startTime={startTime ?? ""}
              endTime={endTime ?? ""}
              caption={caption}
              showPoints={showPoints}
              showTier={showTier}
              showFacility={showFacility}
              totalPoints={totalPoints}
              tierName={tierName}
              userPhotoUri={selectedBg === "photo" ? userPhotoUri : null}
            />
          </ViewShot>
        </View>

        {/* Background selector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Background</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
            {sportBgChips.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={() => handleBgSelect(chip.key, chip.isPhoto)}
                style={[
                  styles.bgChip,
                  { backgroundColor: chip.bg },
                  selectedBg === chip.key && styles.bgChipActive,
                ]}
              >
                <Text style={styles.bgChipEmoji}>{chip.emoji}</Text>
                <Text style={styles.bgChipLabel} numberOfLines={1}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {selectedBg === "photo" && userPhotoUri && (
            <Pressable onPress={() => { setUserPhotoUri(null); setSelectedBg("sport"); }} style={styles.removePhotoBtn}>
              <Text style={styles.removePhotoText}>Remove photo</Text>
            </Pressable>
          )}
        </View>

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="Add a caption…"
            placeholderTextColor={C.muted}
            maxLength={150}
            multiline
            textAlignVertical="top"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {PRESET_CAPTIONS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setCaption(p)}
                style={[styles.presetChip, caption === p && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, caption === p && styles.presetChipTextActive]}>
                  {p}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Stats toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Show on Card</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>⭐ My Points</Text>
            <Switch
              value={showPoints}
              onValueChange={setShowPoints}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🏅 Tier Badge</Text>
            <Switch
              value={showTier}
              onValueChange={setShowTier}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>🏟 Facility Name</Text>
            <Switch
              value={showFacility}
              onValueChange={setShowFacility}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Share buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Share to</Text>
          <View style={styles.shareGrid}>
            <Pressable
              style={styles.shareBtn}
              onPress={() => handleShare("instagram")}
              disabled={sharing}
            >
              <Text style={styles.shareBtnIcon}>📱</Text>
              <Text style={styles.shareBtnLabel}>Instagram</Text>
            </Pressable>
            <Pressable
              style={styles.shareBtn}
              onPress={() => handleShare("whatsapp")}
              disabled={sharing}
            >
              <Text style={styles.shareBtnIcon}>💬</Text>
              <Text style={styles.shareBtnLabel}>WhatsApp</Text>
            </Pressable>
            <Pressable
              style={styles.shareBtn}
              onPress={() => handleShare("other")}
              disabled={sharing}
            >
              <Text style={styles.shareBtnIcon}>···</Text>
              <Text style={styles.shareBtnLabel}>More</Text>
            </Pressable>
            <Pressable
              style={[styles.shareBtn, saving && styles.shareBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.shareBtnIcon}>⬇️</Text>
              <Text style={styles.shareBtnLabel}>{saving ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  backText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  screenTitle: { color: C.text, fontSize: 18, fontWeight: "800" },

  // Card preview
  cardWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    position: "relative",
  },
  pointsBurst: {
    position: "absolute",
    top: 24,
    zIndex: 10,
    backgroundColor: "#F59E0B",
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pointsBurstText: { color: "#000", fontSize: 16, fontWeight: "900" },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20, gap: 10 },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Background chips
  bgRow: { gap: 8, paddingRight: 16 },
  bgChip: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bgChipActive: { borderColor: C.primary },
  bgChipEmoji: { fontSize: 22 },
  bgChipLabel: { color: "#fff", fontSize: 9, fontWeight: "600", textAlign: "center" },
  removePhotoBtn: { alignSelf: "flex-start", marginTop: 4 },
  removePhotoText: { color: C.primary, fontSize: 12, fontWeight: "600" },

  // Caption
  captionInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 14,
    padding: 12,
    height: 80,
  },
  presetRow: { gap: 8, paddingRight: 16 },
  presetChip: {
    backgroundColor: C.surface,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.border,
  },
  presetChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  presetChipText: { color: C.muted, fontSize: 12 },
  presetChipTextActive: { color: C.text },

  // Stats toggles
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleLabel: { color: C.text, fontSize: 14, fontWeight: "500" },

  // Share buttons
  shareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shareBtn: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.surface,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  shareBtnDisabled: { opacity: 0.5 },
  shareBtnIcon: { fontSize: 24 },
  shareBtnLabel: { color: C.text, fontSize: 13, fontWeight: "600" },
});
