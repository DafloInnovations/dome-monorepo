import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../theme";
import type { Slot } from "../hooks/useSlots";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

interface SingleSelectProps {
  multiSelect?: false;
  slots: Slot[];
  selectedSlotId?: string;
  onSelect: (slot: Slot) => void;
  selectedSlotIds?: never;
  onMultiSelect?: never;
}

interface MultiSelectProps {
  multiSelect: true;
  slots: Slot[];
  selectedSlotIds: string[];
  onMultiSelect: (slot: Slot) => void;
  selectedSlotId?: never;
  onSelect?: never;
}

type Props = SingleSelectProps | MultiSelectProps;

function getSlotStyle(status: Slot["status"], selected: boolean) {
  if (selected) {
    return { backgroundColor: COLORS.primary, borderColor: COLORS.primary };
  }
  switch (status) {
    case "AVAILABLE":
      return { backgroundColor: COLORS.primaryUltraLight, borderColor: COLORS.primaryLight };
    case "BOOKED":
      return { backgroundColor: COLORS.surfaceElevated, borderColor: COLORS.border };
    case "HELD":
      return { backgroundColor: COLORS.surface, borderColor: COLORS.border };
    default:
      return { backgroundColor: COLORS.surfaceElevated, borderColor: COLORS.border };
  }
}

function HeldSlotTimer({ slotId }: { slotId: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/slots/${slotId}/lock-status`)
      .then((r) => r.json())
      .then((json: { data: { ttl: number } }) => {
        if (!cancelled && json.data.ttl > 0) setSeconds(json.data.ttl);
      })
      .catch(() => {});

    const tick = setInterval(() => {
      setSeconds((s) => (s === null || s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => { cancelled = true; clearInterval(tick); };
  }, [slotId]);

  if (seconds === null || seconds <= 0) return <Text style={styles.labelMuted}>Held</Text>;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return <Text style={styles.labelMuted}>Held · {mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}</Text>;
}

function SlotLabel({ slot }: { slot: Slot }) {
  if (slot.capacity != null) {
    const remaining = slot.capacity - slot.spotsBooked;
    if (remaining <= 0) return <Text style={styles.labelMuted}>Full</Text>;
    return (
      <Text style={styles.label}>
        {remaining} spot{remaining !== 1 ? "s" : ""} · C${Number(slot.priceCAD).toFixed(0)}
      </Text>
    );
  }
  if (slot.status === "AVAILABLE") {
    return <Text style={styles.label}>C${slot.priceCAD != null ? Number(slot.priceCAD).toFixed(0) : "—"}</Text>;
  }
  if (slot.status === "HELD") return <HeldSlotTimer slotId={slot.id} />;
  return <Text style={styles.labelMuted}>{slot.status === "BOOKED" ? "Booked" : "—"}</Text>;
}

export default function SlotGrid(props: Props) {
  const slotList = props.slots ?? [];

  if (!slotList.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No slots available for this date</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {slotList.map((slot) => {
        const isSession = slot.capacity != null;
        const sessionFull = isSession && slot.spotsBooked >= (slot.capacity ?? 0);
        const available = isSession
          ? !sessionFull && slot.status !== "BLOCKED"
          : slot.status === "AVAILABLE";

        const selected = props.multiSelect
          ? props.selectedSlotIds.includes(slot.id)
          : props.selectedSlotId === slot.id && available;

        const slotStyle = getSlotStyle(slot.status, selected);
        const opacity = available ? 1 : 0.5;

        return (
          <Pressable
            key={slot.id}
            disabled={!available}
            onPress={() => {
              if (props.multiSelect) props.onMultiSelect(slot);
              else props.onSelect(slot);
            }}
            style={[
              styles.slot,
              { backgroundColor: slotStyle.backgroundColor, borderColor: slotStyle.borderColor, opacity },
            ]}
          >
            <Text style={[styles.time, !available && styles.timeMuted]}>{slot.startTime}</Text>
            <SlotLabel slot={slot} />
            {props.multiSelect && selected && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  slot: { width: "29%", borderWidth: 1.5, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 4 },
  time: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  timeMuted: { color: COLORS.textMuted },
  label: { color: COLORS.text, fontSize: 10, fontWeight: "600", opacity: 0.85, textAlign: "center" },
  labelMuted: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  checkmark: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", position: "absolute", top: 4, right: 6 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
