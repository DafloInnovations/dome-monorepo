import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  green: "#22C55E",
  chip: "#2C2C2E",
};

export default function BookingSuccessScreen() {
  const { bookingId, facilityName, date, startTime, endTime, totalCAD } =
    useLocalSearchParams<{
      bookingId: string;
      facilityName: string;
      date: string;
      startTime: string;
      endTime: string;
      totalCAD: string;
    }>();

  const router = useRouter();

  async function handleShare() {
    try {
      await Share.share({
        message: `Just booked ${facilityName ?? "a facility"} on Dome! ${
          date ? `${date} ` : ""
        }${startTime && endTime ? `${startTime}–${endTime}` : ""}. Download Dome to join my game 🏟`,
        title: "I just booked on Dome!",
      });
    } catch {
      // user dismissed share sheet
    }
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

      {/* Actions */}
      <Pressable style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share Your Game</Text>
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
    borderBottomColor: "#2C2C2E",
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
  shareBtn: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  shareBtnText: { color: C.text, fontSize: 16, fontWeight: "600" },
  homeBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 20,
  },
  homeBtnText: { color: C.text, fontSize: 16, fontWeight: "700" },
  bookingId: {
    color: "#3A3A3C",
    fontSize: 11,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
