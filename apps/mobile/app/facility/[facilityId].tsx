import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSlots, type Slot } from "../../src/hooks/useSlots";
import { useAvailableCourts, type AvailableCourt } from "../../src/hooks/useAvailableCourts";
import { useAlerts } from "../../src/hooks/useAlerts";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:       "#FFFFFF",
  primary:  "#E85068",
  softPink: "#FFF5F7",
  surface:  "#F8F8F8",
  text:     "#0A0A0A",
  muted:    "#9E9E9E",
  border:   "#F0F0F0",
  green:    "#22C55E",
  amber:    "#F59E0B",
};

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const DURATION_OPTS = [
  { label: "30m", value: 30 },
  { label: "1h",  value: 60 },
  { label: "1.5h",value: 90 },
  { label: "2h",  value: 120 },
  { label: "3h",  value: 180 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacilityDetail {
  id: string;
  name: string;
  description: string;
  sport: string;
  surface: string;
  capacity: number;
  images: string[];
  isActive: boolean;
  address: {
    street: string; city: string; province: string;
    postalCode: string; lat: number | null; lng: number | null;
  } | null;
  amenities: Array<{ amenity: { id: string; name: string; icon?: string | null } }>;
  averageRating: number | null;
  totalReviews: number;
}

type TimeState = "available" | "booked" | "past";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNext7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtHour(h: number): string {
  if (h === 12) return "12PM";
  if (h === 0)  return "12AM";
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

function fmtTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hr = h! % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + (m ?? 0) + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  const period = hh >= 12 ? "PM" : "AM";
  const hr12 = hh % 12 || 12;
  return `${hr12}:${String(mm).padStart(2, "0")} ${period}`;
}

function fmtDisplayDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

function getTimeState(hour: number, slots: Slot[], isToday: boolean): TimeState {
  if (isToday) {
    const now = new Date();
    if (hour < now.getHours() || (hour === now.getHours() && now.getMinutes() >= 30)) {
      return "past";
    }
  }
  const prefix = `${hour < 10 ? "0" : ""}${hour}:`;
  const hourSlots = slots.filter((s) => s.startTime.startsWith(prefix));
  if (hourSlots.length === 0) return "available";
  const hasAvailable = hourSlots.some(
    (s) => s.status === "AVAILABLE" || s.status === "OPEN_GAME"
  );
  return hasAvailable ? "available" : "booked";
}

// ─── Animation helpers ────────────────────────────────────────────────────────

function FadeIn({ children }: { children: React.ReactNode }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [op]);
  return <Animated.View style={{ opacity: op }}>{children}</Animated.View>;
}

function SlideUp({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1, useNativeDriver: true, tension: 60, friction: 9,
    }).start();
  }, [anim]);
  return (
    <Animated.View style={{
      opacity: anim,
      transform: [{
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
      }],
    }}>
      {children}
    </Animated.View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CourtSkeleton() {
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
  const bg = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["#F0F0F0", "#E4E4E4"] });
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Animated.View style={[sk.circle, { backgroundColor: bg }]} />
        <View style={{ flex: 1, gap: 8 }}>
          <Animated.View style={[sk.line, sk.lineLong, { backgroundColor: bg }]} />
          <Animated.View style={[sk.line, { width: "50%", backgroundColor: bg }]} />
        </View>
        <Animated.View style={[sk.line, { width: 52, backgroundColor: bg }]} />
      </View>
      <Animated.View style={[sk.line, { width: "35%", marginTop: 6, backgroundColor: bg }]} />
    </View>
  );
}
const sk = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 10,
    padding: 16, borderRadius: 14, backgroundColor: "#F8F8F8", gap: 8,
  },
  row:      { flexDirection: "row", alignItems: "center", gap: 12 },
  circle:   { width: 40, height: 40, borderRadius: 20 },
  line:     { height: 11, borderRadius: 6 },
  lineLong: { width: "70%" },
});

// ─── Inline Court Card ────────────────────────────────────────────────────────

function InlineCourtCard({
  court, isSelected, onPress, alertSet, onAlertPress,
}: {
  court: AvailableCourt;
  isSelected: boolean;
  onPress: () => void;
  alertSet: boolean;
  onAlertPress: () => void;
}) {
  const emoji = SPORT_EMOJI[court.sport?.toUpperCase() ?? ""] ?? "🏟️";
  const bd = court.priceBreakdown;
  const isPeak = bd && bd.finalPriceCAD > bd.basePriceCAD;
  const isOff  = bd && bd.finalPriceCAD < bd.basePriceCAD;
  const pctDiff = bd
    ? Math.abs(Math.round((bd.finalPriceCAD / bd.basePriceCAD - 1) * 100))
    : 0;

  return (
    <Pressable
      onPress={court.isAvailable ? onPress : undefined}
      style={[
        cc.card,
        isSelected && cc.cardSelected,
        !court.isAvailable && cc.cardUnavailable,
      ]}
    >
      {isSelected && (
        <View style={cc.check}>
          <Text style={cc.checkText}>✓</Text>
        </View>
      )}

      {/* Top row */}
      <View style={cc.topRow}>
        <Text style={cc.emoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[cc.name, !court.isAvailable && cc.nameMuted]} numberOfLines={1}>
            {court.name}
          </Text>
          {court.surface ? (
            <Text style={cc.meta}>
              {court.surface.charAt(0).toUpperCase() + court.surface.slice(1).toLowerCase()}
            </Text>
          ) : null}
        </View>
        {court.isAvailable && (
          <View style={cc.priceCol}>
            {bd && bd.basePriceCAD !== bd.finalPriceCAD && (
              <Text style={cc.basePrice}>C${bd.basePriceCAD.toFixed(2)}</Text>
            )}
            <Text style={[cc.price, isPeak && cc.pricePeak, isOff && cc.priceOff]}>
              C${court.totalPriceCAD.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Status row */}
      {court.isAvailable ? (
        <View style={cc.statusRow}>
          <Text style={cc.availText}>✓ Available</Text>
          {isPeak && (
            <View style={cc.peakBadge}>
              <Text style={cc.peakBadgeText}>⚡ Peak +{pctDiff}%</Text>
            </View>
          )}
          {isOff && (
            <View style={cc.offBadge}>
              <Text style={cc.offBadgeText}>🎉 {pctDiff}% off</Text>
            </View>
          )}
          {bd?.appliedRule ? (
            <Text style={cc.ruleText} numberOfLines={1}>{bd.appliedRule}</Text>
          ) : null}
        </View>
      ) : (
        <View style={cc.unavailCol}>
          <Text style={cc.unavailText} numberOfLines={2}>
            ✗{" "}
            {court.bookedUntil
              ? `Booked until ${court.bookedUntil}`
              : court.unavailableReason ?? "Unavailable"}
          </Text>
          <Pressable
            style={[cc.alertBtn, alertSet && cc.alertBtnSet]}
            onPress={alertSet ? undefined : onAlertPress}
          >
            <Text style={[cc.alertBtnText, alertSet && cc.alertBtnTextSet]}>
              {alertSet ? "✓ Alert Set" : "🔔 Alert me"}
            </Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const cc = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: C.bg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderColor: C.primary,
    borderLeftWidth: 4,
    backgroundColor: C.softPink,
  },
  cardUnavailable: { opacity: 0.55 },
  check: {
    position: "absolute", top: 12, right: 12,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  checkText:   { color: "#fff", fontSize: 11, fontWeight: "800" },
  topRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  emoji:       { fontSize: 32 },
  name:        { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 3 },
  nameMuted:   { color: C.muted },
  meta:        { color: C.muted, fontSize: 12 },
  priceCol:    { alignItems: "flex-end", paddingRight: 28 },
  basePrice:   { color: C.muted, fontSize: 11, textDecorationLine: "line-through" },
  price:       { color: C.primary, fontSize: 18, fontWeight: "800" },
  pricePeak:   { color: C.amber },
  priceOff:    { color: C.green },
  statusRow:   { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  availText:   { color: C.green, fontSize: 13, fontWeight: "700" },
  peakBadge:   { backgroundColor: `${C.amber}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  peakBadgeText: { color: C.amber, fontSize: 11, fontWeight: "700" },
  offBadge:    { backgroundColor: `${C.green}22`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  offBadgeText:  { color: C.green, fontSize: 11, fontWeight: "700" },
  ruleText:    { color: C.muted, fontSize: 11 },
  unavailCol:  { gap: 10 },
  unavailText: { color: C.muted, fontSize: 13, lineHeight: 18 },
  alertBtn:    {
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1.5, borderColor: C.primary,
  },
  alertBtnSet:      { borderColor: C.green, backgroundColor: `${C.green}18` },
  alertBtnText:     { color: C.primary, fontSize: 12, fontWeight: "700" },
  alertBtnTextSet:  { color: C.green },
});

// ─── Step Label ───────────────────────────────────────────────────────────────

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepDot}>
        <Text style={styles.stepNum}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FacilityDetailScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const days = getNext7Days();

  const [facility, setFacility]           = useState<FacilityDetail | null>(null);
  const [facilityLoading, setFLoading]     = useState(true);
  const [facilityError, setFError]         = useState<string | null>(null);
  const [selectedDay, setSelectedDay]      = useState(0);
  const [selectedTime, setSelectedTime]    = useState<string | null>(null);
  const [durationMinutes, setDuration]     = useState(60);
  const [selectedCourts, setSelCourts]     = useState<AvailableCourt[]>([]);
  const [alertedCourts, setAlertedCourts]  = useState<Record<string, boolean>>({});
  const [facilityAlertSet, setFAlertSet]   = useState(false);
  const [saved, setSaved]                  = useState(false);
  const { createAlert }                    = useAlerts();

  // Recurring
  const [recurringEnabled, setRecEnabled]  = useState(false);
  const [recurringFrequency, setRecFreq]   = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [recurringWeeks, setRecWeeks]      = useState(8);
  const [recurringPayModel, setRecPay]     = useState<"PAY_PER_SESSION" | "PAY_UPFRONT">("PAY_PER_SESSION");

  const date = formatLocalDate(days[selectedDay]!);

  const { slots, refetch: refetchSlots } = useSlots(facilityId ?? "", date);
  const { result: courtsResult, isLoading: courtsLoading } = useAvailableCourts(
    facilityId ?? "", date, selectedTime ?? "", durationMinutes
  );

  useFocusEffect(
    useCallback(() => {
      refetchSlots();
      setSelectedTime(null);
      setSelCourts([]);
    }, [refetchSlots])
  );

  useEffect(() => {
    setSelCourts([]);
    setAlertedCourts({});
    setFAlertSet(false);
  }, [selectedTime, durationMinutes, date]);

  useEffect(() => {
    if (!facilityId) return;
    setFLoading(true);
    fetch(`${API_URL}/facilities/${facilityId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: FacilityDetail }>;
      })
      .then((json) => setFacility(json.data))
      .catch((e) => setFError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setFLoading(false));
  }, [facilityId]);

  function toggleCourt(court: AvailableCourt) {
    setSelCourts((prev) => {
      const exists = prev.find((c) => c.id === court.id);
      return exists ? prev.filter((c) => c.id !== court.id) : [...prev, court];
    });
  }

  function getRecurringEndDate(): string {
    const d = new Date(date);
    const step = recurringFrequency === "WEEKLY" ? 7 : 14;
    d.setDate(d.getDate() + step * (recurringWeeks - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getDiscount(): number {
    if (recurringPayModel !== "PAY_UPFRONT") return 0;
    if (recurringWeeks >= 12) return 15;
    if (recurringWeeks >= 8)  return 10;
    if (recurringWeeks >= 4)  return 5;
    return 0;
  }

  async function handleCourtAlertPress(court: AvailableCourt) {
    if (!selectedTime || !facilityId) return;
    try {
      await createAlert({
        facilityId, courtId: court.id, sport: court.sport ?? null,
        date, startTime: selectedTime,
        endTime: courtsResult?.endTime ?? "", durationMinutes,
      });
      setAlertedCourts((prev) => ({ ...prev, [court.id]: true }));
      Alert.alert("Alert Set!", "We'll notify you when this court opens up.", [{ text: "OK" }]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to set alert");
    }
  }

  async function handleFacilityAlertPress() {
    if (!selectedTime || !facilityId) return;
    try {
      await createAlert({
        facilityId, courtId: null, sport: facility?.sport ?? null,
        date, startTime: selectedTime,
        endTime: courtsResult?.endTime ?? "", durationMinutes,
      });
      setFAlertSet(true);
      Alert.alert("Alert Set!", "We'll notify you when any court opens up.", [{ text: "OK" }]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to set alert");
    }
  }

  function handleBook() {
    if (!selectedCourts.length || !selectedTime || !facilityId) return;
    const allSlotIds = selectedCourts.flatMap((c) => c.slots);
    const courtNames = selectedCourts.map((c) => c.name);
    const totalPrice = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
    const endTime    = courtsResult?.endTime ?? "";
    const court      = selectedCourts[0]!;

    if (recurringEnabled) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push({
        pathname: "/booking/recurring-confirm",
        params: {
          facilityId, facilityName: facility?.name ?? "",
          courtId: court.id, courtName: court.name,
          startDate: date, endDate: getRecurringEndDate(),
          startTime: selectedTime, endTime,
          durationMinutes: String(durationMinutes),
          frequency: recurringFrequency,
          daysOfWeek: String(days[selectedDay]!.getDay()),
          paymentModel: recurringPayModel,
          pricePerSession: String(totalPrice),
          weeks: String(recurringWeeks),
          discount: String(getDiscount()),
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push({
        pathname: "/booking/time-based",
        params: {
          slotIds: allSlotIds.join(","),
          facilityId, facilityName: facility?.name ?? "",
          facilityCity: facility?.address?.city ?? "",
          sport: facility?.sport ?? "",
          date, startTime: selectedTime, endTime,
          durationMinutes: String(durationMinutes),
          courts: JSON.stringify(courtNames),
          totalPrice: String(totalPrice),
        },
      });
    }
  }

  // ── Loading / error ──────────────────────────────────────────────────────────

  if (facilityLoading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (facilityError || !facility) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>{facilityError ?? "Facility not found"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────────

  const sportEmoji = SPORT_EMOJI[facility.sport?.toUpperCase() ?? ""] ?? "🏟️";
  const sportLabel = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : "";
  const ratingText = facility.averageRating != null
    ? facility.averageRating.toFixed(1) : "New";

  const totalSelected = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
  const canBook       = selectedCourts.length > 0 && selectedTime !== null;

  const allBooked = !!(courtsResult && courtsResult.courts.length > 0 &&
    courtsResult.courts.every((c) => !c.isAvailable));

  // CTA display info
  const ctaDate    = fmtDisplayDate(days[selectedDay]!);
  const ctaEndTime = courtsResult?.endTime
    ? fmtTime12(courtsResult.endTime)
    : addMins(selectedTime ?? "00:00", durationMinutes);

  // ── Recurring preview price ──────────────────────────────────────────────────
  const recSessions = recurringWeeks;
  const recSubtotal = totalSelected * recSessions;
  const recDisc     = getDiscount();
  const recSaved    = Math.round(recSubtotal * (recDisc / 100) * 100) / 100;
  const recTotal    = recSubtotal - recSaved;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.screen, { paddingTop: insets.top }]}>

        {/* ── Sticky Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBack} hitSlop={10}>
            <Text style={styles.headerBackText}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{facility.name}</Text>
            {facility.address ? (
              <Text style={styles.headerSub} numberOfLines={1}>
                {facility.address.street}, {facility.address.city}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => setSaved((s) => !s)} style={styles.headerHeart} hitSlop={10}>
            <Text style={styles.headerHeartText}>{saved ? "♥" : "♡"}</Text>
          </Pressable>
        </View>

        {/* ── Meta bar ──────────────────────────────────────────────────────── */}
        <View style={styles.metaBar}>
          <Text style={styles.metaText}>
            {sportEmoji} {sportLabel}{"  ·  "}⭐ {ratingText}
            {facility.totalReviews > 0 ? ` (${facility.totalReviews})` : ""}
          </Text>
          {facility.amenities.length > 0 ? (
            <Text style={styles.metaText}>
              {"  ·  "}{facility.amenities.slice(0, 3).map((a) => a.amenity.name).join(" · ")}
            </Text>
          ) : null}
        </View>

        {/* ── Scrollable content ────────────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
        >

          {/* ── STEP 1: Date strip ──────────────────────────────────────────── */}
          <View style={styles.section}>
            <StepLabel n={1} text="SELECT DATE" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateStripContent}
            >
              {days.map((day, i) => {
                const active = selectedDay === i;
                return (
                  <Pressable
                    key={i}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => {
                      setSelectedDay(i);
                      setSelectedTime(null);
                      setSelCourts([]);
                    }}
                  >
                    <Text style={[styles.dateDayText, active && styles.dateDayTextActive]}>
                      {DAY_LABELS[day.getDay()]}
                    </Text>
                    <Text style={[styles.dateDateText, active && styles.dateDateTextActive]}>
                      {day.getDate()}
                    </Text>
                    {i === 0 ? (
                      <Text style={[styles.dateTodayLabel, active && styles.dateTodayLabelActive]}>
                        TODAY
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.divider} />

          {/* ── STEP 2: Time grid ───────────────────────────────────────────── */}
          <FadeIn key={selectedDay}>
            <View style={styles.section}>
              <StepLabel n={2} text="SELECT START TIME" />
              <View style={styles.timeGrid}>
                {HOURS.map((h) => {
                  const time  = `${h < 10 ? "0" : ""}${h}:00`;
                  const state = getTimeState(h, slots, selectedDay === 0);
                  const isSel = selectedTime === time;
                  return (
                    <Pressable
                      key={h}
                      style={[
                        styles.timePill,
                        isSel       && styles.timePillSelected,
                        state === "booked" && styles.timePillBooked,
                        state === "past"   && styles.timePillPast,
                      ]}
                      onPress={() => {
                        if (state !== "past" && state !== "booked") {
                          setSelectedTime(isSel ? null : time);
                        }
                      }}
                      disabled={state === "past" || state === "booked"}
                    >
                      <Text style={[
                        styles.timePillText,
                        isSel       && styles.timePillTextSelected,
                        state === "booked" && styles.timePillTextBooked,
                        state === "past"   && styles.timePillTextPast,
                      ]}>
                        {fmtHour(h)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {slots.length === 0 && !courtsLoading && (
                <View style={styles.noSlotsMsg}>
                  <Text style={styles.noSlotsMsgEmoji}>😴</Text>
                  <Text style={styles.noSlotsMsgText}>
                    No configured slots on {fmtDisplayDate(days[selectedDay]!)}
                  </Text>
                  <Text style={styles.noSlotsMsgSub}>
                    Pick a time to check court availability anyway
                  </Text>
                </View>
              )}
            </View>
          </FadeIn>

          {/* ── STEPS 3+: Progressive disclosure after time selected ─────────── */}
          {selectedTime && (
            <SlideUp key="post-time">

              <View style={styles.divider} />

              {/* ── STEP 3: Duration pills ──────────────────────────────────── */}
              <View style={styles.section}>
                <StepLabel n={3} text="HOW LONG?" />
                <View style={styles.durationRow}>
                  {DURATION_OPTS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[
                        styles.durationPill,
                        durationMinutes === opt.value && styles.durationPillActive,
                      ]}
                      onPress={() => setDuration(opt.value)}
                    >
                      <Text style={[
                        styles.durationPillText,
                        durationMinutes === opt.value && styles.durationPillTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.timeRangeText}>
                  {fmtTime12(selectedTime)} → {ctaEndTime}
                </Text>
              </View>

              <View style={styles.divider} />

              {/* ── Recurring toggle ────────────────────────────────────────── */}
              <View style={styles.section}>
                <View style={styles.recurringCard}>
                  <View style={styles.recurringRow}>
                    <Text style={styles.recurringTitle}>🔄 Make it a weekly recurring booking</Text>
                    <Switch
                      value={recurringEnabled}
                      onValueChange={setRecEnabled}
                      trackColor={{ false: "#EBEBEB", true: C.primary }}
                      thumbColor="#fff"
                    />
                  </View>

                  {recurringEnabled && (
                    <View style={styles.recurringBody}>
                      <View style={styles.dividerThin} />

                      <Text style={styles.recurringSubLabel}>REPEAT</Text>
                      <View style={styles.recChips}>
                        {(["WEEKLY", "BIWEEKLY"] as const).map((f) => (
                          <Pressable
                            key={f}
                            style={[styles.recChip, recurringFrequency === f && styles.recChipActive]}
                            onPress={() => setRecFreq(f)}
                          >
                            <Text style={[styles.recChipText, recurringFrequency === f && styles.recChipTextActive]}>
                              {f === "WEEKLY" ? "Every week" : "Every 2 weeks"}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.recurringSubLabel}>FOR</Text>
                      <View style={styles.recChips}>
                        {[4, 8, 12].map((w) => (
                          <Pressable
                            key={w}
                            style={[styles.recChip, recurringWeeks === w && styles.recChipActive]}
                            onPress={() => setRecWeeks(w)}
                          >
                            <Text style={[styles.recChipText, recurringWeeks === w && styles.recChipTextActive]}>
                              {w} wks
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      <Text style={styles.recurringSubLabel}>PAYMENT</Text>
                      {(["PAY_PER_SESSION", "PAY_UPFRONT"] as const).map((p) => {
                        const disc = p === "PAY_UPFRONT"
                          ? (recurringWeeks >= 12 ? 15 : recurringWeeks >= 8 ? 10 : 5)
                          : 0;
                        return (
                          <Pressable
                            key={p}
                            style={[styles.payRow, recurringPayModel === p && styles.payRowActive]}
                            onPress={() => setRecPay(p)}
                          >
                            <View style={[styles.radio, recurringPayModel === p && styles.radioActive]} />
                            <View>
                              <Text style={styles.payLabel}>
                                {p === "PAY_PER_SESSION"
                                  ? "Pay per session"
                                  : `Pay upfront${disc > 0 ? ` — save ${disc}%` : ""}`}
                              </Text>
                              {p === "PAY_UPFRONT" && disc > 0 && (
                                <Text style={styles.paySub}>Commit & save {disc}%</Text>
                              )}
                            </View>
                          </Pressable>
                        );
                      })}

                      {selectedCourts.length > 0 && (
                        <View style={styles.recPreview}>
                          <Text style={styles.recPreviewLine}>
                            {recSessions} sessions × C${totalSelected.toFixed(2)} = C${recSubtotal.toFixed(2)}
                          </Text>
                          {recSaved > 0 && (
                            <Text style={styles.recPreviewDiscount}>
                              Upfront discount — C${recSaved.toFixed(2)}
                            </Text>
                          )}
                          <Text style={styles.recPreviewTotal}>
                            Total: C${recTotal.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              {/* ── STEP 4: Courts ──────────────────────────────────────────── */}
              <View style={styles.section}>
                <StepLabel n={4} text="SELECT COURT" />
                {selectedCourts.length > 1 && (
                  <Text style={styles.multiCourtNote}>
                    {selectedCourts.length} courts selected — tap to deselect
                  </Text>
                )}
                {courtsLoading ? (
                  <>
                    <CourtSkeleton />
                    <CourtSkeleton />
                  </>
                ) : !courtsResult || courtsResult.courts.length === 0 ? (
                  <View style={styles.emptyCourts}>
                    <Text style={styles.emptyEmoji}>🔒</Text>
                    <Text style={styles.emptyTitle}>No courts configured</Text>
                    <Text style={styles.emptySub}>This facility has no courts set up for this window.</Text>
                  </View>
                ) : (
                  <>
                    {allBooked && (
                      <View style={styles.allBookedBanner}>
                        <Text style={styles.allBookedTitle}>🔒 All courts are booked</Text>
                        <Text style={styles.allBookedSub}>
                          Get notified the moment a court opens up
                        </Text>
                        <Pressable
                          style={[styles.allBookedBtn, facilityAlertSet && styles.allBookedBtnSet]}
                          onPress={facilityAlertSet ? undefined : handleFacilityAlertPress}
                        >
                          <Text style={[styles.allBookedBtnText, facilityAlertSet && styles.allBookedBtnTextSet]}>
                            {facilityAlertSet ? "✓ Alert Set" : "🔔 Alert me when available"}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => setSelectedTime(null)}>
                          <Text style={styles.tryDiffTime}>Try a different time</Text>
                        </Pressable>
                      </View>
                    )}
                    {courtsResult.courts.map((court) => (
                      <InlineCourtCard
                        key={court.id}
                        court={court}
                        isSelected={selectedCourts.some((c) => c.id === court.id)}
                        onPress={() => court.isAvailable && toggleCourt(court)}
                        alertSet={!!alertedCourts[court.id]}
                        onAlertPress={() => handleCourtAlertPress(court)}
                      />
                    ))}
                  </>
                )}
              </View>

            </SlideUp>
          )}

        </ScrollView>

        {/* ── Sticky Bottom CTA ─────────────────────────────────────────────── */}
        <View style={[styles.cta, { paddingBottom: insets.bottom + 12 }]}>
          {!selectedTime ? (
            <>
              <Text style={styles.ctaHint}>Select a date and time to continue</Text>
              <View style={[styles.ctaBtn, styles.ctaBtnDisabled]}>
                <Text style={styles.ctaBtnTextDisabled}>Browse Courts</Text>
              </View>
            </>
          ) : !canBook ? (
            <>
              <Text style={styles.ctaSummary}>
                {ctaDate}{"  "}·{"  "}
                {fmtTime12(selectedTime)} – {ctaEndTime}
              </Text>
              <Text style={styles.ctaHint}>Select a court below ↓</Text>
              <View style={[styles.ctaBtn, styles.ctaBtnDisabled]}>
                <Text style={styles.ctaBtnTextDisabled}>Choose Court</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.ctaInfoRow}>
                <Text style={styles.ctaSummary}>
                  {selectedCourts.length} Court{selectedCourts.length !== 1 ? "s" : ""}
                  {"  "}·{"  "}{ctaDate}{"  "}·{"  "}
                  {fmtTime12(selectedTime)} – {ctaEndTime}
                </Text>
                <Text style={styles.ctaPrice}>
                  C${totalSelected.toFixed(2)}
                  {recurringEnabled ? ` ×${recurringWeeks}` : " + tax"}
                </Text>
              </View>
              <Pressable style={styles.ctaBtn} onPress={handleBook}>
                <Text style={styles.ctaBtnText}>
                  {recurringEnabled
                    ? `🔄 SUBSCRIBE ${recurringWeeks} WKS — C$${recTotal.toFixed(2)}`
                    : `CONFIRM & PAY  C$${totalSelected.toFixed(2)}`}
                </Text>
              </Pressable>
            </>
          )}
        </View>

      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { alignItems: "center", justifyContent: "center" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  headerBack: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
    marginRight: 4,
  },
  headerBackText: { color: C.text, fontSize: 22, fontWeight: "400" },
  headerCenter:   { flex: 1 },
  headerTitle:    { color: C.text, fontSize: 18, fontWeight: "700" },
  headerSub:      { color: C.muted, fontSize: 12, marginTop: 1 },
  headerHeart: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
    marginLeft: 4,
  },
  headerHeartText: { color: C.primary, fontSize: 22 },

  // Meta bar
  metaBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 4,
  },
  metaText: { color: C.muted, fontSize: 13, fontWeight: "600" },

  // Section
  section:  { paddingVertical: 20 },
  divider:  { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  dividerThin: { height: 1, backgroundColor: C.border, marginVertical: 14 },

  // Step label
  stepRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, marginBottom: 16,
  },
  stepDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
  },
  stepNum:  { color: "#fff", fontSize: 11, fontWeight: "900" },
  stepText: { color: C.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase" },

  // Date strip
  dateStripContent: { paddingHorizontal: 16, gap: 10 },
  dateChip: {
    width: 60, paddingVertical: 12, borderRadius: 14,
    backgroundColor: "#F5F5F5", alignItems: "center", gap: 2,
  },
  dateChipActive:         { backgroundColor: C.primary },
  dateDayText:            { color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  dateDayTextActive:      { color: "rgba(255,255,255,0.8)" },
  dateDateText:           { color: C.text, fontSize: 18, fontWeight: "800" },
  dateDateTextActive:     { color: "#fff" },
  dateTodayLabel:         { color: C.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  dateTodayLabelActive:   { color: "rgba(255,255,255,0.7)" },

  // Time grid
  timeGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: 8,
  },
  timePill: {
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1,
    borderColor: "#E8E8E8", backgroundColor: C.bg,
  },
  timePillSelected: { backgroundColor: C.primary, borderColor: C.primary },
  timePillBooked:   { backgroundColor: "#F5F5F5", borderColor: "#F0F0F0" },
  timePillPast:     { backgroundColor: "#F5F5F5", borderColor: "#F0F0F0", opacity: 0.3 },
  timePillText:     { color: C.text, fontSize: 14, fontWeight: "600" },
  timePillTextSelected: { color: "#fff", fontWeight: "700" },
  timePillTextBooked:   { color: "#CCCCCC", textDecorationLine: "line-through" },
  timePillTextPast:     { color: "#CCCCCC" },

  // No slots message
  noSlotsMsg: {
    alignItems: "center", paddingVertical: 20, gap: 6, paddingHorizontal: 16,
  },
  noSlotsMsgEmoji: { fontSize: 32 },
  noSlotsMsgText:  { color: C.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  noSlotsMsgSub:   { color: C.muted, fontSize: 13, textAlign: "center" },

  // Duration pills
  durationRow: {
    flexDirection: "row", gap: 8, paddingHorizontal: 16,
  },
  durationPill: {
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 12, backgroundColor: "#F5F5F5",
  },
  durationPillActive: { backgroundColor: C.primary },
  durationPillText:   { color: C.text, fontSize: 14, fontWeight: "600" },
  durationPillTextActive: { color: "#fff", fontWeight: "700" },
  timeRangeText: {
    color: C.muted, fontSize: 13, textAlign: "center",
    marginTop: 14, fontWeight: "600",
  },

  // Recurring
  recurringCard: {
    marginHorizontal: 16, backgroundColor: "#F8F8F8",
    borderRadius: 16, padding: 16,
  },
  recurringRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recurringTitle: { color: C.text, fontSize: 15, fontWeight: "600", flex: 1, marginRight: 12 },
  recurringBody: { gap: 12 },
  recurringSubLabel: {
    color: C.muted, fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase",
  },
  recChips:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: "#EBEBEB",
    backgroundColor: "#EBEBEB",
  },
  recChipActive: { borderColor: C.primary, backgroundColor: `${C.primary}20` },
  recChipText:   { color: C.muted, fontSize: 13, fontWeight: "600" },
  recChipTextActive: { color: C.primary, fontWeight: "700" },
  payRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#EBEBEB",
    backgroundColor: C.bg,
  },
  payRowActive: { borderColor: C.primary, backgroundColor: `${C.primary}10` },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: "#9E9E9E",
  },
  radioActive:  { borderColor: C.primary, backgroundColor: C.primary },
  payLabel:     { color: C.text, fontSize: 14, fontWeight: "600" },
  paySub:       { color: C.muted, fontSize: 11, marginTop: 2 },
  recPreview: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 12, gap: 4,
  },
  recPreviewLine:     { color: C.muted, fontSize: 13 },
  recPreviewDiscount: { color: C.green, fontSize: 13 },
  recPreviewTotal:    { color: C.text, fontSize: 16, fontWeight: "800" },

  // All booked banner
  allBookedBanner: {
    marginHorizontal: 16, marginBottom: 16,
    padding: 18, borderRadius: 14,
    backgroundColor: "#FFF5F7",
    borderWidth: 1, borderColor: `${C.primary}40`,
    alignItems: "center", gap: 8,
  },
  allBookedTitle:     { color: C.text, fontSize: 16, fontWeight: "700" },
  allBookedSub:       { color: C.muted, fontSize: 13, textAlign: "center" },
  allBookedBtn: {
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 12, backgroundColor: C.primary,
  },
  allBookedBtnSet:     { backgroundColor: "#14532d" },
  allBookedBtnText:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  allBookedBtnTextSet: { color: "#4ade80" },
  tryDiffTime:         { color: C.primary, fontSize: 13, fontWeight: "600", marginTop: 4 },

  // Empty courts
  emptyCourts:  { alignItems: "center", paddingVertical: 24, paddingHorizontal: 16, gap: 8 },
  emptyEmoji:   { fontSize: 36 },
  emptyTitle:   { color: C.text, fontSize: 16, fontWeight: "700" },
  emptySub:     { color: C.muted, fontSize: 13, textAlign: "center" },

  // Multi-court note
  multiCourtNote: {
    color: C.primary, fontSize: 13, fontWeight: "600",
    paddingHorizontal: 16, marginBottom: 8,
  },

  // Sticky CTA
  cta: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg,
    paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  ctaInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ctaSummary: { color: C.text, fontSize: 13, fontWeight: "600", flex: 1 },
  ctaHint:    { color: C.muted, fontSize: 13, textAlign: "center" },
  ctaPrice:   { color: C.primary, fontSize: 16, fontWeight: "800" },
  ctaBtn: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: "center",
  },
  ctaBtnDisabled: { backgroundColor: "#E0E0E0" },
  ctaBtnText:     { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  ctaBtnTextDisabled: { color: "#9E9E9E", fontSize: 15, fontWeight: "600" },

  // Error / back
  errorText:     { color: "#EF4444", fontSize: 15, marginBottom: 16 },
  backLink:      { paddingHorizontal: 20, paddingVertical: 10 },
  backLinkText:  { color: C.primary, fontSize: 15, fontWeight: "700" },
});
