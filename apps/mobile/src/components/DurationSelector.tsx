import { Pressable, StyleSheet, Text, View } from "react-native";

const MIN_DURATION = 30;
const MAX_DURATION = 180;
const STEP = 30;

function addMins(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h! * 60 + m! + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatAmPm(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h! >= 12 ? "PM" : "AM";
  const hour = h! % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

interface Props {
  duration: number;
  startTime: string | null;
  onChangeDuration: (duration: number) => void;
}

export default function DurationSelector({ duration, startTime, onChangeDuration }: Props) {
  const canDecrease = duration > MIN_DURATION;
  const canIncrease = duration < MAX_DURATION;

  const endTime = startTime ? addMins(startTime, duration) : null;
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  const durationLabel = hours > 0
    ? mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    : `${mins}m`;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Duration</Text>
        {endTime && startTime && (
          <Text style={styles.endTime}>
            {formatAmPm(startTime)} → {formatAmPm(endTime)}
          </Text>
        )}
      </View>

      <View style={styles.control}>
        <Pressable
          onPress={() => canDecrease && onChangeDuration(duration - STEP)}
          style={[styles.btn, !canDecrease && styles.btnDisabled]}
          disabled={!canDecrease}
        >
          <Text style={[styles.btnText, !canDecrease && styles.btnTextDisabled]}>−</Text>
        </Pressable>

        <View style={styles.valueBox}>
          <Text style={styles.valueText}>{durationLabel}</Text>
        </View>

        <Pressable
          onPress={() => canIncrease && onChangeDuration(duration + STEP)}
          style={[styles.btn, !canIncrease && styles.btnDisabled]}
          disabled={!canIncrease}
        >
          <Text style={[styles.btnText, !canIncrease && styles.btnTextDisabled]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1C1C1E",
    borderRadius: 14,
    marginHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: {
    color: "#6B6B6B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  endTime: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  control: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2C2C2E",
    borderWidth: 1,
    borderColor: "#3A3A3C",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 26,
  },
  btnTextDisabled: {
    color: "#6B6B6B",
  },
  valueBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
  },
  valueText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
});
