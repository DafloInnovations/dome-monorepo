import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCancellation } from "../../../src/hooks/useCancellation";

const C = {
  bg: "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text: "#0A0A0A",
  muted: "#9E9E9E",
  border: "#EBEBEB",
  green: "#22C55E",
  amber: "#F59E0B",
};

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🏸", PICKLEBALL: "🏓",
  BASEBALL: "⚾", CRICKET: "🏏",
};

function formatSlotDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export default function CancelBookingScreen() {
  const router = useRouter();
  const {
    bookingId,
    facilityName,
    sport,
    slotDate,
    startTime,
    endTime,
    totalCAD,
  } = useLocalSearchParams<{
    bookingId: string;
    facilityName?: string;
    sport?: string;
    slotDate?: string;
    startTime?: string;
    endTime?: string;
    totalCAD?: string;
  }>();

  const { preview, isLoadingPreview, isCancelling, error, fetchCancelPreview, cancelBooking } =
    useCancellation();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (bookingId) fetchCancelPreview(bookingId).catch(() => {});
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sportKey = (sport ?? "").toUpperCase();
  const emoji = SPORT_EMOJI[sportKey] ?? "🏟";
  const sportLabel = sport ? sport.charAt(0) + sport.slice(1).toLowerCase() : "Sport";
  const dateLabel = slotDate ? formatSlotDate(slotDate) : "";

  const isLate = preview && !preview.withinFreeWindow;

  async function handleConfirm() {
    try {
      const result = await cancelBooking(bookingId!, reason);
      const msg =
        result.refundType === "full"
          ? `C$${result.refundedCAD?.toFixed(2)} refund initiated to your card.`
          : result.refundType === "credits"
          ? `C$${result.creditsIssuedCAD?.toFixed(2)} added to your Dome Credits wallet.`
          : "Booking cancelled.";
      Alert.alert("Booking Cancelled", msg, [
        { text: "OK", onPress: () => router.replace("/(tabs)/bookings") },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not cancel booking.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Cancel Booking?</Text>
        </View>

        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>{emoji}</Text>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryFacility} numberOfLines={1}>
              {facilityName ?? "Facility"}
            </Text>
            <Text style={styles.summarySport}>{sportLabel}</Text>
            {dateLabel ? (
              <Text style={styles.summaryTime}>
                {dateLabel}
                {startTime && endTime ? ` · ${startTime}–${endTime}` : ""}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Refund preview */}
        {isLoadingPreview ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : error && !preview ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : preview ? (
          <View style={[styles.refundCard, isLate ? styles.refundCardLate : styles.refundCardFree]}>
            {isLate ? (
              <>
                <Text style={styles.refundIcon}>⚠️</Text>
                <Text style={styles.refundHeading}>Late Cancellation</Text>
                <Text style={styles.refundSub}>
                  Only {Math.floor(preview.hoursUntilSlot)}h until your game starts.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.refundIcon}>✅</Text>
                <Text style={styles.refundHeading}>Free Cancellation</Text>
                <Text style={styles.refundSub}>
                  {Math.floor(preview.hoursUntilSlot)} hours remaining
                </Text>
              </>
            )}

            <View style={styles.refundDivider} />
            <Text style={styles.refundLabel}>You'll receive:</Text>
            <Text style={styles.refundAmount}>
              C${preview.refundAmount.toFixed(2)}
              {" "}
              {preview.refundType === "STRIPE_REFUND" ? "refund to your card" : "in Dome Credits"}
            </Text>
            {preview.refundType === "DOME_CREDITS" && (
              <Text style={styles.creditsNote}>Valid for 12 months</Text>
            )}
          </View>
        ) : null}

        {/* Reason input */}
        <Text style={styles.reasonLabel}>Reason (optional)</Text>
        <TextInput
          style={styles.reasonInput}
          value={reason}
          onChangeText={setReason}
          placeholder="Tell us why you're cancelling…"
          placeholderTextColor={C.muted}
          multiline
          maxLength={200}
        />

        {/* Actions */}
        <Pressable
          style={[styles.confirmBtn, isCancelling && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={isCancelling || isLoadingPreview}
        >
          {isCancelling ? (
            <ActivityIndicator color={C.text} />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Cancellation</Text>
          )}
        </Pressable>

        <Pressable style={styles.keepBtn} onPress={() => router.back()} disabled={isCancelling}>
          <Text style={styles.keepBtnText}>Keep My Booking</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: {
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 48,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  backBtn: { padding: 2 },
  backBtnText: { color: C.primary, fontSize: 15, fontWeight: "600" },
  title: { color: C.text, fontSize: 22, fontWeight: "800" },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryEmoji: { fontSize: 32 },
  summaryInfo: { flex: 1 },
  summaryFacility: { color: C.text, fontSize: 16, fontWeight: "700", marginBottom: 2 },
  summarySport: { color: C.muted, fontSize: 13 },
  summaryTime: { color: C.muted, fontSize: 13, marginTop: 2 },

  refundCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  refundCardFree: { backgroundColor: C.green + "18", borderWidth: 1, borderColor: C.green + "44" },
  refundCardLate: { backgroundColor: C.amber + "18", borderWidth: 1, borderColor: C.amber + "44" },
  refundIcon: { fontSize: 28, marginBottom: 8 },
  refundHeading: { color: C.text, fontSize: 17, fontWeight: "800", marginBottom: 4 },
  refundSub: { color: C.muted, fontSize: 13, marginBottom: 12 },
  refundDivider: { width: "100%", height: 1, backgroundColor: C.border, marginBottom: 12 },
  refundLabel: { color: C.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase", marginBottom: 4 },
  refundAmount: { color: C.text, fontSize: 20, fontWeight: "800" },
  creditsNote: { color: C.muted, fontSize: 12, marginTop: 4 },

  center: { paddingVertical: 24, alignItems: "center" },
  errorText: { color: "#EF4444", fontSize: 14, textAlign: "center", marginBottom: 16 },

  reasonLabel: {
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasonInput: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 24,
  },

  confirmBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  keepBtn: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  keepBtnText: { color: C.text, fontSize: 15, fontWeight: "600" },
});
