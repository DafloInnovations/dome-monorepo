import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

interface City {
  name: string;
  province: string;
  lat: number;
  lng: number;
}

const CITIES: City[] = [
  { name: "Toronto",     province: "ON", lat: 43.6532, lng: -79.3832  },
  { name: "Montreal",    province: "QC", lat: 45.5017, lng: -73.5673  },
  { name: "Vancouver",   province: "BC", lat: 49.2827, lng: -123.1207 },
  { name: "Calgary",     province: "AB", lat: 51.0447, lng: -114.0719 },
  { name: "Edmonton",    province: "AB", lat: 53.5461, lng: -113.4938 },
  { name: "Ottawa",      province: "ON", lat: 45.4215, lng: -75.6972  },
  { name: "Winnipeg",    province: "MB", lat: 49.8951, lng: -97.1384  },
  { name: "Quebec City", province: "QC", lat: 46.8139, lng: -71.2080  },
  { name: "Hamilton",    province: "ON", lat: 43.2557, lng: -79.8711  },
  { name: "Scarborough", province: "ON", lat: 43.7764, lng: -79.2318  },
  { name: "Kitchener",   province: "ON", lat: 43.4516, lng: -80.4925  },
  { name: "London",      province: "ON", lat: 42.9849, lng: -81.2453  },
  { name: "Halifax",     province: "NS", lat: 44.6488, lng: -63.5752  },
  { name: "Victoria",    province: "BC", lat: 48.4284, lng: -123.3656 },
  { name: "Saskatoon",   province: "SK", lat: 52.1332, lng: -106.6700 },
  { name: "Regina",      province: "SK", lat: 50.4452, lng: -104.6189 },
];

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
  const [selectedCity, setSelectedCity] = useState<City>(CITIES[0]!);
  const [playersNeeded, setPlayersNeeded] = useState(4);
  const [gameDate, setGameDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [description, setDescription] = useState("");

  const [facilities, setFacilities] = useState<FacilityResult[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<FacilityResult | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [facilityDropdownOpen, setFacilityDropdownOpen] = useState(false);

  useEffect(() => {
    if (!sport) {
      setFacilities([]);
      return;
    }

    const controller = new AbortController();
    const selectedSport = sport;

    async function fetchFacilities() {
      setFacilityLoading(true);
      setFacilityError(null);
      setFacilities([]);

      const cityParams = new URLSearchParams({
        city: selectedCity.name,
        limit: "20",
        sport: selectedSport,
      });
      const nearbyParams = new URLSearchParams({
        lat: String(selectedCity.lat),
        lng: String(selectedCity.lng),
        radius: "20",
        sport: selectedSport,
      });

      try {
        const cityRes = await fetch(`${API_URL}/facilities?${cityParams.toString()}`, {
          signal: controller.signal,
        });
        if (!cityRes.ok) throw new Error(`HTTP ${cityRes.status}`);
        const cityJson = (await cityRes.json()) as { data: FacilityResult[] };
        const exactCityFacilities = cityJson.data ?? [];

        const nearbyRes = await fetch(`${API_URL}/facilities?${nearbyParams.toString()}`, {
          signal: controller.signal,
        });
        if (!nearbyRes.ok) throw new Error(`HTTP ${nearbyRes.status}`);
        const nearbyJson = (await nearbyRes.json()) as { data: FacilityResult[] };
        const nearbyFacilities = nearbyJson.data ?? [];

        const byId = new Map<string, FacilityResult>();
        for (const facility of exactCityFacilities) byId.set(facility.id, facility);
        for (const facility of nearbyFacilities) {
          if (!byId.has(facility.id)) byId.set(facility.id, facility);
        }

        setFacilities(Array.from(byId.values()));
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setFacilities([]);
        setFacilityError("Could not load facilities. Please try again.");
      } finally {
        if (!controller.signal.aborted) setFacilityLoading(false);
      }
    }

    void fetchFacilities();

    return () => controller.abort();
  }, [selectedCity, sport]);

  function handleSportSelect(nextSport: string) {
    setSport(nextSport);
    setSelectedFacility(null);
    setFacilityDropdownOpen(false);
  }

  function handleCitySelect(city: City) {
    setSelectedCity(city);
    setSelectedFacility(null);
    setFacilityDropdownOpen(false);
  }

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
              onPress={() => handleSportSelect(s.key)}
            >
              <Text style={[styles.pillText, sport === s.key && styles.pillTextActive]}>
                {s.emoji} {s.key.charAt(0) + s.key.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {sport && (
          <>
            <Text style={styles.label}>City</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cityPillRow}
            >
              {CITIES.map((city) => {
                const active = selectedCity.name === city.name;
                return (
                  <Pressable
                    key={city.name}
                    style={[styles.cityPill, active && styles.cityPillActive]}
                    onPress={() => handleCitySelect(city)}
                  >
                    <Text style={[styles.cityPillText, active && styles.cityPillTextActive]}>
                      {city.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Facility</Text>
            <View>
              <Pressable
                style={[
                  styles.facilitySelect,
                  selectedFacility && styles.facilitySelectActive,
                ]}
                onPress={() => setFacilityDropdownOpen((open) => !open)}
                disabled={facilityLoading}
              >
                <View style={styles.facilitySelectTextWrap}>
                  <Text
                    style={[
                      styles.facilitySelectText,
                      !selectedFacility && styles.facilitySelectPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {selectedFacility?.name ?? "Select a facility"}
                  </Text>
                  {selectedFacility?.address ? (
                    <Text style={styles.selectedFacilityAddr} numberOfLines={1}>
                      {selectedFacility.address.city}
                    </Text>
                  ) : null}
                </View>
                {facilityLoading ? (
                  <ActivityIndicator color={C.primary} size="small" />
                ) : (
                  <Text style={styles.dropdownChevron}>▾</Text>
                )}
              </Pressable>

              {facilityError && <Text style={styles.noResults}>{facilityError}</Text>}

              {facilityDropdownOpen && !facilityLoading && (
                <View style={styles.facilityDropdown}>
                  {facilities.length > 0 ? (
                    facilities.map((f) => (
                      <Pressable
                        key={f.id}
                        style={styles.facilityOption}
                        onPress={() => {
                          setSelectedFacility(f);
                          setFacilityDropdownOpen(false);
                        }}
                      >
                        <Text style={styles.facilityOptionName}>{f.name}</Text>
                        {f.address ? (
                          <Text style={styles.facilityOptionCity}>{f.address.city}</Text>
                        ) : null}
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.facilityEmpty}>
                      No facilities found in {selectedCity.name}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {sport && selectedFacility && (
          <>
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
          </>
        )}
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
  cityPillRow: { gap: 8, paddingRight: 16 },
  cityPill: {
    backgroundColor: C.surface,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cityPillActive: { backgroundColor: C.primary, borderColor: C.primary },
  cityPillText: { color: C.muted, fontSize: 13, fontWeight: "700" },
  cityPillTextActive: { color: C.text },
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
  facilitySelect: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  facilitySelectActive: { borderColor: C.primary },
  facilitySelectTextWrap: { flex: 1, paddingRight: 12 },
  facilitySelectText: { color: C.text, fontSize: 15, fontWeight: "700" },
  facilitySelectPlaceholder: { color: C.muted, fontWeight: "600" },
  selectedFacilityAddr: { color: C.muted, fontSize: 12, marginTop: 2 },
  dropdownChevron: { color: C.muted, fontSize: 18, fontWeight: "800" },
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
  facilityEmpty: { color: C.muted, fontSize: 13, padding: 14, textAlign: "center" },
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
