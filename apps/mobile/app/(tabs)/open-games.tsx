import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function OpenGamesScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Open Games</Text>
      <Text style={styles.sub}>Join a game and split the court cost with other players.</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No open games nearby right now.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  heading: { fontSize: 22, fontWeight: "700", margin: 16, marginBottom: 4 },
  sub: { fontSize: 14, color: "#6b7280", marginHorizontal: 16, marginBottom: 16 },
  empty: { margin: 16, padding: 24, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center" },
  emptyText: { color: "#9ca3af", fontSize: 15 },
});
