import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";

export default function TabLayout() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/(auth)/phone" />;

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
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="open-games" options={{ title: "Open Games" }} />
      <Tabs.Screen name="bookings" options={{ title: "My Bookings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
