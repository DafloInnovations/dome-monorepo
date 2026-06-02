import admin from "firebase-admin";
import { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

// Initialise once — safe to call multiple times across hot-reloads
if (!admin.apps.length) {
  const privateKey = (process.env["FIREBASE_PRIVATE_KEY"] ?? "").replace(/\\n/g, "\n");

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env["FIREBASE_PROJECT_ID"],
      privateKey,
      clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
    }),
  });
}

type NotifData = Record<string, string>;

// ─── DB persistence ───────────────────────────────────────────────────────────

export async function saveNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: NotifData
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body, data: data ?? null, isRead: false },
    });
  } catch (err) {
    console.error("[Notification] DB save failed:", (err as Error).message);
  }
}

// ─── Push delivery ────────────────────────────────────────────────────────────

/**
 * Send a push notification to a single device token AND persist it in the DB.
 * Silently swallows delivery errors so callers never fail on notification issues.
 */
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: NotifData
): Promise<void> {
  if (!token) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      ...(data && { data }),
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
      android: { notification: { sound: "default", color: "#E85068" } },
    });
  } catch (err) {
    console.error("[FCM] sendPushNotification failed:", (err as Error).message);
  }
}

/**
 * Fan-out a notification to multiple device tokens.
 * Invalid / stale tokens are reported but don't throw.
 */
export async function sendMultiplePushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: NotifData
): Promise<void> {
  const valid = tokens.filter(Boolean);
  if (!valid.length) return;
  try {
    const result = await admin.messaging().sendEachForMulticast({
      tokens: valid,
      notification: { title, body },
      ...(data && { data }),
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
      android: { notification: { sound: "default", color: "#E85068" } },
    });
    const failed = result.responses.filter((r) => !r.success);
    if (failed.length) {
      console.error(`[FCM] ${failed.length}/${valid.length} notifications failed`);
    }
  } catch (err) {
    console.error("[FCM] sendMultiplePushNotifications failed:", (err as Error).message);
  }
}
