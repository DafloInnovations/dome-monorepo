import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "../src/lib/stripe";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { SocketProvider } from "../src/context/SocketContext";
import { NotificationsProvider } from "../src/context/NotificationsContext";
import { usePushNotifications } from "../src/hooks/usePushNotifications";
import { STRIPE_PUBLISHABLE_KEY } from "../src/config/stripe";

function RootNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) {
      router.replace("/(auth)/phone");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#E85068" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="facility/[facilityId]"
          options={{
            headerShown: true,
            title: "Facility",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#1C1C1E" },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="booking/[slotId]"
          options={{
            headerShown: true,
            title: "Confirm Booking",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#1C1C1E" },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="booking/time-based"
          options={{ title: "Confirm Booking", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="booking/recurring-confirm"
          options={{ title: "Recurring Booking", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="bookings/recurring"
          options={{ title: "Recurring Series", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="booking/success"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="open-game/[id]"
          options={{
            headerShown: true,
            title: "Open Game",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#1C1C1E" },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen name="booking/cancel/[bookingId]" options={{ headerShown: false }} />
        <Stack.Screen name="connect/post-game" options={{ headerShown: false }} />
        <Stack.Screen name="connect/game/[gameId]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[threadId]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/index" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen
          name="review/[bookingId]"
          options={{
            headerShown: true,
            title: "Write a Review",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#1C1C1E" },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="review/facility/[facilityId]"
          options={{
            headerShown: true,
            title: "Reviews",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#1C1C1E" },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <AuthProvider>
        <SocketProvider>
          <NotificationsProvider>
            <RootNav />
          </NotificationsProvider>
        </SocketProvider>
      </AuthProvider>
    </StripeProvider>
  );
}
