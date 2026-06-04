# Dome — Sports Facility Booking Platform (Canada)

Dome is a full-stack monorepo for booking sports facilities across Canada. Players discover and book courts/fields, vendors manage their venues, and admins oversee the platform.

## Monorepo Structure

```
dome-monorepo/
├── apps/
│   ├── api/        Node.js + Express REST API
│   ├── web/        Player-facing web app (Next.js 14)
│   ├── admin/      Admin dashboard (Next.js 14)
│   ├── vendor/     Vendor portal (Next.js 14)
│   └── mobile/     Player mobile app (React Native + Expo)
└── packages/
    ├── types/      Shared TypeScript types
    ├── utils/      Date, CAD currency & validation helpers
    ├── api-client/ Typed fetch wrapper for all API routes
    └── config/     Shared ESLint, TypeScript & Tailwind configs
```

## App URLs (dev)

| App | URL |
|---|---|
| API | http://localhost:3001 |
| Web | http://localhost:3000 |
| Admin | http://localhost:3002 |
| Vendor | http://localhost:3003 |
| Mobile | Expo Go / iOS simulator / Android emulator |

## Prerequisites

- **Node.js** ≥ 20 — [nodejs.org](https://nodejs.org)
- **pnpm** ≥ 9 — `npm i -g pnpm@9`
- **Expo CLI** (mobile only) — `npm i -g expo-cli`

## Quick Start

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Copy and fill in environment files
cp apps/api/.env.example    apps/api/.env
cp apps/web/.env.example    apps/web/.env.local
cp apps/admin/.env.example  apps/admin/.env.local
cp apps/vendor/.env.example apps/vendor/.env.local
cp apps/mobile/.env.example apps/mobile/.env

# 3. Run all apps in parallel dev mode
pnpm dev
```

## Running Individual Apps

```bash
pnpm --filter=@dome/api     dev
pnpm --filter=@dome/web     dev
pnpm --filter=@dome/admin   dev
pnpm --filter=@dome/vendor  dev
pnpm --filter=@dome/mobile  start
```

## Build

```bash
pnpm build
```

## Type Checking

```bash
pnpm type-check
```

## Linting

```bash
pnpm lint
```

## Key Domain Concepts

| Concept | Description |
|---|---|
| **Facility** | A venue (arena, court complex) with one or more bookable surfaces |
| **Slot** | A bookable time window at a facility with a CAD price |
| **Booking** | A confirmed reservation of a slot by a user |
| **Open Game** | A public session where any player can join and split the cost |
| **Vendor** | A facility owner/operator registered on the platform |
| **Review** | A post-booking rating (1–5) left by a verified player |

## Canadian Tax Handling

Taxes are calculated per-province at checkout. The `@dome/utils` `calculateTax` helper applies the correct combined rate:

| Province | Rate | Type |
|---|---|---|
| AB | 5% | GST |
| BC | 12% | GST + PST |
| MB | 12% | GST + PST |
| NB / NL / NS / PE | 15% | HST |
| NT / NU / YT | 5% | GST |
| ON | 13% | HST |
| QC | 14.975% | GST + QST |
| SK | 11% | GST + PST |

## Tech Stack

- **API** — Express 4, Zod validation, JWT auth, TypeScript
- **Web / Admin / Vendor** — Next.js 14 App Router, Tailwind CSS
- **Mobile** — Expo SDK 52, Expo Router v4, React Native
- **Shared** — Turborepo, pnpm workspaces, TypeScript 5.7

## Payments

Stripe is used for card processing and vendor payouts. Each vendor must connect a Stripe Express account. See `apps/api/.env.example` for required keys..
