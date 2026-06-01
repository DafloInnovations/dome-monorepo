import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export default function DiscoverScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="City, sport, or facility name..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      <Text style={styles.sectionTitle}>Near You</Text>
      <Text style={styles.placeholder}>Sign in to see facilities near you</Text>

      <Text style={styles.sectionTitle}>Popular Sports</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {["Soccer", "Basketball", "Tennis", "Badminton", "Hockey", "Pickleball"].map((sport) => (
          <View key={sport} style={styles.chip}>
            <Text style={styles.chipText}>{sport}</Text>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  searchBar: { margin: 16 },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  placeholder: { color: "#9ca3af", marginHorizontal: 16, marginBottom: 16 },
  chipRow: { paddingLeft: 16, marginBottom: 20 },
  chip: {
    backgroundColor: "#dcfce7",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipText: { color: "#15803d", fontWeight: "600", fontSize: 13 },
});
