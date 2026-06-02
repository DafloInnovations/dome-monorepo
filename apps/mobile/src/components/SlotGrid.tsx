import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Slot } from "../hooks/useSlots";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

interface Props {
  slots: Slot[];
  selectedSlotId?: string;
  onSelect: (slot: Slot) => void;
}

function getSlotStyle(status: Slot["status"], selected: boolean) {
  if (selected) {
    return { backgroundColor: "#E85068", opacity: 1, borderColor: "#E85068" };
  }
  switch (status) {
    case "AVAILABLE":
      return { backgroundColor: "#E8506822", opacity: 1, borderColor: "#E85068" };
    case "BOOKED":
      return { backgroundColor: "#2A2A2A", opacity: 0.6, borderColor: "#3A3A3C" };
    case "HELD":
      return { backgroundColor: "#1C1C1E", opacity: 0.7, borderColor: "#2C2C2E" };
    default:
      return { backgroundColor: "#2A2A2A", opacity: 0.5, borderColor: "#3A3A3C" };
  }
}

// Fetches the real TTL once, then counts down locally every second.
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
      setSeconds((s) => {
        if (s === null || s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [slotId]);

  if (seconds === null) return <Text style={styles.labelMuted}>Held</Text>;
  if (seconds <= 0) return <Text style={styles.labelMuted}>Held</Text>;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display =
    mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;

  return <Text style={styles.labelMuted}>Held · {display}</Text>;
}

function SlotLabel({ slot }: { slot: Slot }) {
  if (slot.status === "AVAILABLE") {
    return (
      <Text style={styles.label}>
        C${slot.priceCAD != null ? Number(slot.priceCAD).toFixed(0) : "—"}
      </Text>
    );
  }
  if (slot.status === "HELD") {
    return <HeldSlotTimer slotId={slot.id} />;
  }
  return <Text style={styles.labelMuted}>{slot.status === "BOOKED" ? "Booked" : "—"}</Text>;
}

export default function SlotGrid({ slots, selectedSlotId, onSelect }: Props) {
  const slotList = slots ?? [];

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
        const available = slot.status === "AVAILABLE";
        const selected = available && slot.id === selectedSlotId;
        const slotStyle = getSlotStyle(slot.status, selected);

        return (
          <Pressable
            key={slot.id}
            disabled={!available}
            onPress={() => onSelect(slot)}
            style={[
              styles.slot,
              {
                backgroundColor: slotStyle.backgroundColor,
                opacity: slotStyle.opacity,
                borderColor: slotStyle.borderColor,
              },
            ]}
          >
            <Text style={[styles.time, !available && styles.timeMuted]}>
              {slot.startTime}
            </Text>
            <SlotLabel slot={slot} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 8,
  },
  slot: {
    width: "29%",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  time: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  timeMuted: { color: "#6B6B6B" },
  label: { color: "#FFFFFF", fontSize: 10, fontWeight: "600", opacity: 0.85 },
  labelMuted: { color: "#6B6B6B", fontSize: 10, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: "#6B6B6B", fontSize: 14 },
});
