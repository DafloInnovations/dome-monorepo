import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../src/context/AuthContext";

export default function ProfileScreen() {
  const { user, clearSession } = useAuth();

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.phone?.slice(-2) ?? "?";

  const displayName =
    user?.firstName
      ? `${user.firstName} ${user.lastName ?? ""}`.trim()
      : user?.phone ?? "Unknown";

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <Text style={styles.name}>{displayName}</Text>
      {user?.phone ? (
        <Text style={styles.phone}>
          +1 ({user.phone.slice(0, 3)}) {user.phone.slice(3, 6)}-{user.phone.slice(6)}
        </Text>
      ) : null}
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{user?.role?.toLowerCase() ?? "player"}</Text>
      </View>

      <View style={styles.divider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={clearSession}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  initials: { fontSize: 32, fontWeight: "700", color: "#15803d" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 },
  phone: { fontSize: 15, color: "#6b7280", marginBottom: 10 },
  roleBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 32,
  },
  roleText: { fontSize: 13, color: "#15803d", fontWeight: "600", textTransform: "capitalize" },
  divider: { width: "100%", height: 1, backgroundColor: "#e5e7eb", marginBottom: 16 },
  logoutBtn: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: { color: "#ef4444", fontWeight: "700", fontSize: 15 },
});
