import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import FacilityCard from "../../src/components/FacilityCard";
import { useFacilities } from "../../src/hooks/useFacilities";

// ─── City data ────────────────────────────────────────────────────────────────

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
  { name: "Kitchener",   province: "ON", lat: 43.4516, lng: -80.4925  },
  { name: "London",      province: "ON", lat: 42.9849, lng: -81.2453  },
  { name: "Halifax",     province: "NS", lat: 44.6488, lng: -63.5752  },
  { name: "Victoria",    province: "BC", lat: 48.4284, lng: -123.3656 },
  { name: "Saskatoon",   province: "SK", lat: 52.1332, lng: -106.6700 },
  { name: "Regina",      province: "SK", lat: 50.4452, lng: -104.6189 },
];

const TORONTO = CITIES[0]!;
const STORAGE_KEY = "dome_selected_city";
const SPORTS = ["All", "Soccer", "Basketball", "Tennis", "Badminton", "Hockey", "Pickleball"];

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

// ─── City picker modal ────────────────────────────────────────────────────────

interface CityPickerProps {
  visible: boolean;
  selectedCity: City;
  onSelect: (city: City) => void;
  onClose: () => void;
}

function CityPickerModal({ visible, selectedCity, onSelect, onClose }: CityPickerProps) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);

  const filtered = query.trim()
    ? CITIES.filter((c) =>
        `${c.name} ${c.province}`.toLowerCase().includes(query.toLowerCase())
      )
    : CITIES;

  async function handleUseGPS() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      // Pick the city whose centre is closest to the device
      let nearest = TORONTO;
      let minDist = Infinity;
      for (const city of CITIES) {
        const d = Math.hypot(
          city.lat - loc.coords.latitude,
          city.lng - loc.coords.longitude
        );
        if (d < minDist) { minDist = d; nearest = city; }
      }
      onSelect(nearest);
    } finally {
      setLocating(false);
    }
  }

  // Reset search when modal is reopened
  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modal.container}>
        {/* Header */}
        <View style={modal.header}>
          <Text style={modal.title}>Select City</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={modal.done}>Done</Text>
          </Pressable>
        </View>

        {/* Search */}
        <TextInput
          style={modal.search}
          placeholder="Search cities..."
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          clearButtonMode="while-editing"
          returnKeyType="search"
        />

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 48 }}
          ListHeaderComponent={
            <Pressable
              style={modal.gpsRow}
              onPress={handleUseGPS}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator color={C.primary} size="small" style={modal.gpsIcon} />
              ) : (
                <Text style={modal.gpsIcon}>📍</Text>
              )}
              <Text style={modal.gpsText}>Use my current location</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const active = item.name === selectedCity.name;
            return (
              <Pressable
                style={[modal.cityRow, active && modal.cityRowActive]}
                onPress={() => onSelect(item)}
              >
                <View>
                  <Text style={modal.cityName}>{item.name}</Text>
                  <Text style={modal.cityProvince}>{item.province}</Text>
                </View>
                {active && <Text style={modal.check}>✓</Text>}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={modal.sep} />}
        />
      </View>
    </Modal>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  cityName,
  isToronto,
  onExploreToronto,
}: {
  cityName: string;
  isToronto: boolean;
  onExploreToronto: () => void;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>🏟</Text>
      <Text style={styles.emptyTitle}>No facilities in {cityName} yet</Text>
      <Text style={styles.emptySub}>Be the first venue to join Dome</Text>
      {!isToronto && (
        <Pressable style={styles.primaryBtn} onPress={onExploreToronto}>
          <Text style={styles.primaryBtnText}>Explore Toronto instead</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const [selectedCity, setSelectedCity] = useState<City>(TORONTO);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [activeSport, setActiveSport] = useState("All");

  // Restore persisted city choice on first render
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as City;
        // Validate it's still in our list (guard against stale data)
        const match = CITIES.find((c) => c.name === saved.name);
        if (match) setSelectedCity(match);
      } catch {
        // ignore malformed storage value
      }
    });
  }, []);

  const { facilities, isLoading, error, refetch } = useFacilities({
    lat: selectedCity.lat,
    lng: selectedCity.lng,
    radius: 10,
    sport: activeSport === "All" ? undefined : activeSport,
  });

  async function handleCitySelect(city: City) {
    setSelectedCity(city);
    setPickerVisible(false);
    setSearch("");
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(city));
  }

  const filtered = search
    ? facilities.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
      )
    : facilities;

  const isToronto = selectedCity.name === "Toronto";

  return (
    <View style={styles.container}>
      {/* Location header — tap to open picker */}
      <Pressable
        style={styles.header}
        onPress={() => setPickerVisible(true)}
        hitSlop={8}
      >
        <Text style={styles.headerLabel}>Near</Text>
        <View style={styles.headerRow}>
          <Text style={styles.headerCity}>
            {selectedCity.name}, {selectedCity.province}
          </Text>
          <Text style={styles.headerArrow}>▾</Text>
        </View>
      </Pressable>

      {/* Facility search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search facilities..."
        placeholderTextColor={C.muted}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      {/* Sport filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillRow}
        contentContainerStyle={styles.pillContent}
      >
        {SPORTS.map((sport) => (
          <Pressable
            key={sport}
            style={[styles.pill, activeSport === sport && styles.pillActive]}
            onPress={() => { setActiveSport(sport); setSearch(""); }}
          >
            <Text style={[styles.pillText, activeSport === sport && styles.pillTextActive]}>
              {sport}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={refetch}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FacilityCard facility={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              cityName={selectedCity.name}
              isToronto={isToronto}
              onExploreToronto={() => handleCitySelect(TORONTO)}
            />
          }
        />
      )}

      <CityPickerModal
        visible={pickerVisible}
        selectedCity={selectedCity}
        onSelect={handleCitySelect}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 14,
  },
  headerLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  headerCity: { color: C.text, fontSize: 22, fontWeight: "700" },
  headerArrow: { color: C.primary, fontSize: 16, fontWeight: "700", marginTop: 2 },
  // Search
  searchInput: {
    backgroundColor: C.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  // Sport pills
  pillRow: { flexGrow: 0, marginBottom: 16 },
  pillContent: { paddingHorizontal: 16, gap: 8 },
  pill: {
    backgroundColor: C.surface,
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: C.primary },
  pillText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: C.text },
  // List
  list: { paddingBottom: 32 },
  // Center (loading / error)
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  errorText: { color: "#ff6b6b", fontSize: 15, marginBottom: 16, textAlign: "center" },
  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 20 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  emptySub: { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 28 },
  // Shared button
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 99,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryBtnText: { color: C.text, fontWeight: "700", fontSize: 14 },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { color: C.text, fontSize: 17, fontWeight: "700" },
  done: { color: C.primary, fontSize: 16, fontWeight: "600" },
  search: {
    backgroundColor: C.surface,
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
  },
  // GPS row
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    marginBottom: 8,
  },
  gpsIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: "center" },
  gpsText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  // City rows
  cityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cityRowActive: { backgroundColor: C.surface },
  cityName: { color: C.text, fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cityProvince: { color: C.muted, fontSize: 13 },
  check: { color: C.primary, fontSize: 18, fontWeight: "700" },
  sep: { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
});
