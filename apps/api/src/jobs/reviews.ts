import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";

// Runs daily — finds confirmed bookings from yesterday with no review and sends a prompt.
export async function sendReviewPrompts(): Promise<void> {
  console.log("[Reviews] Sending review prompts…");
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dayStr = yesterday.toISOString().split("T")[0]!;
    const dayDate = new Date(dayStr + "T00:00:00.000Z");
    const nextDay = new Date(dayStr + "T00:00:00.000Z");
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        slot: { date: { gte: dayDate, lt: nextDay } },
        review: null,
      },
      include: {
        user: { select: { id: true, deviceToken: true } },
        facility: { select: { name: true, sport: true } },
      },
      take: 500,
    });

    let sent = 0;
    for (const booking of bookings) {
      const sport = booking.facility.sport.charAt(0).toUpperCase() + booking.facility.sport.slice(1).toLowerCase();
      const title = "How was your game? ⭐";
      const body = `Rate your ${sport} experience at ${booking.facility.name}`;
      const data = { type: "REVIEW_PROMPT", bookingId: booking.id };
      await saveNotification(booking.user.id, "BOOKING_CONFIRMED", title, body, data);
      if (booking.user.deviceToken) {
        await sendPushNotification(booking.user.deviceToken, title, body, data);
        sent++;
      }
    }
    console.log(`[Reviews] Sent ${sent} review prompt(s) for ${bookings.length} eligible booking(s).`);
  } catch (err) {
    console.error("[Reviews] sendReviewPrompts failed:", err);
  }
}
