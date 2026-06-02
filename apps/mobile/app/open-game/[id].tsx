import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function OpenGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Open game {id} — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000", alignItems: "center", justifyContent: "center" },
  text: { color: "#6B6B6B", fontSize: 15 },
});
