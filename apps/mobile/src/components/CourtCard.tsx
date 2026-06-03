import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AvailableCourt } from "../hooks/useAvailableCourts";

const SPORT_EMOJI: Record<string, string> = {
  SOCCER: "⚽", BASKETBALL: "🏀", TENNIS: "🎾", BADMINTON: "🏸",
  VOLLEYBALL: "🏐", HOCKEY: "🏒", SQUASH: "🎾", PICKLEBALL: "🏓",
  DEFAULT: "🏟️",
};

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

  const hasPriceChange = breakdown !== null && breakdown.finalPriceCAD !== breakdown.basePriceCAD;
  const isDiscount = hasPriceChange && breakdown!.finalPriceCAD < breakdown!.basePriceCAD;
  const isPremium  = hasPriceChange && breakdown!.finalPriceCAD > breakdown!.basePriceCAD;

  const discountPct = isDiscount
    ? Math.round((1 - breakdown!.finalPriceCAD / breakdown!.basePriceCAD) * 100)
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

        {/* Pricing badge */}
        {available && hasPriceChange && (
          <View style={[styles.badge, isDiscount ? styles.badgeGreen : styles.badgeAmber]}>
            <Text style={[styles.badgeText, isDiscount ? styles.badgeGreenText : styles.badgeAmberText]}>
              {isDiscount ? `${discountPct}% OFF` : "Peak"}
            </Text>
          </View>
        )}

        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={[styles.name, !available && styles.nameUnavailable]} numberOfLines={2}>
          {court.name}
        </Text>

        {available ? (
          <View style={styles.priceBlock}>
            {hasPriceChange && breakdown && (
              <Text style={styles.basePrice}>C${breakdown.basePriceCAD.toFixed(2)}</Text>
            )}
            <View style={styles.priceRow}>
              <Text style={[styles.price, isDiscount ? styles.priceGreen : isPremium ? styles.priceAmber : styles.priceDefault]}>
                C${court.totalPriceCAD.toFixed(2)}
              </Text>
              <Text style={styles.priceSub}>total</Text>
            </View>
            {breakdown?.appliedRule && (
              <Text style={styles.ruleLabel} numberOfLines={1}>{breakdown.appliedRule}</Text>
            )}
          </View>
        ) : (
          <Text style={styles.unavailableText} numberOfLines={2}>
            {court.notCovered
              ? "No slots for this window"
              : court.bookedUntil
              ? `Booked until ${court.bookedUntil}`
              : "Unavailable"}
          </Text>
        )}
      </Pressable>

      {/* Alert Me button — shown only for unavailable courts */}
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
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    position: "relative",
  },
  cardAvailable: { borderColor: "#3A3A3C" },
  cardSelected: { borderColor: "#E85068", backgroundColor: "#E8506814" },
  cardUnavailable: { opacity: 0.5 },
  checkmark: {
    position: "absolute", top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#E85068", alignItems: "center", justifyContent: "center",
  },
  checkmarkText: { color: "#FFF", fontSize: 11, fontWeight: "700" },
  badge: {
    position: "absolute", top: 8, left: 8,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  badgeGreen: { backgroundColor: "#14532d" },
  badgeAmber: { backgroundColor: "#78350f" },
  badgeText: { fontSize: 9, fontWeight: "800" },
  badgeGreenText: { color: "#86efac" },
  badgeAmberText: { color: "#fcd34d" },
  emoji: { fontSize: 30, marginBottom: 8, marginTop: 4 },
  name: { color: "#FFF", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  nameUnavailable: { color: "#6B6B6B" },
  priceBlock: { alignItems: "center" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  price: { fontSize: 16, fontWeight: "800" },
  priceDefault: { color: "#E85068" },
  priceGreen: { color: "#4ade80" },
  priceAmber: { color: "#fbbf24" },
  priceSub: { color: "#6B6B6B", fontSize: 11 },
  basePrice: {
    color: "#6B6B6B", fontSize: 11,
    textDecorationLine: "line-through",
    marginBottom: 1,
  },
  ruleLabel: { color: "#6B6B6B", fontSize: 10, marginTop: 3, textAlign: "center" },
  unavailableText: { color: "#6B6B6B", fontSize: 11, textAlign: "center", lineHeight: 15 },
  alertBtn: {
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E85068",
    alignItems: "center",
  },
  alertBtnSet: { borderColor: "#3A3A3C", backgroundColor: "#14532d33" },
  alertBtnText: { color: "#E85068", fontSize: 11, fontWeight: "700" },
  alertBtnTextSet: { color: "#4ade80" },
});
