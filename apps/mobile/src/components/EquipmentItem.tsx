import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../theme";
import type { EquipmentItem as EquipmentItemType } from "../hooks/useEquipment";

const SPORT_EMOJI: Record<string, string> = {
  BADMINTON: "🏸", TENNIS: "🎾", BASKETBALL: "🏀", SOCCER: "⚽",
  PICKLEBALL: "🏓", VOLLEYBALL: "🏐", HOCKEY: "🏒", CRICKET: "🏏",
  BASEBALL: "⚾", SQUASH: "🎾",
};

interface Props {
  item: EquipmentItemType;
  quantity: number;
  onChangeQuantity: (qty: number) => void;
}

export default function EquipmentItem({ item, quantity, onChangeQuantity }: Props) {
  const emoji = SPORT_EMOJI[item.sport.toUpperCase()] ?? "🎒";
  const isUnavailable = item.availableQuantity === 0;
  const maxQty = item.availableQuantity;

  return (
    <View style={[styles.row, isUnavailable && styles.rowDisabled]}>
      <View style={styles.left}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          {isUnavailable ? (
            <Text style={styles.soldOut}>Sold out</Text>
          ) : (
            <Text style={styles.price}>C${item.priceCAD.toFixed(2)} / session</Text>
          )}
        </View>
      </View>

      <View style={styles.stepper}>
        <Pressable
          style={[styles.stepBtn, quantity === 0 && styles.stepBtnDisabled]}
          onPress={() => onChangeQuantity(Math.max(0, quantity - 1))}
          disabled={quantity === 0}
          hitSlop={8}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.qty}>{quantity}</Text>
        <Pressable
          style={[styles.stepBtn, (isUnavailable || quantity >= maxQty) && styles.stepBtnDisabled]}
          onPress={() => onChangeQuantity(Math.min(maxQty, quantity + 1))}
          disabled={isUnavailable || quantity >= maxQty}
          hitSlop={8}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowDisabled: { opacity: 0.45 },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  emoji: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  name: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  desc: { color: COLORS.textMuted, fontSize: 12 },
  price: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  soldOut: { color: COLORS.error, fontSize: 12, fontWeight: "600" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 12 },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnDisabled: { opacity: 0.35 },
  stepBtnText: { color: COLORS.text, fontSize: 16, fontWeight: "700", lineHeight: 20 },
  qty: { color: COLORS.text, fontSize: 15, fontWeight: "700", minWidth: 18, textAlign: "center" },
});
