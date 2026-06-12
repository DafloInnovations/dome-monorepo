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
  // Register express.raw() BEFORE express.json() and use type:"*/*" so the body
  // is always captured as a Buffer regardless of Content-Type charset variants.
  app.use("/api/v1/payments/webhook", express.raw({ type: "*/*" }));
  app.use(express.json({ limit: "20mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", env: process.env["NODE_ENV"], ts: new Date().toISOString() });
  });

  // Player-facing success page — Stripe payment links redirect here after payment
  app.get("/payment-success", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Successful — Dome</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #FFFFFF;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 400px;
      width: 100%;
      text-align: center;
      padding: 48px 32px;
      border-radius: 24px;
      box-shadow: 0 4px 32px rgba(0,0,0,0.08);
      border: 1px solid #F0F0F0;
    }
    .icon {
      width: 96px;
      height: 96px;
      background: #F0FFF4;
      border-radius: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 48px;
      animation: pop 0.4s ease;
    }
    @keyframes pop {
      0%   { transform: scale(0); opacity: 0; }
      80%  { transform: scale(1.1); }
      100% { transform: scale(1);   opacity: 1; }
    }
    h1 { font-size: 28px; font-weight: 900; color: #22C55E; margin-bottom: 8px; letter-spacing: -0.5px; }
    .subtitle { font-size: 16px; color: #6B6B6B; margin-bottom: 32px; line-height: 1.5; }
    .brand { font-size: 14px; color: #9E9E9E; margin-top: 32px; }
    .brand span { color: #E85068; font-weight: 700; }
    .download {
      display: inline-block;
      margin-top: 24px;
      padding: 14px 28px;
      background: #E85068;
      color: white;
      border-radius: 12px;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment Successful!</h1>
    <p class="subtitle">Your court is confirmed.<br/>You're all set to play!</p>
    <a href="https://dome.app" class="download">Download the Dome App</a>
    <p class="brand">Powered by <span>DOME</span> Sports</p>
  </div>
</body>
</html>`);
  });

  app.use("/api/v1", router);

  app.use(errorHandler);

  return app;
}
