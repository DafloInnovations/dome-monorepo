import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useConnectActions } from "../../src/hooks/useConnect";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
  inputBg: "#1C1C1E",
};

const SPORTS = [
  { key: "BADMINTON", emoji: "🏸" },
  { key: "PICKLEBALL", emoji: "🏓" },
  { key: "TENNIS", emoji: "🎾" },
  { key: "SOCCER", emoji: "⚽" },
  { key: "BASKETBALL", emoji: "🏀" },
  { key: "VOLLEYBALL", emoji: "🏐" },
  { key: "HOCKEY", emoji: "🏒" },
  { key: "CRICKET", emoji: "🏏" },
];

const SKILL_LEVELS = ["BEGINNER", "ROOKIE", "INTERMEDIATE", "ADVANCED", "PRO", "ELITE"];

interface FacilityResult {
  id: string;
  name: string;
  address: { city: string; street: string } | null;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PostGameScreen() {
  const router = useRouter();
  const { postGame, isLoading } = useConnectActions();

  const [sport, setSport] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [playersNeeded, setPlayersNeeded] = useState(4);
  const [gameDate, setGameDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [description, setDescription] = useState("");

  // Facility search
  const [facilityQuery, setFacilityQuery] = useState("");
  const [facilities, setFacilities] = useState<FacilityResult[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityResult | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [showFacilityList, setShowFacilityList] = useState(false);

  const searchFacilities = useCallback(async (q: string) => {
    if (q.length < 2) {
      setFacilities([]);
      setShowFacilityList(false);
      return;
    }
    setFacilityLoading(true);
    try {
      const res = await fetch(`${API_URL}/facilities?city=Toronto&limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data: FacilityResult[] };
      const all = json.data ?? [];
      const filtered = all.filter((f) =>
        f.name.toLowerCase().includes(q.toLowerCase())
      );
      setFacilities(filtered);
      setShowFacilityList(true);
    } catch {
      setFacilities([]);
    } finally {
      setFacilityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFacility) return;
    const t = setTimeout(() => searchFacilities(facilityQuery), 300);
    return () => clearTimeout(t);
  }, [facilityQuery, selectedFacility, searchFacilities]);

  async function handleSubmit() {
    if (!sport) return Alert.alert("Missing", "Please select a sport.");
    if (!selectedFacility) return Alert.alert("Missing", "Please select a facility.");
    if (!skillLevel) return Alert.alert("Missing", "Please select a skill level.");
    if (!gameDate.match(/^\d{4}-\d{2}-\d{2}$/)) return Alert.alert("Invalid", "Date must be YYYY-MM-DD.");
    if (!startTime.match(/^\d{2}:\d{2}$/)) return Alert.alert("Invalid", "Start time must be HH:mm.");
    if (!endTime.match(/^\d{2}:\d{2}$/)) return Alert.alert("Invalid", "End time must be HH:mm.");

    try {
      await postGame({
        facilityId: selectedFacility.id,
        sport,
        gameDate,
        startTime,
        endTime,
        playersNeeded,
        skillLevel,
        description: description.trim() || undefined,
      });
      Alert.alert("Game Posted!", "Players can now discover and join your game.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not post game.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.screenTitle}>Post a Game</Text>
        </View>

        {/* Sport selector */}
        <Text style={styles.label}>Sport</Text>
        <View style={styles.pillGrid}>
          {SPORTS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.pill, sport === s.key && styles.pillActive]}
              onPress={() => setSport(s.key)}
            >
              <Text style={[styles.pillText, sport === s.key && styles.pillTextActive]}>
                {s.emoji} {s.key.charAt(0) + s.key.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Facility search */}
        <Text style={styles.label}>Facility</Text>
        {selectedFacility ? (
          <Pressable
            style={styles.selectedFacility}
            onPress={() => {
              setSelectedFacility(null);
              setFacilityQuery("");
            }}
          >
            <View>
              <Text style={styles.selectedFacilityName}>{selectedFacility.name}</Text>
              {selectedFacility.address ? (
                <Text style={styles.selectedFacilityAddr}>
                  {selectedFacility.address.city} · Tap to change
                </Text>
              ) : (
                <Text style={styles.selectedFacilityAddr}>Tap to change</Text>
              )}
            </View>
            <Text style={styles.clearX}>✕</Text>
          </Pressable>
        ) : (
          <View>
            <TextInput
              style={styles.input}
              placeholder="Search facility name…"
              placeholderTextColor={C.muted}
              value={facilityQuery}
              onChangeText={setFacilityQuery}
              autoCorrect={false}
            />
            {facilityLoading && (
              <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
            )}
            {showFacilityList && facilities.length > 0 && (
              <View style={styles.facilityDropdown}>
                {facilities.map((f) => (
                  <Pressable
                    key={f.id}
                    style={styles.facilityOption}
                    onPress={() => {
                      setSelectedFacility(f);
                      setShowFacilityList(false);
                    }}
                  >
                    <Text style={styles.facilityOptionName}>{f.name}</Text>
                    {f.address ? (
                      <Text style={styles.facilityOptionCity}>{f.address.city}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
            {showFacilityList && facilities.length === 0 && !facilityLoading && (
              <Text style={styles.noResults}>No facilities found. Try a different name.</Text>
            )}
          </View>
        )}

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={gameDate}
          onChangeText={setGameDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.muted}
          keyboardType="numeric"
          maxLength={10}
        />

        {/* Start / End time */}
        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Start Time</Text>
            <TextInput
              style={styles.input}
              value={startTime}
              onChangeText={setStartTime}
              placeholder="HH:mm"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>End Time</Text>
            <TextInput
              style={styles.input}
              value={endTime}
              onChangeText={setEndTime}
              placeholder="HH:mm"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              maxLength={5}
            />
          </View>
        </View>

        {/* Players needed stepper */}
        <Text style={styles.label}>Players Needed</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => setPlayersNeeded((n) => Math.max(2, n - 1))}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{playersNeeded}</Text>
          <Pressable
            style={styles.stepperBtn}
            onPress={() => setPlayersNeeded((n) => Math.min(10, n + 1))}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Skill level */}
        <Text style={styles.label}>Skill Level</Text>
        <View style={styles.pillGrid}>
          {SKILL_LEVELS.map((s) => (
            <Pressable
              key={s}
              style={[styles.pill, skillLevel === s && styles.pillActive]}
              onPress={() => setSkillLevel(s)}
            >
              <Text style={[styles.pillText, skillLevel === s && styles.pillTextActive]}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Any notes for players joining…"
          placeholderTextColor={C.muted}
          multiline
          numberOfLines={4}
          maxLength={500}
        />

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={C.text} />
          ) : (
            <Text style={styles.submitBtnText}>Post Game</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: Platform.OS === "ios" ? 60 : 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  backBtn: { padding: 4 },
  backBtnText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  screenTitle: { color: C.text, fontSize: 22, fontWeight: "800" },
  label: { color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 16, textTransform: "uppercase", letterSpacing: 0.5 },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  pillActive: { backgroundColor: C.primary, borderColor: C.primary },
  pillText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: C.text },
  input: {
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  textArea: { height: 100, textAlignVertical: "top", paddingTop: 12 },
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { color: C.text, fontSize: 20, fontWeight: "700" },
  stepperValue: { color: C.text, fontSize: 22, fontWeight: "800", minWidth: 28, textAlign: "center" },
  selectedFacility: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  selectedFacilityName: { color: C.text, fontSize: 15, fontWeight: "600" },
  selectedFacilityAddr: { color: C.muted, fontSize: 12, marginTop: 2 },
  clearX: { color: C.muted, fontSize: 16 },
  facilityDropdown: {
    backgroundColor: C.surface,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  facilityOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  facilityOptionName: { color: C.text, fontSize: 14, fontWeight: "600" },
  facilityOptionCity: { color: C.muted, fontSize: 12, marginTop: 2 },
  noResults: { color: C.muted, fontSize: 13, marginTop: 8, textAlign: "center" },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: C.text, fontSize: 16, fontWeight: "800" },
});
