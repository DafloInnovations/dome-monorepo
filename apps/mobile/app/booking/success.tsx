import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

const C = {
  bg: "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text: "#0A0A0A",
  muted: "#9E9E9E",
  green: "#22C55E",
  chip: "#EBEBEB",
};

export default function BookingSuccessScreen() {
  const { bookingId, facilityName, facilityCity, sport, date, startTime, endTime, totalCAD } =
    useLocalSearchParams<{
      bookingId: string;
      facilityName: string;
      facilityCity: string;
      sport: string;
      date: string;
      startTime: string;
      endTime: string;
      totalCAD: string;
    }>();

  const router = useRouter();

  function handleShareCard() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (router as any).push({
      pathname: "/share/[bookingId]",
      params: {
        bookingId: bookingId ?? "",
        facilityName: facilityName ?? "",
        facilityCity: facilityCity ?? "",
        sport: sport ?? "",
        date: date ?? "",
        startTime: startTime ?? "",
        endTime: endTime ?? "",
      },
    });
  }

  return (
    <View style={styles.container}>
      {/* Check + heading */}
      <View style={styles.heroSection}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your court is reserved and ready to play.</Text>
      </View>

      {/* Booking details card */}
      <View style={styles.card}>
        {facilityName ? <DetailRow label="Facility" value={facilityName} /> : null}
        {date ? <DetailRow label="Date" value={date} /> : null}
        {startTime && endTime ? (
          <DetailRow label="Time" value={`${startTime} – ${endTime}`} />
        ) : null}
        {totalCAD ? (
          <DetailRow label="Total Paid" value={`C$${totalCAD}`} highlight />
        ) : null}
      </View>

      {/* Dome points badge */}
      <View style={styles.pointsBadge}>
        <Text style={styles.pointsEmoji}>⚡</Text>
        <Text style={styles.pointsText}>+100 Dome Points earned</Text>
      </View>

      {/* Share card teaser */}
      <Pressable style={styles.shareCardTeaser} onPress={handleShareCard}>
        <View style={styles.shareTeaserLeft}>
          <Text style={styles.shareTeaserEmoji}>📤</Text>
          <View>
            <Text style={styles.shareTeaserTitle}>Share your game</Text>
            <Text style={styles.shareTeaserSub}>Create a share card · Earn +50 pts</Text>
          </View>
        </View>
        <Text style={styles.shareTeaserArrow}>→</Text>
      </Pressable>

      <Pressable
        style={styles.homeBtn}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text style={styles.homeBtnText}>Back to Home</Text>
      </Pressable>

      {bookingId ? (
        <Text style={styles.bookingId} numberOfLines={1}>
          Ref: {bookingId}
        </Text>
      ) : null}
    </View>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 72 : 40,
    paddingBottom: 40,
  },
  heroSection: { alignItems: "center", marginBottom: 32 },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  checkMark: { color: "#fff", fontSize: 38, fontWeight: "700", lineHeight: 44 },
  title: {
    color: C.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: C.muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EBEBEB",
  },
  detailLabel: { color: C.muted, fontSize: 14 },
  detailValue: { color: C.text, fontSize: 14, fontWeight: "600" },
  detailValueHighlight: { color: C.primary, fontSize: 15, fontWeight: "700" },
  pointsBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1A00",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 28,
  },
  pointsEmoji: { fontSize: 18 },
  pointsText: { color: "#F59E0B", fontSize: 14, fontWeight: "700" },
  shareCardTeaser: {
    backgroundColor: "#0f0f1a",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3A3A5C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shareTeaserLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  shareTeaserEmoji: { fontSize: 26 },
  shareTeaserTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  shareTeaserSub: { color: "#a78bfa", fontSize: 12, marginTop: 2 },
  shareTeaserArrow: { color: "#a78bfa", fontSize: 18, fontWeight: "700" },
  homeBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  homeBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  bookingId: {
    color: "#EBEBEB",
    fontSize: 11,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
