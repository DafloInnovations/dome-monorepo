import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../theme";
import type { AvailableCourt } from "../hooks/useAvailableCourts";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
  DEFAULT: "🏟️",
};

function sportLabel(sport: string): string {
  return sport.charAt(0) + sport.slice(1).toLowerCase();
}

interface Props {
  court: AvailableCourt;
  isSelected: boolean;
  onPress: () => void;
  alertSet?: boolean;
  onAlertPress?: () => void;
}

export default function CourtCard({ court, isSelected, onPress, alertSet, onAlertPress }: Props) {
  const emoji = SPORT_EMOJI[court.sport?.toUpperCase() ?? ""] ?? SPORT_EMOJI["DEFAULT"]!;
  const available = court.isAvailable;
  const breakdown = court.priceBreakdown;

  const hasPriceChange = court.totalPriceCAD !== court.basePriceCAD;
  const isDiscount = hasPriceChange && court.totalPriceCAD < court.basePriceCAD;
  const isPremium  = hasPriceChange && court.totalPriceCAD > court.basePriceCAD;

  const discountPct = isDiscount && court.basePriceCAD > 0
    ? Math.round((1 - court.totalPriceCAD / court.basePriceCAD) * 100)
    : null;

  const otherSports = court.isShared
    ? court.sports.filter((s) => s !== court.sport).map(sportLabel).join(", ")
    : null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={available ? onPress : undefined}
        style={[
          styles.card,
          available && isSelected && styles.cardSelected,
          available && !isSelected && styles.cardAvailable,
          !available && styles.cardUnavailable,
        ]}
      >
        {/* Selected checkmark */}
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}

        {/* Shared badge */}
        {court.isShared && (
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedBadgeText}>🔄</Text>
          </View>
        )}

        {/* Discount / peak badge */}
        {available && hasPriceChange && (
          <View style={[styles.badge, isDiscount ? styles.badgeGreen : styles.badgeAmber]}>
            <Text style={[styles.badgeText, isDiscount ? styles.badgeGreenText : styles.badgeAmberText]}>
              {isDiscount ? `${discountPct}% OFF` : "Peak"}
            </Text>
          </View>
        )}

        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.name, !available && styles.nameMuted]} numberOfLines={2}>
          {court.name}
        </Text>

        {/* Sport label for shared courts */}
        {court.isShared && (
          <Text style={styles.sportLabel}>{sportLabel(court.sport)}</Text>
        )}

        {available ? (
          <View style={styles.priceBlock}>
            {hasPriceChange && (
              <Text style={styles.basePrice}>C${court.basePriceCAD.toFixed(2)}</Text>
            )}
            <View style={styles.priceRow}>
              <Text style={[styles.price, isDiscount ? styles.priceGreen : isPremium ? styles.priceAmber : styles.pricePrimary]}>
                C${court.totalPriceCAD.toFixed(2)}
              </Text>
              <Text style={styles.priceSub}>total</Text>
            </View>
            {breakdown?.appliedRule && (
              <Text style={styles.ruleLabel} numberOfLines={1}>{breakdown.appliedRule}</Text>
            )}
            {otherSports && (
              <Text style={styles.alsoSupports} numberOfLines={1}>Also: {otherSports}</Text>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.unavailableText} numberOfLines={2}>
              {court.notCovered
                ? "No slots for this window"
                : court.unavailableReason
                ? court.unavailableReason
                : court.bookedUntil
                ? `Booked until ${court.bookedUntil}`
                : "Unavailable"}
            </Text>
            {otherSports && (
              <Text style={styles.alsoSupports} numberOfLines={1}>Also: {otherSports}</Text>
            )}
          </>
        )}
      </Pressable>

      {/* Alert Me button */}
      {!available && onAlertPress && (
        <Pressable
          onPress={alertSet ? undefined : onAlertPress}
          style={[styles.alertBtn, alertSet && styles.alertBtnSet]}
        >
          <Text style={[styles.alertBtnText, alertSet && styles.alertBtnTextSet]}>
            {alertSet ? "✓ Alert Set" : "🔔 Alert Me"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 130,
    maxWidth: 180,
    alignItems: "stretch",
    gap: 6,
  },
  card: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    position: "relative",
  },
  cardAvailable: { borderColor: COLORS.border },
  cardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryUltraLight },
  cardUnavailable: { opacity: 0.5 },
  checkmark: {
    position: "absolute", top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  checkmarkText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  sharedBadge: { position: "absolute", top: 8, left: 8 },
  sharedBadgeText: { fontSize: 12 },
  badge: {
    position: "absolute", top: 8, left: 28,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeGreen: { backgroundColor: COLORS.success + "22" },
  badgeAmber: { backgroundColor: COLORS.warning + "22" },
  badgeText: { fontSize: 9, fontWeight: "800" },
  badgeGreenText: { color: COLORS.success },
  badgeAmberText: { color: COLORS.warning },
  emoji: { fontSize: 30, marginBottom: 4, marginTop: 4 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 2 },
  nameMuted: { color: COLORS.textMuted },
  sportLabel: { color: COLORS.primary, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  priceBlock: { alignItems: "center" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  price: { fontSize: 16, fontWeight: "800" },
  pricePrimary: { color: COLORS.primary },
  priceGreen:   { color: COLORS.success },
  priceAmber:   { color: COLORS.warning },
  priceSub: { color: COLORS.textMuted, fontSize: 11 },
  basePrice: {
    color: COLORS.textMuted, fontSize: 11,
    textDecorationLine: "line-through", marginBottom: 1,
  },
  ruleLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 3, textAlign: "center" },
  alsoSupports: { color: COLORS.textMuted, fontSize: 9, marginTop: 2, textAlign: "center" },
  unavailableText: { color: COLORS.textMuted, fontSize: 11, textAlign: "center", lineHeight: 15 },
  alertBtn: {
    paddingVertical: 7, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.primary, alignItems: "center",
  },
  alertBtnSet: { borderColor: COLORS.border, backgroundColor: COLORS.success + "18" },
  alertBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  alertBtnTextSet: { color: COLORS.success },
});
