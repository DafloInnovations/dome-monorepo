import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Slot } from "../hooks/useSlots";

const C = {
  bg: "#000000",
  primary: "#E85068",
  surface: "#1C1C1E",
  text: "#FFFFFF",
  muted: "#6B6B6B",
  available: "#166534",
  unavailable: "#3f3f46",
  selectedRange: "#E85068",
};

// 30-min buckets: 06:00 → 23:00 (34 buckets)
const START_HOUR = 6;
const END_HOUR = 23;
const BUCKET_MINS = 30;
const CELL_W = 60;
const CELL_H = 68;

function minsFromMidnight(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function buildBuckets() {
  const buckets: string[] = [];
  let cur = START_HOUR * 60;
  while (cur < END_HOUR * 60) {
    buckets.push(minutesToTime(cur));
    cur += BUCKET_MINS;
  }
  return buckets;
}

const BUCKETS = buildBuckets();

interface Props {
  selectedTime: string | null;
  durationMinutes: number;
  slots: Slot[];
  onSelectTime: (time: string) => void;
}

export default function TimelineSelector({ selectedTime, durationMinutes, slots, onSelectTime }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Build availability map from slots (any available slot at this time = green)
  const availMap = new Map<string, boolean>();
  for (const slot of slots) {
    if (!availMap.has(slot.startTime) || slot.status === "AVAILABLE") {
      availMap.set(slot.startTime, slot.status === "AVAILABLE");
    }
  }

  const selectedStartMins = selectedTime ? minsFromMidnight(selectedTime) : null;
  const selectedEndMins = selectedStartMins !== null ? selectedStartMins + durationMinutes : null;

  function isBucketInRange(bucketTime: string): boolean {
    if (selectedStartMins === null || selectedEndMins === null) return false;
    const bMins = minsFromMidnight(bucketTime);
    return bMins >= selectedStartMins && bMins < selectedEndMins;
  }

  function getBucketColor(time: string): string {
    if (isBucketInRange(time)) return C.selectedRange;
    const isAvail = availMap.get(time);
    if (isAvail === true) return C.available;
    if (isAvail === false) return C.unavailable;
    return C.surface; // no slot data yet
  }

  const endTime = selectedTime && selectedEndMins !== null
    ? minutesToTime(selectedEndMins)
    : null;

  return (
    <View>
      {selectedTime ? (
        <View style={styles.selectedDisplay}>
          <Text style={styles.selectedLabel}>TIME</Text>
          <Text style={styles.selectedTime}>
            {formatAmPm(selectedTime)}{endTime ? ` → ${formatAmPm(endTime)}` : ""}
          </Text>
        </View>
      ) : (
        <Text style={styles.hint}>Tap a time to select start</Text>
      )}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {BUCKETS.map((time) => {
          const isSelected = time === selectedTime;
          const isInRange = isBucketInRange(time);
          const bgColor = getBucketColor(time);
          const showLabel = minsFromMidnight(time) % 60 === 0;

          return (
            <Pressable
              key={time}
              style={[styles.cell, { backgroundColor: bgColor }]}
              onPress={() => onSelectTime(time)}
            >
              {showLabel ? (
                <Text style={[styles.timeLabel, (isSelected || isInRange) && styles.timeLabelActive]}>
                  {time}
                </Text>
              ) : (
                <View style={styles.halfMark} />
              )}
              {isSelected && <View style={styles.startDot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.available }]} />
          <Text style={styles.legendText}>Available</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.unavailable }]} />
          <Text style={styles.legendText}>Booked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: C.selectedRange }]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedDisplay: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  selectedLabel: {
    color: "#6B6B6B",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  selectedTime: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  hint: {
    color: "#6B6B6B",
    fontSize: 13,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  row: {
    paddingHorizontal: 16,
    gap: 2,
    alignItems: "flex-end",
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  timeLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "600",
  },
  timeLabelActive: {
    color: "#FFFFFF",
  },
  halfMark: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 4,
  },
  startDot: {
    position: "absolute",
    top: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: "#6B6B6B",
    fontSize: 11,
  },
});
