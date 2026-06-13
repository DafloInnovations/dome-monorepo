import { createServer } from "node:http";
import cron from "node-cron";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";
import { sendBookingReminders } from "./jobs/reminders";
import { runRecurringBookings } from "./jobs/recurring";
import { runExpireAlerts } from "./jobs/alerts";
import { sendReviewPrompts, sendEmailReviewRequests } from "./jobs/reviews";

// Fail fast if critical env vars are missing — surfaces Railway misconfig at boot instead of silent 500s at runtime
const REQUIRED_ENV = ["JWT_SECRET", "DATABASE_URL", "REDIS_URL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[fatal] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env["PORT"] ?? 3001;

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\n  Dome API  ·  http://localhost:${PORT}\n`);
});

// Daily 10:00 AM — booking reminders for next-day slots
cron.schedule("0 10 * * *", sendBookingReminders);

// Daily midnight — create + charge upcoming PAY_PER_SESSION recurring bookings
cron.schedule("0 0 * * *", runRecurringBookings);

// Daily midnight — expire stale availability alerts
cron.schedule("1 0 * * *", runExpireAlerts);

// Daily 10:00 AM — push review prompts for bookings that ended yesterday
cron.schedule("0 10 * * *", sendReviewPrompts);

// Hourly — email review requests 2h after slot end time
cron.schedule("0 * * * *", sendEmailReviewRequests);
