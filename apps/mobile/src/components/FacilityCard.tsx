import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../theme";
import type { Facility } from "../hooks/useFacilities";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

interface Props {
  facility: Facility;
}

export default function FacilityCard({ facility }: Props) {
  const router = useRouter();

  const imageUri = facility.images?.length > 0 ? facility.images[0] : null;
  const hasReviews = (facility.totalReviews ?? 0) > 0;
  const ratingText = facility.averageRating ? facility.averageRating.toFixed(1) : null;
  const distanceText = facility.distanceKm !== undefined
    ? `${facility.distanceKm.toFixed(1)} km`
    : null;
  const addressText = facility.address
    ? `${facility.address.city}, ${facility.address.province}`
    : null;

  const sportRaw = (facility.sport ?? "").toUpperCase();
  const sportEmoji = SPORT_EMOJI[sportRaw] ?? "🏟";
  const sportLabel = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : null;
  const sportColors = COLORS.sports[sportRaw as keyof typeof COLORS.sports];

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/facility/${facility.id}`)}
    >
      {/* ── Image / placeholder ── */}
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderEmoji}>{sportEmoji}</Text>
            <Text style={styles.placeholderText}>No photos yet</Text>
          </View>
        )}

        {/* Sport badge — top left */}
        {sportLabel && (
          <View style={[
            styles.sportBadge,
            sportColors && { borderColor: sportColors.accent + "55", backgroundColor: sportColors.bg },
          ]}>
            <Text style={styles.sportBadgeEmoji}>{sportEmoji}</Text>
            <Text style={[
              styles.sportBadgeText,
              sportColors && { color: sportColors.accent },
            ]}>
              {sportLabel}
            </Text>
          </View>
        )}

        {/* New badge — top right */}
        {!hasReviews && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>New</Text>
          </View>
        )}
      </View>

      {/* ── Info ── */}
      <View style={styles.info}>
        {/* Name + rating */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{facility.name}</Text>
          {ratingText && (
            <View style={styles.ratingPill}>
              <Text style={styles.ratingText}>⭐ {ratingText}</Text>
              {hasReviews && (
                <Text style={styles.reviewCount}> ({facility.totalReviews})</Text>
              )}
            </View>
          )}
        </View>

        {/* Location */}
        {addressText && (
          <Text style={styles.address} numberOfLines={1}>{addressText}</Text>
        )}

        {/* Distance + price */}
        <View style={styles.bottomRow}>
          {distanceText ? (
            <View style={styles.distancePill}>
              <Text style={styles.distanceText}>📍 {distanceText}</Text>
            </View>
          ) : <View />}
          <Text style={styles.price}>From C$25</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 18,
    overflow: "hidden",
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    // Android
    elevation: 4,
  },

  // ── Image ──
  imageWrap: {
    width: "100%",
    height: 210,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F4F4F4",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  placeholderEmoji: { fontSize: 48, opacity: 0.35 },
  placeholderText: { color: COLORS.textMuted, fontSize: 13 },

  // ── Overlay badges ──
  sportBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.92)",
    // micro shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
  },
  sportBadgeEmoji: { fontSize: 13 },
  sportBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  newBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: COLORS.primary,
  },
  newBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  // ── Info ──
  info: {
    padding: 14,
    gap: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    flex: 1,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  ratingText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  reviewCount: { color: COLORS.textMuted, fontSize: 12 },
  address: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  distancePill: {
    backgroundColor: COLORS.surface,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "600" },
  price: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
});
