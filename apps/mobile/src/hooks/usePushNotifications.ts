import { useEffect, useRef } from "react";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useAuthToken } from "./useAuthToken";

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001/api/v1";

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type NotifData = Record<string, string>;

function handleNavigation(data: NotifData, router: ReturnType<typeof useRouter>) {
  const { type, threadId, gameId, facilityId, date, startTime } = data;
  switch (type) {
    case "new_message":
      if (threadId) router.push({ pathname: "/chat/[threadId]", params: { threadId } });
      break;
    case "join_request":
    case "player_confirmed":
    case "player_declined":
      if (gameId) router.push({ pathname: "/connect/game/[gameId]", params: { gameId } });
      break;
    case "booking_confirmed":
      router.push("/(tabs)/bookings");
      break;
    case "REVIEW_PROMPT":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router as any).push({
        pathname: "/(tabs)/bookings",
        params: { tab: "past", highlightBookingId: data.bookingId ?? "" },
      });
      break;
    case "AVAILABILITY_ALERT":
      if (facilityId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (router as any).push({
          pathname: "/facility/[facilityId]",
          params: {
            facilityId,
            ...(date ? { preSelectedDate: date } : {}),
            ...(startTime ? { preSelectedTime: startTime } : {}),
          },
        });
      } else {
        router.push("/(tabs)/alerts");
      }
      break;
  }
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications require a physical device
    return null;
  }

  type PermStatus = { status: string; granted?: boolean };
  const existing = await Notifications.getPermissionsAsync() as unknown as PermStatus;
  let isGranted = existing.granted ?? existing.status === "granted";

  if (!isGranted) {
    const result = await Notifications.requestPermissionsAsync() as unknown as PermStatus;
    isGranted = result.granted ?? result.status === "granted";
  }

  if (!isGranted) return null;

  // Android requires a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Dome",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#E85068",
    });
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: process.env["EXPO_PUBLIC_EXPO_PROJECT_ID"],
  });

  return token.data;
}

async function saveDeviceToken(token: string, getValidToken: () => Promise<string>) {
  try {
    const authToken = await getValidToken();
    await fetch(`${API_URL}/users/me/device-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Non-fatal — next app start will retry
  }
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { getValidToken } = useAuthToken();
  const router = useRouter();
  const foregroundSub = useRef<Notifications.Subscription | null>(null);
  const responseSub = useRef<Notifications.Subscription | null>(null);

  // Register and upload token when user logs in
  useEffect(() => {
    if (!user) return;

    registerForPushNotifications().then((token) => {
      if (token) saveDeviceToken(token, getValidToken);
    });

    // Foreground notification received (display is handled by setNotificationHandler above)
    foregroundSub.current = Notifications.addNotificationReceivedListener(() => {
      // Nothing extra needed — the system will show the alert
    });

    // User tapped a notification
    responseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotifData;
      handleNavigation(data, router);
    });

    return () => {
      foregroundSub.current?.remove();
      responseSub.current?.remove();
    };
  }, [user, getValidToken, router]);

  // Handle the case where the app was launched cold from a notification tap
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as NotifData;
      handleNavigation(data, router);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
