import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import { useThreads } from "../../hooks/useChat";
import { useNotificationsContext } from "../../context/NotificationsContext";

interface Props {
  /** Replaces the left-side city label on non-home screens */
  title?: string;
  /** Shows the location pill (📍 city) when true */
  showLocation?: boolean;
  city?: string;
  onCityPress?: () => void;
  showChat?: boolean;
  showNotifications?: boolean;
  showAvatar?: boolean;
}

export default function AppHeader({
  title,
  showLocation = false,
  city,
  onCityPress,
  showChat = true,
  showNotifications = true,
  showAvatar = true,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { threads } = useThreads();
  const { unreadCount } = useNotificationsContext();

  const unreadMessages = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);
  const initials = user?.firstName
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <View style={styles.header}>
      {/* Left — location pill or title */}
      {showLocation ? (
        <Pressable onPress={onCityPress} hitSlop={10} style={styles.location}>
          <Text style={styles.locationPin}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>
            {city ?? "Select city"}
          </Text>
          <Text style={styles.locationArrow}>▾</Text>
        </Pressable>
      ) : (
        <Text style={styles.title}>{title ?? ""}</Text>
      )}

      {/* Right — action icons */}
      <View style={styles.actions}>
        {showChat && (
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/(tabs)/chats")}
            hitSlop={8}
          >
            <Ionicons name="chatbubbles-outline" size={22} color={COLORS.text} />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {showNotifications && (
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        )}

        {showAvatar && (
          <Pressable
            style={styles.avatarBtn}
            onPress={() => router.push("/(tabs)/profile")}
            hitSlop={8}
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  // Location pill
  location: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    paddingRight: 8,
  },
  locationPin: { fontSize: 14 },
  locationText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  locationArrow: { color: COLORS.primary, fontSize: 11, fontWeight: "700" },
  // Title
  title: { color: COLORS.text, fontSize: 18, fontWeight: "800", flex: 1 },
  // Actions
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 5,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },
  badgeText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  // Avatar
  avatarBtn: { marginLeft: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  avatarInitials: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
});
