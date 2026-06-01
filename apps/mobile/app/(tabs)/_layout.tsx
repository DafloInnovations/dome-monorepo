import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";

export default function TabLayout() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/(auth)/phone" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: { borderTopColor: "#f3f4f6" },
        headerStyle: { backgroundColor: "#fff" },
        headerTitleStyle: { fontWeight: "700" },
        headerTintColor: "#111827",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="open-games" options={{ title: "Open Games" }} />
      <Tabs.Screen name="bookings" options={{ title: "My Bookings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
