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
    const inAuth       = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inTabs       = segments[0] === "(tabs)";

    /*
     * AUTH FLOW:
     *
     * First time / logged-out user:
     *   app open → no token → /(auth)/phone
     *
     * After OTP verification (handled by otp.tsx):
     *   isNewUser / !profileComplete → /onboarding/profile-setup
     *   profileComplete              → /(tabs)
     *
     * Returning user (token present, profile complete):
     *   app open → hydrate restores user → /(tabs)
     *
     * Returning user (token present, profile incomplete):
     *   app open → hydrate restores user → /(tabs) with profile banner
     *   (otp.tsx already routed them to setup during the session they signed up)
     */
    if (!user && !inAuth) {
      // No session → always go to login
      router.replace("/(auth)/phone");
    } else if (user && inAuth) {
      // Just finished OTP — route based on profile state
      if (!user.profileComplete) {
        router.replace("/onboarding/profile-setup");
      } else {
        router.replace("/(tabs)");
      }
    } else if (user && !inAuth && !inOnboarding && !inTabs) {
      // Hydrated user landing on an unknown/stale segment → push to tabs
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#E85068" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding/profile-setup"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="facility/[facilityId]"
          options={{
            headerShown: true,
            title: "Facility",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0A0A0A",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="booking/[slotId]"
          options={{
            headerShown: true,
            title: "Confirm Booking",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0A0A0A",
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
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0A0A0A",
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
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0A0A0A",
            headerTitleStyle: { fontWeight: "700" },
          }}
        />
        <Stack.Screen
          name="review/facility/[facilityId]"
          options={{
            headerShown: true,
            title: "Reviews",
            headerBackTitle: "Back",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#0A0A0A",
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
