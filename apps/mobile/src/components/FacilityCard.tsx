import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Facility } from "../hooks/useFacilities";

const C = {
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  chip: "#2C2C2E",
};

interface Props {
  facility: Facility;
}

export default function FacilityCard({ facility }: Props) {
  const router = useRouter();

  const imageUri = facility.images?.length > 0 ? facility.images[0] : null;

  const ratingText = facility.averageRating
    ? facility.averageRating.toFixed(1)
    : "New";

  const distanceText =
    facility.distanceKm !== undefined
      ? `${facility.distanceKm.toFixed(1)} km`
      : "";

  const addressText = facility.address
    ? `${facility.address.street}, ${facility.address.city}, ${facility.address.province}`
    : "";

  const sportLabel = facility.sport
    ? facility.sport.charAt(0).toUpperCase() + facility.sport.slice(1).toLowerCase()
    : null;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/facility/${facility.id}`)}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {facility.name}
        </Text>
        {addressText ? (
          <Text style={styles.address} numberOfLines={1}>
            {addressText}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>⭐ {ratingText}</Text>
          {distanceText ? (
            <Text style={styles.meta}>{distanceText}</Text>
          ) : null}
          <Text style={styles.price}>From C$25</Text>
        </View>
        {sportLabel ? (
          <View style={styles.sportsRow}>
            <View style={styles.sportChip}>
              <Text style={styles.sportChipText}>{sportLabel}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  image: { width: "100%", height: 160 },
  imagePlaceholder: { width: "100%", height: 160, backgroundColor: "#2C2C2E" },
  info: { padding: 14 },
  name: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 3 },
  address: { color: C.muted, fontSize: 13, marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  meta: { color: C.muted, fontSize: 13 },
  price: { color: C.primary, fontSize: 14, fontWeight: "700", marginLeft: "auto" },
  sportsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sportChip: {
    backgroundColor: C.chip,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sportChipText: { color: C.muted, fontSize: 11, fontWeight: "600" },
});
