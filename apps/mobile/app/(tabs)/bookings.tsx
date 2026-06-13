import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMyBookings, type MyBooking } from "../../src/hooks/useMyBookings";
import { useMyProfile } from "../../src/hooks/useMyProfile";
import { useThreads } from "../../src/hooks/useChat";
import { useNotificationsContext } from "../../src/context/NotificationsContext";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:      "#FFFFFF",
  primary: "#E85068",
  surface: "#F8F8F8",
  text:    "#0A0A0A",
  muted:   "#9E9E9E",
  border:  "#F0F0F0",
  green:   "#22C55E",
  amber:   "#F59E0B",
};

const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽", basketball: "🏀", tennis: "🎾", badminton: "🏸",
  volleyball: "🏐", hockey: "🏒", squash: "🏸", pickleball: "🏓",
  baseball: "⚾", cricket: "🏏",
};

const SPORT_BG: Record<string, string> = {
  badminton: "#1a6e3a", pickleball: "#A0522D", tennis: "#A07814",
  basketball: "#CC3300", soccer: "#1565C0", volleyball: "#2E7D50",
  hockey: "#0d5299", cricket: "#7B2FBE",
};

const SPORT_ACCENT: Record<string, string> = {
  badminton: "#4CAF50", pickleball: "#FF9800", tennis: "#FFC107",
  basketball: "#FF5722", soccer: "#2196F3", volleyball: "#FF9800",
  hockey: "#2196F3", cricket: "#9C27B0",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function fmtDateShort(dateStr: string): string {
  if (dateStr === todayLocalStr())  return "Today";
  if (dateStr === tomorrowStr())    return "Tomorrow";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hr = h! % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function fmtDuration(minutes: number): string {
  if (minutes < 60)    return `${minutes} min`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function computeCountdownLabel(dateStr: string, startTime: string): string | null {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const [h, min] = startTime.split(":").map(Number) as [number, number];
  const target = new Date(y, m - 1, d, h, min);
  const diff = target.getTime() - Date.now();
  if (diff < 0 || diff > 24 * 3600 * 1000) return null;
  if (diff < 60_000) return "🎮 YOUR GAME IS STARTING NOW!";
  if (diff < 2 * 3600 * 1000) {
    const mins = Math.floor(diff / 60_000);
    return `⚡ YOUR GAME STARTS IN  ${mins} MIN`;
  }
  const hours = Math.floor(diff / (3600 * 1000));
  const mins  = Math.floor((diff % (3600 * 1000)) / 60_000);
  return `⚡ YOUR GAME STARTS IN  ${hours}H ${mins}M`;
}

function cancelDeadline(dateStr: string, startTime: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const [h, min] = startTime.split(":").map(Number) as [number, number];
  const deadline = new Date(y, m - 1, d, h, min);
  deadline.setHours(deadline.getHours() - 24);
  return deadline.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
    + ", " + fmtTime(`${deadline.getHours()}:${String(deadline.getMinutes()).padStart(2, "0")}`);
}

function isWithinFreeCancelWindow(dateStr: string, startTime: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const [h, min] = startTime.split(":").map(Number) as [number, number];
  const slotStart = new Date(y, m - 1, d, h, min);
  const deadline  = new Date(slotStart.getTime() - 24 * 3600 * 1000);
  return Date.now() < deadline.getTime();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BookingSkeleton() {
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
      <Animated.View style={[sk.hero, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <View style={sk.row}>
          <Animated.View style={[sk.line, { width: "55%", backgroundColor: bg }]} />
          <Animated.View style={[sk.pill, { backgroundColor: bg }]} />
        </View>
        <Animated.View style={[sk.line, { width: "75%", backgroundColor: bg, marginTop: 6 }]} />
        <Animated.View style={[sk.line, { width: "40%", backgroundColor: bg, marginTop: 6 }]} />
        <Animated.View style={[sk.detailBox, { backgroundColor: bg, marginTop: 12 }]} />
      </View>
    </View>
  );
}
const sk = StyleSheet.create({
  card:      { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", marginBottom: 16 },
  hero:      { height: 100 },
  body:      { padding: 16, gap: 0 },
  row:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  line:      { height: 12, borderRadius: 6 },
  pill:      { width: 80, height: 22, borderRadius: 11 },
  detailBox: { height: 72, borderRadius: 12 },
});

// ─── Countdown banner ─────────────────────────────────────────────────────────

function CountdownBanner({ dateStr, startTime }: { dateStr: string; startTime: string }) {
  const [label, setLabel] = useState(() => computeCountdownLabel(dateStr, startTime));
  useEffect(() => {
    const timer = setInterval(
      () => setLabel(computeCountdownLabel(dateStr, startTime)),
      60_000
    );
    return () => clearInterval(timer);
  }, [dateStr, startTime]);
  if (!label) return null;
  return (
    <View style={cd.banner}>
      <Text style={cd.text}>{label}</Text>
    </View>
  );
}
const cd = StyleSheet.create({
  banner: {
    backgroundColor: C.primary, paddingVertical: 10, paddingHorizontal: 16,
  },
  text: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.3, textAlign: "center" },
});

// ─── Upcoming booking card ────────────────────────────────────────────────────

function UpcomingCard({
  booking, onCancel,
}: {
  booking: MyBooking;
  onCancel: () => void;
}) {
  const router  = useRouter();
  const sport   = booking.facility.sport.toLowerCase();
  const emoji   = SPORT_EMOJI[sport] ?? "🏟";
  const heroBg  = SPORT_BG[sport] ?? "#2d0a0f";
  const dateStr = booking.slot.date.split("T")[0]!;
  const freeCancel = isWithinFreeCancelWindow(dateStr, booking.slot.startTime);
  const addr = booking.facility.address;

  function openDirections() {
    if (!addr) return;
    const q = encodeURIComponent(`${addr.street}, ${addr.city}, ${addr.province}`);
    const url = Platform.OS === "ios"
      ? `maps://maps.apple.com/?address=${q}`
      : `https://maps.google.com/?q=${q}`;
    Linking.openURL(url).catch(() => {});
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `I'm playing ${booking.facility.sport} at ${booking.facility.name} on ${fmtDateShort(dateStr)} at ${fmtTime(booking.slot.startTime)}! 🏸`,
        title: "Dome Booking",
      });
    } catch { /* ignore */ }
  }

  return (
    <View style={uc.card}>
      <CountdownBanner dateStr={dateStr} startTime={booking.slot.startTime} />

      {/* Hero */}
      <View style={[uc.hero, { backgroundColor: heroBg }]}>
        <View style={uc.confirmedBadge}>
          <Text style={uc.confirmedText}>✅ CONFIRMED</Text>
        </View>
        <Text style={uc.heroFacility} numberOfLines={1}>{booking.facility.name}</Text>
      </View>

      <View style={uc.body}>
        {/* Sport + court */}
        <Text style={uc.sportRow}>
          {emoji} {booking.facility.sport.toUpperCase()}
          {booking.slot.court ? `  ·  ${booking.slot.court.name}` : ""}
        </Text>

        {/* Facility name */}
        <Text style={uc.facilityName}>{booking.facility.name}</Text>

        {/* Address */}
        {addr ? (
          <Text style={uc.address}>{addr.street}, {addr.city}</Text>
        ) : null}

        {/* Details box */}
        <View style={uc.detailBox}>
          <View style={uc.detailRow}>
            <Text style={uc.detailIcon}>📅</Text>
            <Text style={uc.detailText}>{fmtDateLong(dateStr)}</Text>
          </View>
          <View style={uc.detailRow}>
            <Text style={uc.detailIcon}>⏰</Text>
            <Text style={uc.detailText}>
              {fmtTime(booking.slot.startTime)} — {fmtTime(booking.slot.endTime)}
            </Text>
          </View>
          <View style={[uc.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={uc.detailIcon}>⏱️</Text>
            <Text style={uc.detailText}>{fmtDuration(booking.slot.durationMinutes)}</Text>
          </View>
        </View>

        {/* Payment summary */}
        <View style={uc.paymentBox}>
          <View style={uc.payRow}>
            <Text style={uc.payLabel}>Subtotal</Text>
            <Text style={uc.payValue}>C${booking.subtotalCAD.toFixed(2)}</Text>
          </View>
          {booking.taxCAD > 0 && (
            <View style={uc.payRow}>
              <Text style={uc.payLabel}>HST</Text>
              <Text style={uc.payValue}>C${booking.taxCAD.toFixed(2)}</Text>
            </View>
          )}
          <View style={uc.divider} />
          <View style={uc.payRow}>
            <Text style={uc.payTotal}>Total</Text>
            <Text style={uc.payTotalValue}>C${booking.totalCAD.toFixed(2)}</Text>
          </View>
        </View>

        {/* Cancel policy */}
        <View style={uc.cancelPolicy}>
          <Text style={uc.cancelPolicyTitle}>CANCELLATION POLICY</Text>
          {freeCancel ? (
            <Text style={[uc.cancelPolicyText, { color: C.green }]}>
              ✓ Free cancel before {cancelDeadline(dateStr, booking.slot.startTime)}
            </Text>
          ) : (
            <Text style={[uc.cancelPolicyText, { color: C.amber }]}>
              ⚠️ Outside free cancel window — fees may apply
            </Text>
          )}
        </View>

        {/* Action row */}
        <View style={uc.actionRow}>
          <Pressable style={uc.actionBtnOutline} onPress={handleShare}>
            <Text style={uc.actionBtnOutlineText}>📤 Share</Text>
          </Pressable>
          <Pressable style={uc.actionBtnGrey} onPress={onCancel}>
            <Text style={uc.actionBtnGreyText}>❌ Cancel</Text>
          </Pressable>
        </View>

        {/* Directions */}
        {addr ? (
          <Pressable style={uc.directionsBtn} onPress={openDirections}>
            <Text style={uc.directionsBtnText}>GET DIRECTIONS</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const uc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 20, overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  hero:       { height: 110, justifyContent: "space-between", padding: 14 },
  confirmedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(34,197,94,0.9)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  confirmedText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  heroFacility:  { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "right", opacity: 0.9 },
  body:          { padding: 16, gap: 10 },
  sportRow:      { color: C.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  facilityName:  { color: C.text, fontSize: 20, fontWeight: "700" },
  address:       { color: "#6B6B6B", fontSize: 13 },
  detailBox: {
    backgroundColor: C.surface, borderRadius: 12, overflow: "hidden", marginTop: 2,
  },
  detailRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  detailIcon: { fontSize: 15, width: 20 },
  detailText: { color: C.text, fontSize: 14, fontWeight: "500" },
  paymentBox: { gap: 6, marginTop: 2 },
  payRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payLabel:   { color: C.muted, fontSize: 13 },
  payValue:   { color: C.text, fontSize: 13 },
  divider:    { height: 1, backgroundColor: C.border, marginVertical: 2 },
  payTotal:   { color: C.text, fontSize: 15, fontWeight: "700" },
  payTotalValue: { color: C.text, fontSize: 15, fontWeight: "800" },
  cancelPolicy:  { backgroundColor: "#F8F8F8", borderRadius: 10, padding: 12, gap: 4 },
  cancelPolicyTitle: {
    color: C.muted, fontSize: 10, fontWeight: "800",
    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2,
  },
  cancelPolicyText: { fontSize: 13, fontWeight: "500" },
  actionRow:   { flexDirection: "row", gap: 10 },
  actionBtnOutline: {
    flex: 1, borderWidth: 1.5, borderColor: C.primary, borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  actionBtnOutlineText: { color: C.primary, fontWeight: "700", fontSize: 13 },
  actionBtnGrey: {
    flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingVertical: 12, alignItems: "center",
  },
  actionBtnGreyText: { color: C.muted, fontWeight: "700", fontSize: 13 },
  directionsBtn: {
    backgroundColor: C.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: "center",
  },
  directionsBtnText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
});

// ─── Past booking card ────────────────────────────────────────────────────────

function PastCard({
  booking, onReview, reviewed, highlighted,
}: {
  booking: MyBooking;
  onReview?: () => void;
  reviewed: boolean;
  highlighted?: boolean;
}) {
  const sport  = booking.facility.sport.toLowerCase();
  const emoji  = SPORT_EMOJI[sport] ?? "🏟";
  const accent = SPORT_ACCENT[sport] ?? C.primary;
  const dateStr = booking.slot.date.split("T")[0]!;

  async function handleShare() {
    try {
      await Share.share({
        message: `I played ${booking.facility.sport} at ${booking.facility.name} on ${fmtDateShort(dateStr)}! 🏸`,
        title: "Dome",
      });
    } catch { /* ignore */ }
  }

  return (
    <View style={[pc.card, { borderLeftColor: accent }, highlighted && pc.cardHighlighted]}>
      {highlighted && !reviewed && (
        <View style={pc.reviewHint}>
          <Text style={pc.reviewHintText}>✨ You have a review to leave!</Text>
        </View>
      )}
      <View style={pc.topRow}>
        <View style={pc.left}>
          <Text style={pc.emoji}>{emoji}</Text>
          <View>
            <Text style={pc.name} numberOfLines={1}>{booking.facility.name}</Text>
            <Text style={pc.sub}>
              {booking.slot.court?.name ?? booking.facility.sport}
              {"  ·  "}
              {fmtDateShort(dateStr)}
            </Text>
            <Text style={pc.sub}>
              {fmtTime(booking.slot.startTime)} – {fmtTime(booking.slot.endTime)}
              {"  ·  "}
              C${booking.totalCAD.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={pc.doneBadge}>
          <Text style={pc.doneBadgeText}>✅ Done</Text>
        </View>
      </View>

      <View style={pc.btnRow}>
        {onReview ? (
          reviewed ? (
            <View style={pc.reviewedBadge}>
              <Text style={pc.reviewedText}>⭐ Reviewed</Text>
            </View>
          ) : (
            <Pressable style={pc.reviewBtn} onPress={onReview}>
              <Text style={pc.reviewBtnText}>⭐ Leave a Review</Text>
            </Pressable>
          )
        ) : null}
        <Pressable style={pc.shareBtn} onPress={handleShare}>
          <Text style={pc.shareBtnText}>📤 Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, borderLeftWidth: 4,
    padding: 14, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  topRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  left:    { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  emoji:   { fontSize: 28, marginTop: 2 },
  name:    { color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 3, maxWidth: 180 },
  sub:     { color: C.muted, fontSize: 12, marginBottom: 1 },
  doneBadge: {
    backgroundColor: "#F0FDF4", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  doneBadgeText: { color: C.green, fontSize: 11, fontWeight: "700" },
  btnRow:   { flexDirection: "row", gap: 8 },
  reviewBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.amber, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
    backgroundColor: `${C.amber}18`,
  },
  reviewBtnText: { color: C.amber, fontSize: 13, fontWeight: "700" },
  reviewedBadge: {
    flex: 1, borderWidth: 1.5, borderColor: C.green, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
    backgroundColor: `${C.green}18`,
  },
  reviewedText: { color: C.green, fontSize: 13, fontWeight: "600" },
  shareBtn: {
    paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
  },
  shareBtnText: { color: C.primary, fontSize: 13, fontWeight: "700" },
  cardHighlighted: {
    borderColor: C.amber, borderWidth: 2,
    shadowColor: C.amber, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  reviewHint: {
    backgroundColor: `${C.amber}18`, borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10,
  },
  reviewHintText: { color: C.amber, fontSize: 12, fontWeight: "700", textAlign: "center" },
});

// ─── Cancelled booking card ───────────────────────────────────────────────────

function CancelledCard({ booking }: { booking: MyBooking }) {
  const router = useRouter();
  const sport  = booking.facility.sport.toLowerCase();
  const emoji  = SPORT_EMOJI[sport] ?? "🏟";
  const dateStr = booking.slot.date.split("T")[0]!;

  return (
    <View style={canc.card}>
      <View style={canc.topRow}>
        <View style={canc.left}>
          <Text style={canc.emoji}>{emoji}</Text>
          <View>
            <Text style={canc.name} numberOfLines={1}>{booking.facility.name}</Text>
            <Text style={canc.sub}>
              {booking.slot.court?.name ?? booking.facility.sport}
              {"  ·  "}{fmtDateShort(dateStr)}
            </Text>
            <Text style={canc.sub}>
              {fmtTime(booking.slot.startTime)} – {fmtTime(booking.slot.endTime)}
            </Text>
          </View>
        </View>
        <View style={canc.badge}>
          <Text style={canc.badgeText}>❌ Cancelled</Text>
        </View>
      </View>

      {/* Refund info */}
      <View style={canc.refundBox}>
        <Text style={canc.refundLabel}>REFUND</Text>
        {booking.paymentStatus === "PAID" ? (
          <Text style={canc.refundText}>
            💳 C${booking.totalCAD.toFixed(2)} — refund may take 3–5 business days
          </Text>
        ) : (
          <Text style={canc.refundText}>No payment was taken</Text>
        )}
      </View>

      <Pressable
        style={canc.bookAgainBtn}
        onPress={() => router.push(`/facility/${booking.facility.id}`)}
      >
        <Text style={canc.bookAgainText}>Book Again</Text>
      </Pressable>
    </View>
  );
}

const canc = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 14, opacity: 0.8,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  topRow:  { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  left:    { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  emoji:   { fontSize: 26, opacity: 0.6, marginTop: 2 },
  name:    { color: C.muted, fontSize: 15, fontWeight: "700", marginBottom: 3, maxWidth: 180 },
  sub:     { color: C.muted, fontSize: 12, marginBottom: 1 },
  badge: {
    backgroundColor: "#FEF2F2", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText:   { color: "#EF4444", fontSize: 11, fontWeight: "700" },
  refundBox:   { backgroundColor: "#F8F8F8", borderRadius: 10, padding: 10, gap: 4, marginBottom: 10 },
  refundLabel: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  refundText:  { color: C.text, fontSize: 13 },
  bookAgainBtn: {
    borderWidth: 1.5, borderColor: C.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: "center",
  },
  bookAgainText: { color: C.primary, fontWeight: "700", fontSize: 13 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ tab?: string; highlightBookingId?: string }>();

  const { threads }     = useThreads();
  const { unreadCount } = useNotificationsContext();
  const unreadMessages  = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);

  const { bookings, isLoading, error, refetch } = useMyBookings();
  const { profile } = useMyProfile();

  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "cancelled">(
    params.tab === "past" ? "past" : params.tab === "cancelled" ? "cancelled" : "upcoming"
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(
    params.highlightBookingId ?? null
  );
  const listRef = useRef<FlatList<MyBooking>>(null);

  // Process deep-link params from review-prompt notification
  useEffect(() => {
    if (!params.tab && !params.highlightBookingId) return;
    if (params.tab === "past" || params.tab === "cancelled") {
      setActiveTab(params.tab);
    }
    if (params.highlightBookingId) {
      setHighlightedId(params.highlightBookingId);
      const t = setTimeout(() => setHighlightedId(null), 5000);
      router.setParams({ tab: undefined, highlightBookingId: undefined });
      return () => clearTimeout(t);
    }
    router.setParams({ tab: undefined });
  }, [params.tab, params.highlightBookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));

  const { upcoming, past, cancelled } = useMemo(() => {
    const now = new Date();
    const up: MyBooking[] = [];
    const pa: MyBooking[] = [];
    const ca: MyBooking[] = [];
    for (const b of bookings) {
      if (b.status === "CANCELLED") { ca.push(b); continue; }
      const dateStr  = b.slot.date.split("T")[0]!;
      const slotEnd  = new Date(`${dateStr}T${b.slot.endTime}:00`);
      (slotEnd >= now ? up : pa).push(b);
    }
    up.sort((a, b) => a.slot.date.localeCompare(b.slot.date));
    pa.sort((a, b) => b.slot.date.localeCompare(a.slot.date));
    ca.sort((a, b) => b.slot.date.localeCompare(a.slot.date));
    return { upcoming: up, past: pa, cancelled: ca };
  }, [bookings]);

  const displayed =
    activeTab === "upcoming" ? upcoming :
    activeTab === "past"     ? past     : cancelled;

  // Scroll to highlighted booking once past list is ready
  useEffect(() => {
    if (!highlightedId || activeTab !== "past" || past.length === 0) return;
    const idx = past.findIndex((b) => b.id === highlightedId);
    if (idx < 0) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
    }, 350);
    return () => clearTimeout(t);
  }, [highlightedId, activeTab, past]);

  const stats = profile?.stats;

  const TABS: { key: "upcoming" | "past" | "cancelled"; label: string; count?: number }[] = [
    { key: "upcoming",  label: "Upcoming",  count: upcoming.length  },
    { key: "past",      label: "Past"                               },
    { key: "cancelled", label: "Cancelled", count: cancelled.length > 0 ? cancelled.length : undefined },
  ];

  function renderItem({ item }: { item: MyBooking }) {
    const slotDate = item.slot.date.split("T")[0]!;
    const isPast = (() => {
      const [y, m, d] = slotDate.split("-").map(Number) as [number, number, number];
      return new Date(y, m - 1, d) < new Date(new Date().setHours(0, 0, 0, 0));
    })();

    if (activeTab === "cancelled") {
      return <CancelledCard booking={item} />;
    }

    if (activeTab === "past") {
      return (
        <PastCard
          booking={item}
          reviewed={!!item.review}
          highlighted={item.id === highlightedId}
          onReview={
            isPast && item.status === "CONFIRMED" && !item.review
              ? () =>
                  router.push({
                    pathname: "/review/[bookingId]",
                    params: {
                      bookingId: item.id,
                      facilityName: item.facility.name,
                      sport: item.facility.sport,
                      slotDate,
                    },
                  })
              : undefined
          }
        />
      );
    }

    return (
      <UpcomingCard
        booking={item}
        onCancel={() =>
          router.push({
            pathname: "/booking/cancel/[bookingId]",
            params: {
              bookingId: item.id,
              ...(item.bookingGroupId ? { bookingGroupId: item.bookingGroupId } : {}),
              facilityName: item.facility.name,
              sport: item.facility.sport,
              slotDate,
              startTime: item.slot.startTime,
              endTime: item.slot.endTime,
              totalCAD: String(item.totalCAD),
            },
          })
        }
      />
    );
  }

  const hasAnyBookings = bookings.length > 0;

  const EMPTY_CONFIG: Record<string, { emoji: string; title: string; sub: string; cta: string }> = {
    upcoming:  { emoji: "🏟️", title: "No upcoming games",   sub: "Your next adventure awaits!",  cta: "Browse Courts"   },
    past:      { emoji: "📅", title: "No past bookings yet", sub: "Start playing today!",          cta: "Find a Court"    },
    cancelled: { emoji: "❌", title: "No cancelled bookings", sub: "All good here!",              cta: "Browse Courts"   },
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>MY BOOKINGS</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/(tabs)/chats")} hitSlop={8}>
            <Ionicons name="chatbubbles-outline" size={22} color={C.text} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push("/notifications")} hitSlop={8}>
            <Ionicons name="notifications-outline" size={22} color={C.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {hasAnyBookings && stats && (
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalGames}</Text>
            <Text style={styles.statLabel}>{"GAMES\nPLAYED"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalHours}h</Text>
            <Text style={styles.statLabel}>{"COURT\nTIME"}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐{stats.totalPoints}</Text>
            <Text style={styles.statLabel}>{"DOME\nPOINTS"}</Text>
          </View>
        </View>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.count != null && tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
            }, 300);
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading && bookings.length > 0}
              onRefresh={refetch}
              tintColor={C.primary}
              title="Refreshing bookings…"
              titleColor={C.muted}
            />
          }
          ListHeaderComponent={
            isLoading && bookings.length === 0 ? (
              <View>
                <BookingSkeleton />
                <BookingSkeleton />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isLoading ? null : (() => {
              const cfg = EMPTY_CONFIG[activeTab]!;
              return (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>{cfg.emoji}</Text>
                  <Text style={styles.emptyTitle}>{cfg.title}</Text>
                  <Text style={styles.emptySub}>{cfg.sub}</Text>
                  <Pressable
                    style={styles.emptyBtn}
                    onPress={() => router.navigate("/(tabs)/venues" as Parameters<typeof router.navigate>[0])}
                  >
                    <Text style={styles.emptyBtnText}>{cfg.cta}</Text>
                  </Pressable>
                </View>
              );
            })()
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: C.bg },
  center:  { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 12,
    paddingBottom: 12,
  },
  title:         { color: C.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5 },
  headerActions: { flexDirection: "row", gap: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute", top: 5, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.bg,
  },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },

  // Stats
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    paddingVertical: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statItem:    { flex: 1, alignItems: "center", gap: 3 },
  statValue:   { color: C.primary, fontSize: 18, fontWeight: "900" },
  statLabel:   { color: C.muted, fontSize: 9, fontWeight: "700", textTransform: "uppercase", textAlign: "center", letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  // Tabs
  tabBar: {
    flexDirection: "row", paddingHorizontal: 16,
    marginBottom: 12, gap: 8,
  },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, backgroundColor: C.surface,
  },
  tabActive:      { backgroundColor: C.primary },
  tabText:        { color: C.muted, fontSize: 13, fontWeight: "600" },
  tabTextActive:  { color: "#FFFFFF", fontWeight: "700" },
  tabBadge: {
    backgroundColor: "#fff", borderRadius: 99,
    paddingHorizontal: 6, minWidth: 18, alignItems: "center",
    paddingVertical: 1,
  },
  tabBadgeText: { color: C.primary, fontSize: 11, fontWeight: "800" },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 4 },

  // Empty
  emptyWrap:  { alignItems: "center", paddingTop: 72, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  emptySub:   { color: C.muted, fontSize: 14, textAlign: "center", marginBottom: 24 },
  emptyBtn: {
    backgroundColor: C.primary, borderRadius: 20,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Error
  errorText: { color: "#EF4444", fontSize: 15, marginBottom: 14, textAlign: "center" },
  retryBtn:  { backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
