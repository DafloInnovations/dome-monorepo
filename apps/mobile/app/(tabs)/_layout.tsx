import { StyleSheet, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { useAlerts } from "../../src/hooks/useAlerts";

type TabIconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  return <Ionicons name={name} size={focused ? 25 : 23} color={color} />;
}

export default function TabLayout() {
  const { user } = useAuth();
  const { pendingCount } = useAlerts();

  if (!user) return <Redirect href="/(auth)/phone" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#E85068",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#EBEBEB",
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
        // Home and Venues manage their own headers via AppHeader
        headerShown: false,
      }}
    >
      {/* 1 — Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* 2 — Venues (new) */}
      <Tabs.Screen
        name="venues"
        options={{
          title: "Venues",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "business" : "business-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* 3 — Connect */}
      <Tabs.Screen
        name="connect"
        options={{
          title: "Connect",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "people" : "people-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* 4 — Bookings */}
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* 5 — Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person-circle" : "person-circle-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden — Chats accessible from AppHeader icon */}
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "chatbubbles" : "chatbubbles-outline"} color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden — Alerts */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          href: null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "notifications" : "notifications-outline"} color={color} focused={focused} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
    </Tabs>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _styles = StyleSheet.create({});
