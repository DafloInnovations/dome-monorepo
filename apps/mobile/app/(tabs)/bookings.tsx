import { StyleSheet, Text, View } from "react-native";

export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.empty}>No bookings yet.</Text>
      <Text style={styles.sub}>Your upcoming and past reservations will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", padding: 24 },
  empty: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 6 },
  sub: { fontSize: 14, color: "#9ca3af", textAlign: "center" },
});
