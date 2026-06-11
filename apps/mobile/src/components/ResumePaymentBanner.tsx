import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../theme";

export interface PendingBookingInfo {
  bookingId: string;
  facilityName: string;
  sport: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCAD: number;
  paymentIntentId: string | null;
}

interface Props {
  booking: PendingBookingInfo;
  onResume: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m!).padStart(2, "0")} ${period}`;
}

export default function ResumePaymentBanner({ booking, onResume, onDismiss, isLoading }: Props) {
  const sportLabel = booking.sport
    ? booking.sport.charAt(0).toUpperCase() + booking.sport.slice(1).toLowerCase()
    : "";

  return (
    <View style={styles.wrapper}>
      <View style={styles.leftStripe} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.icon}>⚡</Text>
          <View style={styles.info}>
            <Text style={styles.title}>Incomplete booking</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {sportLabel} · {booking.facilityName}
            </Text>
            <Text style={styles.detail}>
              {booking.date} · {fmt12(booking.startTime)}–{fmt12(booking.endTime)} · C${booking.totalCAD.toFixed(2)}
            </Text>
          </View>
          <Pressable onPress={onDismiss} style={styles.closeBtn} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.resumeBtn, isLoading && styles.resumeBtnDisabled]}
          onPress={onResume}
          disabled={isLoading}
        >
          <Text style={styles.resumeText}>
            {isLoading ? "Resuming…" : "Resume Payment →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  leftStripe: {
    width: 4,
    backgroundColor: "#F59E0B",
  },
  body: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  icon: { fontSize: 22, lineHeight: 26 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  subtitle: { fontSize: 13, color: "#78350F", marginTop: 1 },
  detail: { fontSize: 12, color: "#A16207", marginTop: 2 },
  closeBtn: { paddingLeft: 8 },
  closeText: { fontSize: 14, color: COLORS.textMuted },
  resumeBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  resumeBtnDisabled: { opacity: 0.55 },
  resumeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
