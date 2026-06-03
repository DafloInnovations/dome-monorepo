import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useThreads } from "../../src/hooks/useChat";
import { useAlerts } from "../../src/hooks/useAlerts";

export default function TabLayout() {
  const { user } = useAuth();
  const { threads } = useThreads();
  const { pendingCount } = useAlerts();

  if (!user) return <Redirect href="/(auth)/phone" />;

  const unreadMessages = threads.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#E85068",
        tabBarInactiveTintColor: "#6B6B6B",
        tabBarStyle: { backgroundColor: "#1C1C1E", borderTopColor: "#2C2C2E" },
        tabBarLabelStyle: { fontWeight: "600" },
        headerStyle: { backgroundColor: "#1C1C1E" },
        headerTitleStyle: { fontWeight: "700", color: "#FFFFFF" },
        headerTintColor: "#FFFFFF",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="connect" options={{ title: "Connect" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
