import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import TimelineSelector from "../../src/components/TimelineSelector";
import DurationSelector from "../../src/components/DurationSelector";
import CourtCard from "../../src/components/CourtCard";
import { useSlots } from "../../src/hooks/useSlots";
import { useAvailableCourts, type AvailableCourt } from "../../src/hooks/useAvailableCourts";
import { useAlerts } from "../../src/hooks/useAlerts";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
};

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
    street: string;
    city: string;
    province: string;
    postalCode: string;
    lat: number | null;
    lng: number | null;
  } | null;
  amenities: Array<{ amenity: { id: string; name: string; icon?: string | null } }>;
  averageRating: number | null;
  totalReviews: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function FacilityDetailScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const router = useRouter();
  const days = getNext7Days();

  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(true);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedCourts, setSelectedCourts] = useState<AvailableCourt[]>([]);
  // courtId → true once alert has been set for that court
  const [alertedCourts, setAlertedCourts] = useState<Record<string, boolean>>({});
  const [facilityAlertSet, setFacilityAlertSet] = useState(false);
  const { createAlert } = useAlerts();

  // Recurring state
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"WEEKLY" | "BIWEEKLY">("WEEKLY");
  const [recurringWeeks, setRecurringWeeks] = useState(8);
  const [recurringPayModel, setRecurringPayModel] = useState<"PAY_PER_SESSION" | "PAY_UPFRONT">("PAY_PER_SESSION");

  const date = formatLocalDate(days[selectedDay]!);

  // Existing slots hook (used to colorize the timeline)
  const { slots, refetch: refetchSlots } = useSlots(facilityId ?? "", date);

  // Available courts for selected time + duration
  const { result: courtsResult, isLoading: courtsLoading } = useAvailableCourts(
    facilityId ?? "",
    date,
    selectedTime ?? "",
    durationMinutes
  );

  useFocusEffect(
    useCallback(() => {
      refetchSlots();
      setSelectedTime(null);
      setSelectedCourts([]);
    }, [refetchSlots])
  );

  useEffect(() => {
    // Reset court selection and alert state when time or duration changes
    setSelectedCourts([]);
    setAlertedCourts({});
    setFacilityAlertSet(false);
  }, [selectedTime, durationMinutes, date]);

  useEffect(() => {
    if (!facilityId) return;
    setFacilityLoading(true);
    fetch(`${API_URL}/facilities/${facilityId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: FacilityDetail }>;
      })
      .then((json) => setFacility(json.data))
      .catch((e) => setFacilityError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setFacilityLoading(false));
  }, [facilityId]);

  function toggleCourt(court: AvailableCourt) {
    setSelectedCourts((prev) => {
      const exists = prev.find((c) => c.id === court.id);
      return exists ? prev.filter((c) => c.id !== court.id) : [...prev, court];
    });
  }

  function getRecurringEndDate(): string {
    const d = new Date(date);
    const stepDays = recurringFrequency === "WEEKLY" ? 7 : 14;
    d.setDate(d.getDate() + stepDays * (recurringWeeks - 1));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function getDiscount(): number {
    if (recurringPayModel !== "PAY_UPFRONT") return 0;
    if (recurringWeeks >= 12) return 15;
    if (recurringWeeks >= 8) return 10;
    if (recurringWeeks >= 4) return 5;
    return 0;
  }

  async function handleCourtAlertPress(court: AvailableCourt) {
    if (!selectedTime || !facilityId) return;
    try {
      await createAlert({
        facilityId,
        courtId: court.id,
        sport: court.sport ?? null,
        date,
        startTime: selectedTime,
        endTime: courtsResult?.endTime ?? "",
        durationMinutes,
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
        facilityId,
        courtId: null,
        sport: facility?.sport ?? null,
        date,
        startTime: selectedTime,
        endTime: courtsResult?.endTime ?? "",
        durationMinutes,
      });
      setFacilityAlertSet(true);
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
    const endTime = courtsResult?.endTime ?? "";
    const court = selectedCourts[0]!;

    if (recurringEnabled) {
      const endDate = getRecurringEndDate();
      const discount = getDiscount();
      const dayOfWeek = days[selectedDay]!.getDay();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push({
        pathname: "/booking/recurring-confirm",
        params: {
          facilityId,
          facilityName: facility?.name ?? "",
          courtId: court.id,
          courtName: court.name,
          startDate: date,
          endDate,
          startTime: selectedTime,
          endTime,
          durationMinutes: String(durationMinutes),
          frequency: recurringFrequency,
          daysOfWeek: String(dayOfWeek),
          paymentModel: recurringPayModel,
          pricePerSession: String(totalPrice),
          weeks: String(recurringWeeks),
          discount: String(discount),
        },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push({
        pathname: "/booking/time-based",
        params: {
          slotIds: allSlotIds.join(","),
          facilityId,
          facilityName: facility?.name ?? "",
          facilityCity: facility?.address?.city ?? "",
          sport: facility?.sport ?? "",
          date,
          startTime: selectedTime,
          endTime,
          durationMinutes: String(durationMinutes),
          courts: JSON.stringify(courtNames),
          totalPrice: String(totalPrice),
        },
      });
    }
  }

  if (facilityLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (facilityError || !facility) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{facilityError ?? "Facility not found"}</Text>
      </View>
    );
  }

  const ratingText = facility.averageRating != null ? facility.averageRating.toFixed(1) : "New";
  const sportLabel = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : "";

  const totalSelected = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
  const canBook = selectedCourts.length > 0 && selectedTime !== null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroName}>{facility.name}</Text>
          {facility.address && (
            <Text style={styles.heroAddress}>
              {facility.address.street}, {facility.address.city}, {facility.address.province}
            </Text>
          )}
          <View style={styles.heroMeta}>
            <Pressable
              style={styles.metaChip}
              onPress={() =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (router as any).push({
                  pathname: "/review/facility/[facilityId]",
                  params: { facilityId, facilityName: facility.name },
                })
              }
            >
              <Text style={styles.metaChipText}>
                ⭐ {ratingText}
                {facility.totalReviews > 0 ? ` (${facility.totalReviews})` : ""}
              </Text>
            </Pressable>
            {sportLabel ? (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{sportLabel}</Text>
              </View>
            ) : null}
            {facility.amenities.map((link) => (
              <View key={link.amenity.id} style={styles.metaChip}>
                <Text style={styles.metaChipText}>{link.amenity.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Step 1: Date ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepNum}>1</Text></View>
          <Text style={styles.sectionTitle}>Pick a Date</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStripContent}
          style={styles.dateStrip}
        >
          {days.map((day, i) => (
            <Pressable
              key={i}
              style={[styles.dateChip, selectedDay === i && styles.dateChipActive]}
              onPress={() => { setSelectedDay(i); setSelectedTime(null); setSelectedCourts([]); }}
            >
              <Text style={[styles.dateDayText, selectedDay === i && styles.dateActiveText]}>
                {DAY_LABELS[day.getDay()]}
              </Text>
              <Text style={[styles.dateDateText, selectedDay === i && styles.dateActiveText]}>
                {day.getDate()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Step 2: Time ─────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepNum}>2</Text></View>
          <Text style={styles.sectionTitle}>Pick a Start Time</Text>
        </View>
        <View style={styles.timelineWrap}>
          <TimelineSelector
            selectedTime={selectedTime}
            durationMinutes={durationMinutes}
            slots={slots}
            onSelectTime={setSelectedTime}
            isToday={selectedDay === 0}
          />
        </View>

        {/* ── Step 3: Duration ─────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepNum}>3</Text></View>
          <Text style={styles.sectionTitle}>Choose Duration</Text>
        </View>
        <DurationSelector
          duration={durationMinutes}
          startTime={selectedTime}
          onChangeDuration={(d) => setDurationMinutes(d)}
        />

        {/* ── Recurring toggle ─────────────────────────────────────────── */}
        <View style={styles.recurringCard}>
          <View style={styles.recurringRow}>
            <Text style={styles.recurringLabel}>🔄 Make it recurring</Text>
            <Switch
              value={recurringEnabled}
              onValueChange={setRecurringEnabled}
              trackColor={{ false: "#3A3A3C", true: C.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {recurringEnabled && (
            <View style={styles.recurringOptions}>
              {/* Frequency */}
              <Text style={styles.recurringSubLabel}>Repeat every</Text>
              <View style={styles.recurringChips}>
                {(["WEEKLY", "BIWEEKLY"] as const).map((f) => (
                  <Pressable key={f} onPress={() => setRecurringFrequency(f)}
                    style={[styles.chip, recurringFrequency === f && styles.chipActive]}>
                    <Text style={[styles.chipText, recurringFrequency === f && styles.chipTextActive]}>
                      {f === "WEEKLY" ? "Weekly" : "Biweekly"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Duration */}
              <Text style={styles.recurringSubLabel}>For how long</Text>
              <View style={styles.recurringChips}>
                {[4, 8, 12].map((w) => (
                  <Pressable key={w} onPress={() => setRecurringWeeks(w)}
                    style={[styles.chip, recurringWeeks === w && styles.chipActive]}>
                    <Text style={[styles.chipText, recurringWeeks === w && styles.chipTextActive]}>
                      {w} weeks
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Payment model */}
              <Text style={styles.recurringSubLabel}>Payment</Text>
              {(["PAY_PER_SESSION", "PAY_UPFRONT"] as const).map((p) => {
                const disc = p === "PAY_UPFRONT" ? (recurringWeeks >= 12 ? 15 : recurringWeeks >= 8 ? 10 : recurringWeeks >= 4 ? 5 : 0) : 0;
                return (
                  <Pressable key={p} onPress={() => setRecurringPayModel(p)}
                    style={[styles.payModelRow, recurringPayModel === p && styles.payModelActive]}>
                    <View style={[styles.radio, recurringPayModel === p && styles.radioActive]} />
                    <View>
                      <Text style={styles.payModelLabel}>
                        {p === "PAY_PER_SESSION" ? "Pay per session" : `Pay upfront${disc > 0 ? ` (save ${disc}%) 💰` : ""}`}
                      </Text>
                      {p === "PAY_UPFRONT" && disc > 0 && (
                        <Text style={styles.payModelSub}>Commit & save {disc}%</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {/* Preview */}
              {selectedCourts.length > 0 && (() => {
                const pricePerSession = selectedCourts.reduce((s, c) => s + c.totalPriceCAD, 0);
                const sessions = recurringWeeks;
                const subtotal = pricePerSession * sessions;
                const disc = getDiscount();
                const saved = Math.round(subtotal * (disc / 100) * 100) / 100;
                const total = subtotal - saved;
                return (
                  <View style={styles.recurringPreview}>
                    <Text style={styles.previewLine}>{sessions} sessions × C${pricePerSession.toFixed(2)} = C${subtotal.toFixed(2)}</Text>
                    {saved > 0 && <Text style={styles.previewDiscount}>Upfront discount: −C${saved.toFixed(2)}</Text>}
                    <Text style={styles.previewTotal}>Total: C${total.toFixed(2)}</Text>
                  </View>
                );
              })()}
            </View>
          )}
        </View>

        {/* Pricing notice */}
        {courtsResult && selectedTime && (() => {
          const courts = courtsResult.courts.filter((c) => c.isAvailable && c.priceBreakdown?.appliedRule);
          if (courts.length === 0) return null;
          const rules = [...new Set(courts.map((c) => c.priceBreakdown!.appliedRule))];
          return (
            <View style={styles.pricingNotice}>
              <Text style={styles.pricingNoticeText}>
                ⚡ {rules.join(" · ")}
              </Text>
            </View>
          );
        })()}

        {/* ── Step 4: Courts ───────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepNum}>4</Text></View>
          <Text style={styles.sectionTitle}>Select Courts</Text>
        </View>

        {!selectedTime ? (
          <Text style={styles.placeholderText}>Select a time above to see available courts</Text>
        ) : courtsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={C.primary} />
            <Text style={styles.loadingText}>Checking availability…</Text>
          </View>
        ) : !courtsResult || courtsResult.courts.length === 0 ? (
          <Text style={styles.placeholderText}>No courts configured for this facility</Text>
        ) : (
          <>
            {/* All-booked banner */}
            {courtsResult.courts.every((c) => !c.isAvailable) && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertBannerTitle}>All courts are booked for this time</Text>
                <Text style={styles.alertBannerSub}>
                  Get notified the moment a court becomes available
                </Text>
                <Pressable
                  style={[styles.alertBannerBtn, facilityAlertSet && styles.alertBannerBtnSet]}
                  onPress={facilityAlertSet ? undefined : handleFacilityAlertPress}
                >
                  <Text style={[styles.alertBannerBtnText, facilityAlertSet && styles.alertBannerBtnTextSet]}>
                    {facilityAlertSet ? "✓ Alert Set" : "🔔 Set Availability Alert"}
                  </Text>
                </Pressable>
              </View>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.courtsRow}
            >
              {courtsResult.courts.map((court) => (
                <CourtCard
                  key={court.id}
                  court={court}
                  isSelected={selectedCourts.some((c) => c.id === court.id)}
                  onPress={() => court.isAvailable && toggleCourt(court)}
                  alertSet={!!alertedCourts[court.id]}
                  onAlertPress={() => handleCourtAlertPress(court)}
                />
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: canBook ? 120 : 48 }} />
      </ScrollView>

      {/* Sticky CTA */}
      {canBook && (
        <View style={styles.cta}>
          <View style={styles.ctaInfo}>
            <Text style={styles.ctaSlot}>
              {selectedCourts.length} court{selectedCourts.length !== 1 ? "s" : ""} ·{" "}
              {selectedTime} – {courtsResult?.endTime ?? ""}
            </Text>
            <Text style={styles.ctaPrice}>C${totalSelected.toFixed(2)}</Text>
          </View>
          <Pressable style={styles.bookBtn} onPress={handleBook}>
            <Text style={styles.bookBtnText}>
              {recurringEnabled
                ? `🔄 Subscribe ${recurringWeeks}wks → C${(totalSelected * recurringWeeks * (1 - getDiscount() / 100)).toFixed(2)}`
                : `Book ${selectedCourts.length} Court${selectedCourts.length !== 1 ? "s" : ""} → C$${totalSelected.toFixed(2)}`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
  hero: { backgroundColor: C.surface, padding: 20 },
  heroName: { color: C.text, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  heroAddress: { color: C.muted, fontSize: 14, marginBottom: 10 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: { backgroundColor: "#2C2C2E", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 },
  metaChipText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { color: C.text, fontSize: 12, fontWeight: "800" },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: "700" },
  dateStrip: { flexGrow: 0 },
  dateStripContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  dateChip: { width: 56, paddingVertical: 12, borderRadius: 14, backgroundColor: C.surface, alignItems: "center" },
  dateChipActive: { backgroundColor: C.primary },
  dateDayText: { color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  dateDateText: { color: C.text, fontSize: 17, fontWeight: "700" },
  dateActiveText: { color: C.text },
  timelineWrap: { paddingVertical: 4 },
  courtsRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  placeholderText: { color: C.muted, fontSize: 14, paddingHorizontal: 16, paddingVertical: 12 },
  loadingText: { color: C.muted, fontSize: 13, marginTop: 8 },
  errorText: { color: "#ff6b6b", fontSize: 15 },
  recurringCard: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#1C1C1E", borderRadius: 14, padding: 14 },
  recurringRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  recurringLabel: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  recurringOptions: { marginTop: 16, gap: 12 },
  recurringSubLabel: { color: "#6B6B6B", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  recurringChips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#3A3A3C", backgroundColor: "#2C2C2E" },
  chipActive: { borderColor: "#E85068", backgroundColor: "#E8506820" },
  chipText: { color: "#6B6B6B", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#E85068" },
  payModelRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#3A3A3C" },
  payModelActive: { borderColor: "#E85068", backgroundColor: "#E8506810" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#6B6B6B" },
  radioActive: { borderColor: "#E85068", backgroundColor: "#E85068" },
  payModelLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  payModelSub: { color: "#6B6B6B", fontSize: 11, marginTop: 1 },
  recurringPreview: { backgroundColor: "#000000", borderRadius: 10, padding: 12, marginTop: 4 },
  previewLine: { color: "#6B6B6B", fontSize: 13 },
  previewDiscount: { color: "#22c55e", fontSize: 13, marginTop: 2 },
  previewTotal: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginTop: 4 },
  alertBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8506840",
    alignItems: "center",
    gap: 6,
  },
  alertBannerTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", textAlign: "center" },
  alertBannerSub: { color: "#6B6B6B", fontSize: 12, textAlign: "center", marginBottom: 4 },
  alertBannerBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#E85068",
    alignItems: "center",
  },
  alertBannerBtnSet: { backgroundColor: "#14532d" },
  alertBannerBtnText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  alertBannerBtnTextSet: { color: "#4ade80" },
  pricingNotice: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#78350f22",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#78350f88",
  },
  pricingNoticeText: { color: "#fcd34d", fontSize: 12, fontWeight: "600" },
  cta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2C2C2E",
  },
  ctaInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  ctaSlot: { color: C.text, fontSize: 14, fontWeight: "600" },
  ctaPrice: { color: C.primary, fontSize: 14, fontWeight: "700" },
  bookBtn: { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  bookBtnText: { color: C.text, fontSize: 16, fontWeight: "700" },
});
