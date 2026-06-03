import { useState } from "react";
import {
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
import { useReviews } from "../../src/hooks/useReviews";

const C = {
  bg: "#000000",
  surface: "#1C1C1E",
  primary: "#E85068",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  border: "#2C2C2E",
};

const STAR_LABELS = ["", "Terrible", "Poor", "OK", "Good", "Amazing"];

function StarPicker({ value, onChange, size = 36 }: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)}>
          <Text style={{ fontSize: size, color: n <= value ? "#F59E0B" : C.border }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SubRating({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.subRatingRow}>
      <Text style={styles.subRatingLabel}>{label}</Text>
      <StarPicker value={value} onChange={onChange} size={22} />
    </View>
  );
}

export default function WriteReviewScreen() {
  const { bookingId, facilityName, sport, slotDate } = useLocalSearchParams<{
    bookingId: string;
    facilityName: string;
    sport: string;
    slotDate: string;
  }>();
  const router = useRouter();
  const { createReview, loading } = useReviews();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courtQuality, setCourtQuality] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [valueForMoney, setValueForMoney] = useState(0);
  const [staffFriendly, setStaffFriendly] = useState(0);

  const sportLabel = sport
    ? sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase()
    : "";

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Rating required", "Please select a star rating before submitting.");
      return;
    }
    try {
      await createReview({
        bookingId: bookingId!,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        courtQuality: courtQuality || null,
        cleanliness: cleanliness || null,
        valueForMoney: valueForMoney || null,
        staffFriendly: staffFriendly || null,
      });
      Alert.alert(
        "Thank you! ⭐",
        "Your review helps others find great courts.",
        [{ text: "Done", onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit review");
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.facilityName} numberOfLines={2}>{facilityName}</Text>
          <Text style={styles.meta}>{sportLabel}{slotDate ? ` · ${slotDate}` : ""}</Text>
        </View>

        {/* Main star rating */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Overall Rating</Text>
          <StarPicker value={rating} onChange={setRating} size={44} />
          {rating > 0 && (
            <Text style={styles.ratingLabel}>{STAR_LABELS[rating]}</Text>
          )}
        </View>

        {/* Sub-ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Rate the Details (optional)</Text>
          <SubRating label="🎾 Court Quality" value={courtQuality} onChange={setCourtQuality} />
          <SubRating label="🧹 Cleanliness" value={cleanliness} onChange={setCleanliness} />
          <SubRating label="💰 Value" value={valueForMoney} onChange={setValueForMoney} />
          <SubRating label="😊 Staff" value={staffFriendly} onChange={setStaffFriendly} />
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Give your review a headline…"
            placeholderTextColor={C.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />
        </View>

        {/* Body */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Review (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell others about your experience…"
            placeholderTextColor={C.muted}
            value={body}
            onChangeText={setBody}
            maxLength={2000}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{body.length}/2000</Text>
        </View>

        <Pressable
          style={[styles.submitBtn, (rating === 0 || loading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || loading}
        >
          <Text style={styles.submitBtnText}>{loading ? "Submitting…" : "Submit Review"}</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20 },
  header: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 4,
  },
  facilityName: { color: C.text, fontSize: 18, fontWeight: "700" },
  meta: { color: C.muted, fontSize: 13 },
  section: { marginBottom: 24, gap: 10 },
  sectionLabel: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  ratingLabel: { color: "#F59E0B", fontSize: 16, fontWeight: "700" },
  subRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  subRatingLabel: { color: C.text, fontSize: 14, flex: 1 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
    padding: 14,
  },
  textArea: { height: 130 },
  charCount: { color: C.muted, fontSize: 11, textAlign: "right" },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: C.text, fontSize: 16, fontWeight: "700" },
});
