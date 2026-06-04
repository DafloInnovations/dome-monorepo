import { BookingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification, saveNotification } from "../lib/firebase";
import { sendBookingReminder } from "../lib/email";

export async function sendBookingReminders(): Promise<void> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const nextDay = new Date(tomorrow);
  nextDay.setDate(nextDay.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      slot: { date: { gte: tomorrow, lt: nextDay } },
    },
    include: {
      user: { select: { deviceToken: true, email: true, emailReminders: true } },
      slot: { select: { startTime: true, endTime: true } },
      facility: {
        select: {
          name: true,
          sport: true,
          address: { select: { street: true, city: true, province: true, lat: true, lng: true } },
        },
      },
    },
  });

  for (const booking of bookings) {
    const sport =
      booking.facility.sport.charAt(0) +
      booking.facility.sport.slice(1).toLowerCase();
    const rTitle = "Game Tomorrow! 🏟️";
    const rBody = `${sport} at ${booking.facility.name} at ${booking.slot.startTime}`;
    const rData = { type: "booking_reminder", bookingId: booking.id };
    await saveNotification(booking.userId, "BOOKING_REMINDER", rTitle, rBody, rData);
    if (booking.user.deviceToken) {
      await sendPushNotification(booking.user.deviceToken, rTitle, rBody, rData);
    }

    // Email reminder
    if (booking.user.email && booking.user.emailReminders) {
      const addr = booking.facility.address;
      const addrStr = addr
        ? `${addr.street}, ${addr.city}, ${addr.province}`
        : booking.facility.name;
      const mapsUrl = addr?.lat && addr?.lng
        ? `https://maps.google.com/?q=${addr.lat},${addr.lng}`
        : undefined;
      // tomorrow's date formatted
      const dateStr = tomorrow.toLocaleDateString("en-CA", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      sendBookingReminder(booking.user.email, {
        facilityName: booking.facility.name,
        facilityAddress: addrStr,
        sport: booking.facility.sport,
        date: dateStr,
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
        mapsUrl,
        bookingId: booking.id,
      }).catch(() => null);
    }
  }

  console.log(`[reminders] sent ${bookings.length} booking reminder(s)`);
}
