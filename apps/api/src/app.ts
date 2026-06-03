import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/error";
import { router } from "./routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? "*",
      credentials: true,
    })
  );
  app.use(morgan(process.env["NODE_ENV"] === "production" ? "combined" : "dev"));

  // Stripe webhook needs the raw body for signature verification.
  // Register express.raw() BEFORE express.json() — body-parser skips re-parsing
  // once req._body is set, so other routes are unaffected.
  app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));
  app.use(express.json({ limit: "20mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: process.env["NODE_ENV"], ts: new Date().toISOString() });
  });

  app.use("/api/v1", router);

  app.use(errorHandler);

  return app;
}
