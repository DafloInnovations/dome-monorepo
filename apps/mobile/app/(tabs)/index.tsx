import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import AppHeader from "../../src/components/layout/AppHeader";
import { useAuth } from "../../src/context/AuthContext";
import { useMyProfile } from "../../src/hooks/useMyProfile";
import { useMyBookings, type MyBooking } from "../../src/hooks/useMyBookings";
import { useAuthToken } from "../../src/hooks/useAuthToken";
import { useFacilities, type Facility } from "../../src/hooks/useFacilities";
import type { OpenGame } from "../../src/hooks/useConnect";
import { COLORS } from "../../src/theme";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";
const CITY_STORAGE_KEY = "dome_selected_city_v2";

interface City { name: string; province: string; lat?: number; lng?: number }
const ALL_CITIES: City = { name: "All Cities", province: "" };
const TORONTO: City    = { name: "Toronto", province: "ON", lat: 43.6532, lng: -79.3832 };

const CITIES: City[] = [
  { name: "Toronto",     province: "ON", lat: 43.6532, lng: -79.3832  },
  { name: "Montreal",    province: "QC", lat: 45.5017, lng: -73.5673  },
  { name: "Vancouver",   province: "BC", lat: 49.2827, lng: -123.1207 },
  { name: "Calgary",     province: "AB", lat: 51.0447, lng: -114.0719 },
  { name: "Edmonton",    province: "AB", lat: 53.5461, lng: -113.4938 },
  { name: "Ottawa",      province: "ON", lat: 45.4215, lng: -75.6972  },
  { name: "Winnipeg",    province: "MB", lat: 49.8951, lng: -97.1384  },
  { name: "Halifax",     province: "NS", lat: 44.6488, lng: -63.5752  },
  { name: "Saskatoon",   province: "SK", lat: 52.1332, lng: -106.6700 },
];

const SPORT_CARDS = [
  { key: "BADMINTON",   emoji: "🏸", label: "Badminton",   accent: "#4CAF50", bg: "#F1F8F1" },
  { key: "PICKLEBALL",  emoji: "🏓", label: "Pickleball",  accent: "#FF9800", bg: "#FFF8F0" },
  { key: "TENNIS",      emoji: "🎾", label: "Tennis",      accent: "#FFC107", bg: "#FFFDF0" },
  { key: "BASKETBALL",  emoji: "🏀", label: "Basketball",  accent: "#FF5722", bg: "#FFF3F0" },
  { key: "SOCCER",      emoji: "⚽", label: "Soccer",      accent: "#2196F3", bg: "#F0F5FF" },
  { key: "VOLLEYBALL",  emoji: "🏐", label: "Volleyball",  accent: "#FF9800", bg: "#FFF8F0" },
  { key: "HOCKEY",      emoji: "🏒", label: "Hockey",      accent: "#2196F3", bg: "#F0F5FF" },
];

const TIER_COLOR: Record<string, string> = {
  BEGINNER: COLORS.textMuted,
  ROOKIE:   COLORS.success,
  AMATEUR:  "#3B82F6",
  PRO:      "#A855F7",
  ELITE:    COLORS.warning,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning! 👋";
  if (h < 18) return "Good afternoon! 👋";
  return "Good evening! 👋";
}

function todayPlus(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function fmtDayLabel(d: Date, offset: number): string {
  if (offset === 0) return "Today";
  return d.toLocaleDateString("en-CA", { weekday: "short", day: "numeric" });
}

function fmtSlotDate(dateStr: string): string {
  const parts = dateStr.split("T")[0]!.split("-").map(Number) as [number, number, number];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hr = h! % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽", basketball: "🏀", tennis: "🎾", badminton: "🏸",
  volleyball: "🏐", hockey: "🏒", squash: "🎾", pickleball: "🏓",
  baseball: "⚾", cricket: "🏏",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, onSeeAll }: { label: string; onSeeAll?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionLabel}>{label}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={s.seeAll}>See all →</Text>
        </Pressable>
      )}
    </View>
  );
}

function SportCard({ sport, onPress }: { sport: typeof SPORT_CARDS[number]; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.sportCard, { backgroundColor: sport.bg, borderColor: sport.accent + "44" }]}
    >
      <Text style={s.sportCardEmoji}>{sport.emoji}</Text>
      <Text style={[s.sportCardLabel, { color: sport.accent }]}>{sport.label}</Text>
    </Pressable>
  );
}

function GameMiniCard({ game, onJoin }: { game: OpenGame; onJoin: () => void }) {
  const emoji = SPORT_EMOJI[game.sport.toLowerCase()] ?? "🏟";
  const spotsLeft = game.spotsLeft ?? 0;

  return (
    <View style={s.gameCard}>
      <Text style={s.gameCardEmoji}>{emoji}</Text>
      <Text style={s.gameCardSport}>{game.sport.charAt(0) + game.sport.slice(1).toLowerCase()}</Text>
      <Text style={s.gameCardFacility} numberOfLines={1}>{game.facility.name}</Text>
      {game.gameDate ? (
        <Text style={s.gameCardTime}>
          {fmtSlotDate(game.gameDate)}{game.startTime ? ` · ${fmtTime(game.startTime)}` : ""}
        </Text>
      ) : null}
      <Text style={s.gameCardSpots}>{spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left</Text>
      <Pressable style={s.joinBtn} onPress={onJoin}>
        <Text style={s.joinBtnText}>Join Game</Text>
      </Pressable>
    </View>
  );
}

function NextBookingCard({ booking }: { booking: MyBooking }) {
  const router = useRouter();
  const emoji = SPORT_EMOJI[booking.facility.sport.toLowerCase()] ?? "🏟";
  const dateStr = fmtSlotDate(booking.slot.date);
  const courtName = booking.slot.court?.name;

  return (
    <View style={s.nextBookingCard}>
      <View style={s.nextBookingLeft}>
        <Text style={s.nextBookingEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.nextBookingSport}>
            {booking.facility.sport.charAt(0) + booking.facility.sport.slice(1).toLowerCase()}
            {courtName ? ` · ${courtName}` : ""}
          </Text>
          <Text style={s.nextBookingFacility} numberOfLines={1}>{booking.facility.name}</Text>
          <Text style={s.nextBookingTime}>
            {dateStr} · {fmtTime(booking.slot.startTime)} – {fmtTime(booking.slot.endTime)}
          </Text>
        </View>
      </View>
      <Pressable
        style={s.viewBtn}
        onPress={() => router.push("/(tabs)/bookings")}
      >
        <Text style={s.viewBtnText}>View</Text>
      </Pressable>
    </View>
  );
}

function ConnectExplainerCard({ onCreateGame, onBrowse }: { onCreateGame: () => void; onBrowse: () => void }) {
  return (
    <View style={s.connectCard}>
      <View style={s.connectEmojiRow}>
        {["🏸", "🎾", "🏀", "⚽", "🏓"].map((e, i) => (
          <Text key={i} style={[s.connectEmoji, i > 0 && { marginLeft: -6 }]}>{e}</Text>
        ))}
      </View>

      <Text style={s.connectTitle}>FIND YOUR PLAYMATES 🤝</Text>
      <Text style={s.connectSubtitle}>Can't fill your court? Post a game.</Text>

      <View style={s.connectFeatures}>
        {[
          "Post your sport & time",
          "Set skill level required",
          "Players request to join",
          "You approve who plays",
        ].map((f) => (
          <View key={f} style={s.connectFeatureRow}>
            <Text style={s.connectCheck}>✓</Text>
            <Text style={s.connectFeatureText}>{f}</Text>
          </View>
        ))}
      </View>

      <View style={s.connectStats}>
        <View style={s.connectStatItem}>
          <Text style={s.connectStatValue}>127</Text>
          <Text style={s.connectStatLabel}>{"GAMES\nPOSTED"}</Text>
        </View>
        <View style={s.connectStatDivider} />
        <View style={s.connectStatItem}>
          <Text style={s.connectStatValue}>89%</Text>
          <Text style={s.connectStatLabel}>{"FILL\nRATE"}</Text>
        </View>
        <View style={s.connectStatDivider} />
        <View style={s.connectStatItem}>
          <Text style={s.connectStatValue}>4.8⭐</Text>
          <Text style={s.connectStatLabel}>{"AVG\nRATING"}</Text>
        </View>
      </View>

      <Pressable style={s.connectPrimary} onPress={onCreateGame}>
        <Text style={s.connectPrimaryText}>🤝  CREATE A GAME</Text>
      </Pressable>
      <Pressable style={s.connectSecondary} onPress={onBrowse}>
        <Text style={s.connectSecondaryText}>Browse Open Games</Text>
      </Pressable>
    </View>
  );
}

function FeaturedVenueCard({ facility, onPress }: { facility: Facility; onPress: () => void }) {
  const imageUri = facility.images?.[0];
  const sportEmoji = SPORT_EMOJI[facility.sport.toLowerCase()] ?? "🏟";

  return (
    <Pressable onPress={onPress} style={s.featuredCard}>
      {imageUri
        ? <Image source={{ uri: imageUri }} style={s.featuredImage} resizeMode="cover" />
        : (
          <View style={[s.featuredImage, s.featuredPlaceholder]}>
            <Text style={s.featuredPlaceholderEmoji}>{sportEmoji}</Text>
          </View>
        )
      }
      <View style={s.featuredInfo}>
        <Text style={s.featuredName} numberOfLines={1}>{facility.name}</Text>
        <Text style={s.featuredMeta}>
          ⭐ {facility.averageRating?.toFixed(1) ?? "New"}
          {"  "}
          <Text style={s.featuredPrice}>From C$25</Text>
        </Text>
      </View>
    </Pressable>
  );
}

// ─── City picker modal ────────────────────────────────────────────────────────

function CityPickerModal({
  visible, selectedCity, onSelect, onClose,
}: {
  visible: boolean; selectedCity: City; onSelect: (c: City) => void; onClose: () => void;
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
      let minDist = Infinity;
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
      <View style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>Select City</Text>
          <Pressable onPress={onClose} hitSlop={12}><Text style={modal.done}>Done</Text></Pressable>
        </View>
        <TextInput
          style={modal.search} placeholder="Search cities…"
          placeholderTextColor={COLORS.textMuted}
          value={query} onChangeText={setQuery}
          autoFocus clearButtonMode="while-editing"
        />
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.name}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 48 }}
          ListHeaderComponent={
            <Pressable style={modal.gpsRow} onPress={handleGps} disabled={locating}>
              {locating
                ? <ActivityIndicator color={COLORS.primary} size="small" style={modal.gpsIcon} />
                : <Text style={modal.gpsIcon}>📍</Text>}
              <Text style={modal.gpsText}>Use my current location</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const active = item.name === selectedCity.name;
            return (
              <Pressable style={[modal.cityRow, active && modal.cityRowActive]} onPress={() => onSelect(item)}>
                <View>
                  <Text style={modal.cityName}>{item.name}</Text>
                  <Text style={modal.cityProv}>{item.province}</Text>
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useMyProfile();
  const { bookings } = useMyBookings();
  const { getValidToken } = useAuthToken();

  const [selectedCity, setSelectedCity] = useState<City>(ALL_CITIES);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);

  const [openGames, setOpenGames] = useState<OpenGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  const dates = [0, 1, 2, 3].map(todayPlus);

  // Restore city
  useEffect(() => {
    AsyncStorage.getItem(CITY_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as City;
        const match = saved.name === ALL_CITIES.name
          ? ALL_CITIES
          : CITIES.find((c) => c.name === saved.name);
        if (match) setSelectedCity(match);
      } catch { /* ignore */ }
    });
  }, []);

  // Fetch open games
  const fetchGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const token = await getValidToken();
      const res = await fetch(`${API_URL}/connect/games?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json() as { data?: OpenGame[] };
        setOpenGames((json.data ?? []).slice(0, 5));
      }
    } catch { /* non-fatal */ }
    finally { setGamesLoading(false); }
  }, [getValidToken]);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  // Featured venues
  const { facilities: featured } = useFacilities({
    lat: selectedCity.lat,
    lng: selectedCity.lng,
    radius: selectedCity.lat != null ? 10 : undefined,
  });
  const featuredSlice = featured.slice(0, 6);

  // Next upcoming booking
  const now = new Date();
  const nextBooking: MyBooking | null = bookings
    .filter((b) => {
      const dateStr = b.slot.date.split("T")[0]!;
      const end = new Date(`${dateStr}T${b.slot.endTime}:00`);
      return end >= now && b.status === "CONFIRMED";
    })
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date))[0] ?? null;

  // Tier info
  const stats   = profile?.stats;
  const tier    = stats?.tier;
  const tierName = typeof tier === "string" ? tier : (tier as { name?: string } | undefined)?.name?.toUpperCase() ?? "BEGINNER";
  const tierColor = TIER_COLOR[tierName] ?? COLORS.textMuted;
  const totalPoints = stats?.totalPoints ?? 0;
  const TIER_RANGES: Record<string, [number, number]> = {
    BEGINNER: [0, 99], ROOKIE: [100, 299], AMATEUR: [300, 699], PRO: [700, 1499], ELITE: [1500, 9999],
  };
  const [tierMin, tierMax] = TIER_RANGES[tierName] ?? [0, 100];
  const tierProgress = Math.min(1, (totalPoints - tierMin) / Math.max(1, tierMax - tierMin));
  const NEXT_TIER: Record<string, string> = {
    BEGINNER: "Rookie", ROOKIE: "Amateur", AMATEUR: "Pro", PRO: "Elite",
  };

  async function handleCitySelect(city: City) {
    setSelectedCity(city);
    setPickerVisible(false);
    await AsyncStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city));
  }

  function handleSportTap(sportKey: string) {
    router.navigate({ pathname: "/(tabs)/venues", params: { sport: sportKey } } as Parameters<typeof router.navigate>[0]);
  }

  function handleBrowseVenues() {
    router.navigate("/(tabs)/venues" as Parameters<typeof router.navigate>[0]);
  }

  function handleSeeGames() {
    router.navigate("/(tabs)/connect" as Parameters<typeof router.navigate>[0]);
  }

  const cityLabel = selectedCity.name === ALL_CITIES.name
    ? "All Cities"
    : `${selectedCity.name}, ${selectedCity.province}`;

  return (
    <View style={s.screen}>
      {/* ── Shared app header ── */}
      <AppHeader
        showLocation
        city={cityLabel}
        onCityPress={() => setPickerVisible(true)}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.content, { paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Hero greeting ── */}
        <View style={s.hero}>
          <Text style={s.heroGreeting}>{greeting()}</Text>
          <Text style={s.heroTitle}>READY TO{"\n"}PLAY TODAY?</Text>
        </View>

        {/* ── Section 2: Sport selector ── */}
        <SectionHeader label="WHAT ARE YOU PLAYING?" />
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.sportRow}
          style={{ marginBottom: 28 }}
        >
          {SPORT_CARDS.map((sp) => (
            <SportCard key={sp.key} sport={sp} onPress={() => handleSportTap(sp.key)} />
          ))}
        </ScrollView>

        {/* ── Section 3: Connect explainer ── */}
        <ConnectExplainerCard
          onCreateGame={() => router.push("/connect/post-game")}
          onBrowse={handleSeeGames}
        />

        {/* ── Section 4: Quick book by date ── */}
        <SectionHeader label="BOOK FOR TODAY" onSeeAll={handleBrowseVenues} />
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateRow}
          style={{ marginBottom: 28 }}
        >
          {dates.map((d, i) => (
            <Pressable
              key={i}
              style={[s.dateChip, selectedDateIdx === i && s.dateChipActive]}
              onPress={() => {
                setSelectedDateIdx(i);
                handleBrowseVenues();
              }}
            >
              <Text style={[s.dateChipText, selectedDateIdx === i && s.dateChipTextActive]}>
                {fmtDayLabel(d, i)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Section 5: Open games ── */}
        <SectionHeader label="OPEN GAMES NEAR YOU" onSeeAll={handleSeeGames} />
        {gamesLoading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginBottom: 28, alignSelf: "flex-start", marginLeft: 20 }} />
        ) : openGames.length > 0 ? (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.gamesRow}
            style={{ marginBottom: 28 }}
          >
            {openGames.map((g) => (
              <GameMiniCard
                key={g.id}
                game={g}
                onJoin={() => router.push(`/connect/game/${g.id}`)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={[s.emptyCard, { marginBottom: 28 }]}>
            <Text style={s.emptyCardEmoji}>🏸</Text>
            <Text style={s.emptyCardText}>No open games nearby yet.</Text>
            <Text style={s.emptyCardText}>Be the first to post one!</Text>
            <Pressable
              style={s.postGameBtn}
              onPress={() => router.push("/connect/post-game")}
            >
              <Text style={s.postGameBtnText}>+ Post a Game</Text>
            </Pressable>
          </View>
        )}

        {/* ── Section 6: Next booking ── */}
        {user && (
          <>
            <SectionHeader label="YOUR NEXT GAME" onSeeAll={() => router.navigate("/(tabs)/bookings" as Parameters<typeof router.navigate>[0])} />
            {nextBooking ? (
              <NextBookingCard booking={nextBooking} />
            ) : (
              <View style={[s.emptyCard, { marginBottom: 28 }]}>
                <Text style={s.emptyCardEmoji}>📅</Text>
                <Text style={s.emptyCardText}>No upcoming bookings</Text>
                <Pressable onPress={handleBrowseVenues}>
                  <Text style={s.emptyCardLink}>Browse courts →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── Section 7: Featured venues ── */}
        {featuredSlice.length > 0 && (
          <>
            <SectionHeader
              label={`TOP VENUES IN ${selectedCity.name.toUpperCase()}`}
              onSeeAll={handleBrowseVenues}
            />
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.featuredRow}
              style={{ marginBottom: 28 }}
            >
              {featuredSlice.map((f) => (
                <FeaturedVenueCard
                  key={f.id}
                  facility={f}
                  onPress={() => router.push(`/facility/${f.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Section 8: Dome Points ── */}
        {user && profile && (
          <>
            <SectionHeader label="YOUR DOME POINTS" />
            <Pressable
              style={s.pointsCard}
              onPress={() => router.navigate("/(tabs)/profile" as Parameters<typeof router.navigate>[0])}
            >
              <View style={s.pointsTop}>
                <Text style={s.pointsIcon}>⭐</Text>
                <View>
                  <Text style={s.pointsValue}>{totalPoints} pts</Text>
                  <Text style={[s.pointsTier, { color: tierColor }]}>{tierName}</Text>
                </View>
                <Text style={s.pointsArrow}>›</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${Math.round(tierProgress * 100)}%`, backgroundColor: tierColor }]} />
              </View>
              {NEXT_TIER[tierName] && (
                <Text style={s.pointsNext}>
                  {tierMax - totalPoints > 0
                    ? `${tierMax - totalPoints} pts to ${NEXT_TIER[tierName]}`
                    : `Level up to ${NEXT_TIER[tierName]}!`}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>

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

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 40 },

  // Hero
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  heroGreeting: { color: COLORS.textMuted, fontSize: 15, fontWeight: "600", marginBottom: 6 },
  heroTitle: {
    color: COLORS.text,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 40,
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionLabel: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  seeAll: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  // Sport cards
  sportRow: { paddingHorizontal: 20, gap: 10 },
  sportCard: {
    width: 88, paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 16, alignItems: "center", gap: 6,
    borderWidth: 1,
  },
  sportCardEmoji: { fontSize: 32 },
  sportCardLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },

  // Date chips
  dateRow: { paddingHorizontal: 20, gap: 8 },
  dateChip: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  dateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dateChipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: "700" },
  dateChipTextActive: { color: "#FFFFFF" },

  // Open game cards
  gamesRow: { paddingHorizontal: 20, gap: 12 },
  gameCard: {
    width: 180, backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: COLORS.border, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  gameCardEmoji: { fontSize: 26 },
  gameCardSport: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  gameCardFacility: { color: COLORS.textMuted, fontSize: 12 },
  gameCardTime: { color: COLORS.textMuted, fontSize: 11 },
  gameCardSpots: { color: COLORS.primary, fontSize: 12, fontWeight: "700", marginTop: 2 },
  joinBtn: {
    marginTop: 8, backgroundColor: COLORS.primary,
    borderRadius: 8, paddingVertical: 8, alignItems: "center",
  },
  joinBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  // Empty states
  emptyCard: {
    marginHorizontal: 20, marginBottom: 28,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 20, alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyCardEmoji: { fontSize: 32 },
  emptyCardText: { color: COLORS.textMuted, fontSize: 14, textAlign: "center" },
  emptyCardLink: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },

  // Next booking
  nextBookingCard: {
    marginHorizontal: 20, marginBottom: 28,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  nextBookingLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  nextBookingEmoji: { fontSize: 32 },
  nextBookingSport: { color: COLORS.text, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  nextBookingFacility: { color: COLORS.textMuted, fontSize: 13, marginBottom: 3 },
  nextBookingTime: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  viewBtn: {
    backgroundColor: COLORS.primaryLight, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  viewBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },

  // Featured venues
  featuredRow: { paddingHorizontal: 20, gap: 12 },
  featuredCard: {
    width: 180, backgroundColor: COLORS.surface, borderRadius: 16,
    overflow: "hidden", borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  featuredImage: { width: "100%", height: 120 },
  featuredPlaceholder: {
    backgroundColor: COLORS.surfaceElevated,
    alignItems: "center", justifyContent: "center",
  },
  featuredPlaceholderEmoji: { fontSize: 36, opacity: 0.4 },
  featuredInfo: { padding: 10 },
  featuredName: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 3 },
  featuredMeta: { color: COLORS.textMuted, fontSize: 11 },
  featuredPrice: { color: COLORS.primary, fontWeight: "700" },

  // Dome points
  pointsCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  pointsTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  pointsIcon: { fontSize: 28 },
  pointsValue: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  pointsTier: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  pointsArrow: { color: COLORS.textMuted, fontSize: 22, marginLeft: "auto" },
  progressTrack: {
    height: 6, backgroundColor: COLORS.border, borderRadius: 3,
    overflow: "hidden", marginBottom: 8,
  },
  progressFill: { height: 6, borderRadius: 3 },
  pointsNext: { color: COLORS.textMuted, fontSize: 12 },

  // Connect explainer card
  connectCard: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFE8EC",
    padding: 20,
    gap: 16,
    shadowColor: "#E85068",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  connectEmojiRow: { flexDirection: "row", alignItems: "center" },
  connectEmoji: { fontSize: 32 },
  connectTitle: { color: "#0A0A0A", fontSize: 20, fontWeight: "900" },
  connectSubtitle: { color: "#6B6B6B", fontSize: 14 },
  connectFeatures: { gap: 8 },
  connectFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  connectCheck: { color: COLORS.primary, fontSize: 16, fontWeight: "900", width: 20 },
  connectFeatureText: { color: "#0A0A0A", fontSize: 14, fontWeight: "500", flex: 1 },
  connectStats: {
    flexDirection: "row",
    backgroundColor: "#FFF5F7",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  connectStatItem: { flex: 1, alignItems: "center", gap: 4 },
  connectStatValue: { color: COLORS.primary, fontSize: 20, fontWeight: "900" },
  connectStatLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", textAlign: "center" },
  connectStatDivider: { width: 1, height: 32, backgroundColor: "#FFD0D8" },
  connectPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  connectPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15, letterSpacing: 0.5 },
  connectSecondary: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  connectSecondaryText: { color: COLORS.primary, fontWeight: "700", fontSize: 15 },

  // Post game button (empty state)
  postGameBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  postGameBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 20 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title: { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  done: { color: COLORS.primary, fontSize: 16, fontWeight: "600" },
  search: {
    backgroundColor: COLORS.surface, borderRadius: 12, margin: 16,
    paddingHorizontal: 14, paddingVertical: 12, color: COLORS.text, fontSize: 15,
  },
  gpsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8,
  },
  gpsIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: "center" },
  gpsText: { color: COLORS.primary, fontSize: 15, fontWeight: "600" },
  cityRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
  },
  cityRowActive: { backgroundColor: COLORS.surface },
  cityName: { color: COLORS.text, fontSize: 16, fontWeight: "600", marginBottom: 2 },
  cityProv: { color: COLORS.textMuted, fontSize: 13 },
  check: { color: COLORS.primary, fontSize: 18, fontWeight: "700" },
  sep: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
});
