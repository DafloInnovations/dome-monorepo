import { createServer } from "node:http";
import cron from "node-cron";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";
import { sendBookingReminders } from "./jobs/reminders";

const PORT = process.env["PORT"] ?? 3001;

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`\n  Dome API  ·  http://localhost:${PORT}\n`);
});

// Daily 10:00 AM — booking reminders for next-day slots
cron.schedule("0 10 * * *", sendBookingReminders);
