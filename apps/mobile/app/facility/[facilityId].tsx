import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import SlotGrid from "../../src/components/SlotGrid";
import { useSlots, type Slot } from "../../src/hooks/useSlots";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
};

// Matches GET /api/v1/facilities/:id response shape
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
  amenities: Array<{
    amenity: { id: string; name: string; icon?: string | null };
  }>;
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

// Use local-time getters so a user at, say, 11 pm EST doesn't get
// tomorrow's UTC date instead of today's local date.
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAddress(addr: FacilityDetail["address"]): string {
  if (!addr) return "";
  return `${addr.street}, ${addr.city}, ${addr.province}`;
}

export default function FacilityDetailScreen() {
  const { facilityId } = useLocalSearchParams<{ facilityId: string }>();
  const router = useRouter();
  const days = getNext7Days();

  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(true);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const date = formatLocalDate(days[selectedDay]!);
  const {
    slots,
    isLoading: slotsLoading,
    error: slotsError,
    refetch: refetchSlots,
  } = useSlots(facilityId ?? "", date);

  // Refetch slots whenever this screen comes back into focus (e.g. user presses
  // Back from the booking screen — the slot they started booking will be HELD).
  useFocusEffect(
    useCallback(() => {
      refetchSlots();
      // Clear any selected slot so the CTA doesn't linger for a now-held slot.
      setSelectedSlot(null);
    }, [refetchSlots])
  );

  useEffect(() => {
    if (!facilityId) return;
    setFacilityLoading(true);
    fetch(`${API_URL}/facilities/${facilityId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ data: FacilityDetail }>;
      })
      .then((json) => setFacility(json.data))
      .catch((e) =>
        setFacilityError(e instanceof Error ? e.message : "Failed to load facility")
      )
      .finally(() => setFacilityLoading(false));
  }, [facilityId]);

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

  const ratingText = facility.averageRating != null
    ? facility.averageRating.toFixed(1)
    : "New";

  const addressText = formatAddress(facility.address);

  const sportLabel = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : null;

  const amenityList = facility.amenities ?? [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroName}>{facility.name}</Text>
        {addressText ? (
          <Text style={styles.heroAddress}>{addressText}</Text>
        ) : null}
        {facility.description ? (
          <Text style={styles.heroDesc}>{facility.description}</Text>
        ) : null}
        <View style={styles.heroMeta}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>⭐ {ratingText}</Text>
          </View>
          {facility.capacity != null ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {facility.capacity.toString()} cap
              </Text>
            </View>
          ) : null}
          {sportLabel ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{sportLabel}</Text>
            </View>
          ) : null}
          {amenityList.map((link) => (
            <View key={link.amenity.id} style={styles.metaChip}>
              <Text style={styles.metaChipText}>{link.amenity.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Date strip */}
      <Text style={styles.sectionTitle}>Select Date</Text>
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
            onPress={() => {
              setSelectedDay(i);
              setSelectedSlot(null);
            }}
          >
            <Text
              style={[
                styles.dateDayText,
                selectedDay === i && styles.dateActiveText,
              ]}
            >
              {DAY_LABELS[day.getDay()]}
            </Text>
            <Text
              style={[
                styles.dateDateText,
                selectedDay === i && styles.dateActiveText,
              ]}
            >
              {day.getDate()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Slot grid */}
      <Text style={styles.sectionTitle}>Available Slots</Text>
      {slotsLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} />
        </View>
      ) : slotsError ? (
        <Text style={styles.inlineError}>{slotsError}</Text>
      ) : (
        <SlotGrid
          slots={slots}
          selectedSlotId={selectedSlot?.id}
          onSelect={(slot) => setSelectedSlot(slot)}
        />
      )}

      {/* Book CTA — only show when the selected slot is still AVAILABLE */}
      {selectedSlot?.status === "AVAILABLE" ? (
        <View style={styles.cta}>
          <View style={styles.ctaInfo}>
            <Text style={styles.ctaSlot}>
              {selectedSlot.startTime} – {selectedSlot.endTime}
            </Text>
            <Text style={styles.ctaPrice}>
              C${selectedSlot.priceCAD?.toFixed(2) ?? "0.00"}
            </Text>
          </View>
          <Pressable
            style={styles.bookBtn}
            onPress={() =>
              router.push({
                pathname: "/booking/[slotId]",
                params: {
                  slotId: selectedSlot.id,
                  facilityId: facilityId ?? "",
                  startTime: selectedSlot.startTime,
                  endTime: selectedSlot.endTime,
                  priceCAD: String(selectedSlot.priceCAD ?? 0),
                  facilityName: facility.name,
                  date,
                },
              })
            }
          >
            <Text style={styles.bookBtnText}>Book This Slot</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  hero: { backgroundColor: C.surface, padding: 20 },
  heroName: { color: C.text, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  heroAddress: { color: C.muted, fontSize: 14, marginBottom: 10 },
  heroDesc: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  heroMeta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    backgroundColor: "#2C2C2E",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  metaChipText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  dateStrip: { flexGrow: 0 },
  dateStripContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  dateChip: {
    width: 56,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.surface,
    alignItems: "center",
  },
  dateChipActive: { backgroundColor: C.primary },
  dateDayText: { color: C.muted, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  dateDateText: { color: C.text, fontSize: 17, fontWeight: "700" },
  dateActiveText: { color: C.text },
  errorText: { color: "#ff6b6b", fontSize: 15 },
  inlineError: { color: "#ff6b6b", fontSize: 14, paddingHorizontal: 16 },
  cta: {
    backgroundColor: C.surface,
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  ctaInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  ctaSlot: { color: C.text, fontSize: 15, fontWeight: "600" },
  ctaPrice: { color: C.primary, fontSize: 15, fontWeight: "700" },
  bookBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  bookBtnText: { color: C.text, fontSize: 16, fontWeight: "700" },
});
