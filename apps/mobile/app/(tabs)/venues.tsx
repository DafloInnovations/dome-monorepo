import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFacilities, type Facility } from "../../src/hooks/useFacilities";
import { useThreads } from "../../src/hooks/useChat";
import { useNotificationsContext } from "../../src/context/NotificationsContext";
import { COLORS } from "../../src/theme";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#F5F5F5",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#E8E8E8",
  green:   "#22C55E",
};

// ─── Constants ────────────────────────────────────────────────────────────────

interface City { name: string; province: string; lat?: number; lng?: number }

const ALL_CITIES: City = { name: "All Cities", province: "" };
const TORONTO: City    = { name: "Toronto",    province: "ON", lat: 43.6532, lng: -79.3832 };

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
  { name: "Halifax",     province: "NS", lat: 44.6488, lng: -63.5752  },
  { name: "Saskatoon",   province: "SK", lat: 52.1332, lng: -106.6700 },
];

const CITY_STORAGE_KEY = "dome_selected_city_v2";

const SPORT_PILLS: { key: string; emoji: string; label: string }[] = [
  { key: "All",        emoji: "🏟",  label: "All"        },
  { key: "BADMINTON",  emoji: "🏸",  label: "Badminton"  },
  { key: "TENNIS",     emoji: "🎾",  label: "Tennis"     },
  { key: "PICKLEBALL", emoji: "🏓",  label: "Pickleball" },
  { key: "BASKETBALL", emoji: "🏀",  label: "Basketball" },
  { key: "SOCCER",     emoji: "⚽",  label: "Soccer"     },
  { key: "CRICKET",    emoji: "🏏",  label: "Cricket"    },
  { key: "BOWLING",    emoji: "🎳",  label: "Bowling"    },
  { key: "GOLF",       emoji: "⛳",  label: "Golf"       },
  { key: "VOLLEYBALL", emoji: "🏐",  label: "Volleyball" },
  { key: "HOCKEY",     emoji: "🏒",  label: "Hockey"     },
];

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏", BOWLING: "🎳", GOLF: "⛳",
};

const SPORT_BG: Record<string, string> = {
  BADMINTON:  "#1a6e3a",
  PICKLEBALL: "#A0522D",
  TENNIS:     "#A07814",
  BASKETBALL: "#CC3300",
  SOCCER:     "#1565C0",
  VOLLEYBALL: "#2E7D50",
  HOCKEY:     "#0d5299",
  CRICKET:    "#7B2FBE",
  BOWLING:    "#006064",
  GOLF:       "#388E3C",
};
const DEFAULT_BG = "#C73A55";

type SortBy = "nearest" | "rated" | "popular";
const SORT_LABELS: Record<SortBy, string> = {
  nearest: "Nearest",
  rated:   "Highest Rated",
  popular: "Most Popular",
};

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────

function FacilityCardSkeleton() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  const bg = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["#F0F0F0", "#E0E0E0"] });
  return (
    <View style={sk.card}>
      <Animated.View style={[sk.image, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <View style={sk.row}>
          <Animated.View style={[sk.line, { width: "55%", backgroundColor: bg }]} />
          <Animated.View style={[sk.line, { width: "18%", backgroundColor: bg }]} />
        </View>
        <Animated.View style={[sk.line, { width: "70%", backgroundColor: bg }]} />
        <View style={sk.row}>
          <Animated.View style={[sk.pill, { backgroundColor: bg }]} />
          <Animated.View style={[sk.line, { width: "22%", backgroundColor: bg }]} />
          <Animated.View style={[sk.btn, { backgroundColor: bg }]} />
        </View>
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card:  { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", marginBottom: 16, elevation: 2 },
  image: { height: 180, width: "100%" },
  body:  { padding: 14, gap: 10 },
  row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  line:  { height: 12, borderRadius: 6 },
  pill:  { height: 24, width: 80, borderRadius: 12 },
  btn:   { height: 32, width: 88, borderRadius: 10 },
});

// ─── Facility card ────────────────────────────────────────────────────────────

function FacilityCard({
  facility, saved, onSaveToggle,
}: {
  facility: Facility; saved: boolean; onSaveToggle: () => void;
}) {
  const router = useRouter();
  const sportRaw    = (facility.sport ?? "").toUpperCase();
  const sportEmoji  = SPORT_EMOJI[sportRaw] ?? "🏟";
  const sportLabel  = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : null;
  const sportColor  = COLORS.sports[sportRaw as keyof typeof COLORS.sports];
  const gradBg      = SPORT_BG[sportRaw] ?? DEFAULT_BG;
  const imageUri    = facility.images?.[0] ?? null;
  const hasReviews  = (facility.totalReviews ?? 0) > 0;
  const ratingText  = facility.averageRating != null ? facility.averageRating.toFixed(1) : null;
  const distText    = facility.distanceKm !== undefined
    ? `${facility.distanceKm.toFixed(1)} km` : null;
  const addressText = facility.address
    ? `${facility.address.street}, ${facility.address.city}` : null;

  return (
    <Pressable
      style={fc.card}
      onPress={() => router.push(`/facility/${facility.id}`)}
    >
      {/* Hero image / gradient */}
      <View style={fc.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={fc.image} resizeMode="cover" />
        ) : (
          <View style={[fc.image, { backgroundColor: gradBg }]}>
            <Text style={fc.gradEmoji}>{sportEmoji}</Text>
          </View>
        )}

        {/* Sport badge top-left */}
        {sportLabel && (
          <View style={fc.sportBadge}>
            <Text style={fc.sportBadgeText}>{sportEmoji} {sportLabel.toUpperCase()}</Text>
          </View>
        )}

        {/* Save heart top-right */}
        <Pressable style={fc.heartBtn} onPress={onSaveToggle} hitSlop={10}>
          <Text style={[fc.heartIcon, saved && fc.heartIconSaved]}>{saved ? "♥" : "♡"}</Text>
        </Pressable>

        {/* New / rating badge bottom-left */}
        {!hasReviews ? (
          <View style={fc.newBadge}>
            <Text style={fc.newBadgeText}>NEW</Text>
          </View>
        ) : null}
      </View>

      {/* Card body */}
      <View style={fc.body}>
        {/* Name + rating */}
        <View style={fc.nameRow}>
          <Text style={fc.name} numberOfLines={1}>{facility.name}</Text>
          {ratingText ? (
            <Text style={fc.rating}>⭐ {ratingText}</Text>
          ) : null}
        </View>

        {/* Address */}
        {addressText ? (
          <Text style={fc.address} numberOfLines={1}>{addressText}</Text>
        ) : null}

        {/* Sport pill + distance + book */}
        <View style={fc.metaRow}>
          {sportColor ? (
            <View style={[fc.sportPill, { backgroundColor: sportColor.bg }]}>
              <Text style={[fc.sportPillText, { color: sportColor.accent }]}>
                {sportEmoji} {sportLabel}
              </Text>
            </View>
          ) : null}
          {distText ? (
            <Text style={fc.distText}>📍 {distText}</Text>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable
            style={fc.bookBtn}
            onPress={() => router.push(`/facility/${facility.id}`)}
          >
            <Text style={fc.bookBtnText}>Book →</Text>
          </Pressable>
        </View>

        {/* Price */}
        <Text style={fc.price}>From C$20/hr</Text>
      </View>
    </Pressable>
  );
}

const fc = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  imageWrap: { height: 180, position: "relative" },
  image:     { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  gradEmoji: { fontSize: 72, opacity: 0.9 },
  sportBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  sportBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  heartBtn: {
    position: "absolute", top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 2,
  },
  heartIcon:      { fontSize: 18, color: "#888" },
  heartIconSaved: { color: C.primary },
  newBadge: {
    position: "absolute", bottom: 12, left: 12,
    backgroundColor: C.green,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  body:    { padding: 14, gap: 7 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name:    { color: C.text, fontSize: 17, fontWeight: "700", flex: 1 },
  rating:  { color: C.text, fontSize: 13, fontWeight: "700" },
  address: { color: "#6B6B6B", fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  sportPill: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  sportPillText: { fontSize: 12, fontWeight: "600" },
  distText:  { color: C.muted, fontSize: 12, fontWeight: "600" },
  bookBtn: {
    backgroundColor: C.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  bookBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  price:  { color: C.muted, fontSize: 12, marginTop: -2 },
});

// ─── City picker modal ────────────────────────────────────────────────────────

function CityPickerModal({
  visible, selectedCity, onSelect, onClose,
}: {
  visible: boolean; selectedCity: City;
  onSelect: (c: City) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);
  const opts = [ALL_CITIES, ...CITIES];
  const filtered = query.trim()
    ? opts.filter((c) => `${c.name} ${c.province}`.toLowerCase().includes(query.toLowerCase()))
    : opts;

  async function handleGps() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      let nearest = TORONTO;
      let minDist  = Infinity;
      for (const c of CITIES) {
        if (c.lat == null || c.lng == null) continue;
        const d = Math.hypot(c.lat - loc.coords.latitude, c.lng - loc.coords.longitude);
        if (d < minDist) { minDist = d; nearest = c; }
      }
      onSelect(nearest);
    } finally { setLocating(false); }
  }

  useEffect(() => { if (!visible) setQuery(""); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cm.container}>
        <View style={cm.header}>
          <Text style={cm.title}>Select City</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={cm.done}>Done</Text>
          </Pressable>
        </View>
        <TextInput
          style={cm.search} placeholder="Search cities…"
          placeholderTextColor={C.muted}
          value={query} onChangeText={setQuery}
          autoFocus clearButtonMode="while-editing"
        />
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.name}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 48 }}
          ListHeaderComponent={
            <Pressable style={cm.gpsRow} onPress={handleGps} disabled={locating}>
              {locating
                ? <ActivityIndicator color={C.primary} size="small" style={{ marginRight: 12 }} />
                : <Text style={cm.gpsIcon}>📍</Text>
              }
              <Text style={cm.gpsText}>Use my current location</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const active = item.name === selectedCity.name;
            return (
              <Pressable
                style={[cm.cityRow, active && cm.cityRowActive]}
                onPress={() => onSelect(item)}
              >
                <View>
                  <Text style={cm.cityName}>{item.name}</Text>
                  {item.province ? <Text style={cm.cityProv}>{item.province}</Text> : null}
                </View>
                {active ? <Text style={cm.check}>✓</Text> : null}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={cm.sep} />}
        />
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  title:   { color: C.text, fontSize: 17, fontWeight: "700" },
  done:    { color: C.primary, fontSize: 16, fontWeight: "600" },
  search: {
    backgroundColor: C.surface, borderRadius: 12, margin: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: C.text, fontSize: 15,
  },
  gpsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 8,
  },
  gpsIcon:     { fontSize: 18, marginRight: 12, width: 24, textAlign: "center" },
  gpsText:     { color: C.primary, fontSize: 15, fontWeight: "600" },
  cityRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  cityRowActive: { backgroundColor: C.surface },
  cityName:  { color: C.text, fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cityProv:  { color: C.muted, fontSize: 13 },
  check:     { color: C.primary, fontSize: 18, fontWeight: "700" },
  sep:       { height: 1, backgroundColor: C.border, marginHorizontal: 20 },
});

// ─── Filter bottom sheet ──────────────────────────────────────────────────────

function FilterSheet({
  visible, sortBy, radius, onApply, onClose,
}: {
  visible: boolean;
  sortBy: SortBy;
  radius: number;
  onApply: (sort: SortBy, radius: number) => void;
  onClose: () => void;
}) {
  const [localSort, setLocalSort]   = useState<SortBy>(sortBy);
  const [localRadius, setLocalRadius] = useState(radius);

  useEffect(() => {
    if (visible) { setLocalSort(sortBy); setLocalRadius(radius); }
  }, [visible, sortBy, radius]);

  function reset() { setLocalSort("nearest"); setLocalRadius(10); }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={fs.container}>
        <View style={fs.handle} />
        <View style={fs.headerRow}>
          <Text style={fs.headerTitle}>FILTERS</Text>
          <Pressable onPress={reset} hitSlop={8}>
            <Text style={fs.reset}>Reset All</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          {/* Sort */}
          <Text style={fs.sectionLabel}>SORT BY</Text>
          <View style={fs.chips}>
            {(Object.entries(SORT_LABELS) as [SortBy, string][]).map(([key, label]) => (
              <Pressable
                key={key}
                style={[fs.chip, localSort === key && fs.chipActive]}
                onPress={() => setLocalSort(key)}
              >
                <Text style={[fs.chipText, localSort === key && fs.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Distance */}
          <Text style={fs.sectionLabel}>DISTANCE</Text>
          <View style={fs.chips}>
            {[2, 5, 10, 25].map((r) => (
              <Pressable
                key={r}
                style={[fs.chip, localRadius === r && fs.chipActive]}
                onPress={() => setLocalRadius(r)}
              >
                <Text style={[fs.chipText, localRadius === r && fs.chipTextActive]}>{r} km</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={fs.footer}>
          <Pressable
            style={fs.applyBtn}
            onPress={() => { onApply(localSort, localRadius); onClose(); }}
          >
            <Text style={fs.applyBtnText}>Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const fs = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#D0D0D0",
    alignSelf: "center", marginTop: 12, marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
    marginBottom: 20,
  },
  headerTitle:  { color: C.text, fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  reset:        { color: C.primary, fontSize: 14, fontWeight: "600" },
  sectionLabel: {
    color: C.muted, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase",
    marginBottom: 12, marginTop: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, backgroundColor: C.surface,
  },
  chipActive:     { backgroundColor: C.primary },
  chipText:       { color: C.text, fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  footer: {
    paddingHorizontal: 0, paddingBottom: 32, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  applyBtn: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function VenuesScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const params   = useLocalSearchParams<{ sport?: string }>();
  const mounted  = useRef(false);

  const { threads }    = useThreads();
  const { unreadCount } = useNotificationsContext();
  const unreadMessages  = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);

  const [selectedCity, setSelectedCity]   = useState<City>(ALL_CITIES);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [search, setSearch]               = useState("");
  const [activeSport, setActiveSport]     = useState(params.sport ?? "All");
  const [sortBy, setSortBy]               = useState<SortBy>("nearest");
  const [radius, setRadius]               = useState(10);
  const [savedIds, setSavedIds]           = useState<Set<string>>(new Set());

  // Restore persisted city
  useEffect(() => {
    AsyncStorage.getItem(CITY_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as City;
        const match = saved.name === ALL_CITIES.name
          ? ALL_CITIES : CITIES.find((c) => c.name === saved.name);
        if (match) setSelectedCity(match);
      } catch { /* ignore */ }
    });
  }, []);

  // Sync sport param from home screen taps
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (params.sport) setActiveSport(params.sport);
  }, [params.sport]);

  const { facilities, isLoading, error, refetch } = useFacilities({
    lat:    selectedCity.lat,
    lng:    selectedCity.lng,
    radius: selectedCity.lat != null ? radius : undefined,
    sport:  activeSport === "All" ? undefined : activeSport,
  });

  const displayedFacilities = useMemo(() => {
    let list = search.trim()
      ? facilities.filter((f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.address?.city.toLowerCase().includes(search.toLowerCase())
        )
      : [...facilities];

    if (sortBy === "nearest") list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    else if (sortBy === "rated") list.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    else if (sortBy === "popular") list.sort((a, b) => (b.totalReviews ?? 0) - (a.totalReviews ?? 0));

    return list;
  }, [facilities, search, sortBy]);

  async function handleCitySelect(city: City) {
    setSelectedCity(city);
    setPickerVisible(false);
    setSearch("");
    await AsyncStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city));
  }

  function toggleSave(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const cityLabel = selectedCity.name === ALL_CITIES.name
    ? "All Cities"
    : `${selectedCity.name}, ${selectedCity.province}`;

  const activePill = SPORT_PILLS.find((p) => p.key === activeSport) ?? SPORT_PILLS[0]!;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>VENUES</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/(tabs)/chats")}
            hitSlop={8}
          >
            <Ionicons name="chatbubbles-outline" size={22} color={C.text} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={C.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Location pill */}
      <Pressable style={styles.locationPill} onPress={() => setPickerVisible(true)}>
        <Text style={styles.locationPin}>📍</Text>
        <Text style={styles.locationText} numberOfLines={1}>{cityLabel}</Text>
        <Text style={styles.locationArrow}>▾</Text>
      </Pressable>

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search venues, sports…"
          placeholderTextColor={C.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        <Pressable
          style={styles.filterIconBtn}
          onPress={() => setFilterVisible(true)}
          hitSlop={8}
        >
          <Text style={styles.filterIcon}>🎛</Text>
        </Pressable>
      </View>

      {/* ── Sport pills ─────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContent}
        style={styles.pillRow}
      >
        {SPORT_PILLS.map((sp) => {
          const active = activeSport === sp.key;
          return (
            <Pressable
              key={sp.key}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => { setActiveSport(sp.key); setSearch(""); }}
            >
              <Text style={styles.pillEmoji}>{sp.emoji}</Text>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{sp.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Results count + sort ────────────────────────────────────────────── */}
      {!isLoading && !error && (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsCount}>
            {displayedFacilities.length} venue{displayedFacilities.length !== 1 ? "s" : ""} found
          </Text>
          <Pressable
            style={styles.sortBtn}
            onPress={() => setFilterVisible(true)}
          >
            <Text style={styles.sortBtnText}>Sort: {SORT_LABELS[sortBy]} ▾</Text>
          </Pressable>
        </View>
      )}

      {/* ── Facility list ────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={isLoading ? ([] as Facility[]) : displayedFacilities}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => (
            <FacilityCard
              facility={item}
              saved={savedIds.has(item.id)}
              onSaveToggle={() => toggleSave(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={C.primary}
              title="Finding courts near you…"
              titleColor={C.muted}
            />
          }
          ListHeaderComponent={
            isLoading ? (
              <View>
                <FacilityCardSkeleton />
                <FacilityCardSkeleton />
                <FacilityCardSkeleton />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? null : (
              <View style={styles.emptyWrap}>
                {search.trim() || activeSport !== "All" ? (
                  <>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>No venues match your filters</Text>
                    <Pressable
                      style={styles.clearBtn}
                      onPress={() => { setSearch(""); setActiveSport("All"); }}
                    >
                      <Text style={styles.clearBtnText}>Clear Filters</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyEmoji}>🏟️</Text>
                    <Text style={styles.emptyTitle}>
                      No venues in {selectedCity.name} yet
                    </Text>
                    <Text style={styles.emptySub}>We're growing fast!</Text>
                    {selectedCity.name !== "All Cities" && (
                      <Pressable
                        style={[styles.clearBtn, { marginTop: 8 }]}
                        onPress={() => handleCitySelect(ALL_CITIES)}
                      >
                        <Text style={styles.clearBtnText}>Browse all cities</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            )
          }
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <CityPickerModal
        visible={pickerVisible}
        selectedCity={selectedCity}
        onSelect={handleCitySelect}
        onClose={() => setPickerVisible(false)}
      />
      <FilterSheet
        visible={filterVisible}
        sortBy={sortBy}
        radius={radius}
        onApply={(s, r) => { setSortBy(s); setRadius(r); }}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    color: C.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
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
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.bg,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // Location pill
  locationPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: C.surface,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  locationPin:   { fontSize: 14 },
  locationText:  { color: C.text, fontSize: 14, fontWeight: "600", maxWidth: 200 },
  locationArrow: { color: C.primary, fontSize: 11, fontWeight: "700" },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: C.bg,
    borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  searchIcon:    { fontSize: 16, marginRight: 8 },
  searchInput: {
    flex: 1, paddingVertical: 13,
    color: C.text, fontSize: 15,
  },
  filterIconBtn: {
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  filterIcon: { fontSize: 18 },

  // Sport pills
  pillRow:    { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  pillContent: { paddingHorizontal: 16, gap: 8, alignItems: "center", paddingVertical: 2 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  pillActive: { backgroundColor: C.primary },
  pillEmoji:  { fontSize: 14 },
  pillText:   { color: C.text, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: "#fff", fontWeight: "700" },

  // Results row
  resultsRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 8,
  },
  resultsCount: { color: C.muted, fontSize: 13, fontWeight: "600" },
  sortBtn:      { flexDirection: "row", alignItems: "center", gap: 4 },
  sortBtnText:  { color: C.primary, fontSize: 13, fontWeight: "700" },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4 },

  // Empty states
  emptyWrap: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32 },
  emptyEmoji:{ fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  emptySub:   { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 16 },
  clearBtn: {
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  clearBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Error
  center:    { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  errorText: { color: "#EF4444", fontSize: 15, marginBottom: 16, textAlign: "center" },
  retryBtn: {
    backgroundColor: C.primary, borderRadius: 99,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});
