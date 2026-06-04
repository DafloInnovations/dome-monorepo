-- Fully idempotent rewrite — safe to re-run after a partial application.
-- Original migration failed mid-run (no transaction wrapper due to ALTER TYPE ADD VALUE).
-- Every statement is now guarded against already-existing objects.

-- ─── Create enums (if not already created) ───────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM (
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER',
    'JOIN_REQUEST', 'PLAYER_CONFIRMED', 'PLAYER_DECLINED',
    'NEW_MESSAGE', 'GAME_FULL', 'GAME_CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlayerStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingUnitType" AS ENUM ('COURT', 'LANE', 'TEE_TIME', 'SESSION', 'PASS', 'TABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingModel" AS ENUM ('SLOT_BASED', 'TEE_TIME', 'SESSION', 'OPEN_PLAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GroupBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'PARTIAL_CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Extend existing enums ────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ROOKIE' AND enumtypid = 'public."SkillLevel"'::regtype) THEN
    ALTER TYPE "SkillLevel" ADD VALUE 'ROOKIE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRO' AND enumtypid = 'public."SkillLevel"'::regtype) THEN
    ALTER TYPE "SkillLevel" ADD VALUE 'PRO';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ELITE' AND enumtypid = 'public."SkillLevel"'::regtype) THEN
    ALTER TYPE "SkillLevel" ADD VALUE 'ELITE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'HELD' AND enumtypid = 'public."SlotStatus"'::regtype) THEN
    ALTER TYPE "SlotStatus" ADD VALUE 'HELD';
  END IF;
END $$;

-- ─── Drop foreign keys (IF EXISTS) ───────────────────────────────────────────

ALTER TABLE "OpenGame" DROP CONSTRAINT IF EXISTS "OpenGame_slotId_fkey";
ALTER TABLE "Payment"  DROP CONSTRAINT IF EXISTS "Payment_bookingId_fkey";

-- ─── Drop old unique index (IF EXISTS) ───────────────────────────────────────

DROP INDEX IF EXISTS "Booking_slotId_key";

-- ─── Add columns (IF NOT EXISTS) ─────────────────────────────────────────────

ALTER TABLE "Booking"             ADD COLUMN IF NOT EXISTS "bookingGroupId" TEXT;
ALTER TABLE "Court"               ADD COLUMN IF NOT EXISTS "maxPlayers"     INTEGER;
ALTER TABLE "Court"               ADD COLUMN IF NOT EXISTS "unitLabel"      TEXT NOT NULL DEFAULT 'Court';
ALTER TABLE "Court"               ADD COLUMN IF NOT EXISTS "unitType"       "BookingUnitType" NOT NULL DEFAULT 'COURT';
ALTER TABLE "Facility"            ADD COLUMN IF NOT EXISTS "bookingModel"   "BookingModel" NOT NULL DEFAULT 'SLOT_BASED';
ALTER TABLE "OpenGame"            ADD COLUMN IF NOT EXISTS "endTime"        TEXT;
ALTER TABLE "OpenGame"            ADD COLUMN IF NOT EXISTS "gameDate"       DATE;
ALTER TABLE "OpenGame"            ADD COLUMN IF NOT EXISTS "playersConfirmed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OpenGame"            ADD COLUMN IF NOT EXISTS "playersNeeded"  INTEGER;
ALTER TABLE "OpenGame"            ADD COLUMN IF NOT EXISTS "startTime"      TEXT;
ALTER TABLE "OpenGameParticipant" ADD COLUMN IF NOT EXISTS "confirmedAt"    TIMESTAMP(3);
ALTER TABLE "OpenGameParticipant" ADD COLUMN IF NOT EXISTS "status"        "PlayerStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Payment"             ADD COLUMN IF NOT EXISTS "bookingGroupId" TEXT;
ALTER TABLE "Slot"                ADD COLUMN IF NOT EXISTS "capacity"       INTEGER;
ALTER TABLE "Slot"                ADD COLUMN IF NOT EXISTS "isOpenPlay"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Slot"                ADD COLUMN IF NOT EXISTS "spotsBooked"    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User"                ADD COLUMN IF NOT EXISTS "deviceToken"    TEXT;

-- ─── Nullable alterations (idempotent) ───────────────────────────────────────

ALTER TABLE "OpenGame" ALTER COLUMN "slotId"             DROP NOT NULL;
ALTER TABLE "OpenGame" ALTER COLUMN "title"              DROP NOT NULL;
ALTER TABLE "OpenGame" ALTER COLUMN "maxPlayers"         SET DEFAULT 2;
ALTER TABLE "OpenGame" ALTER COLUMN "pricePerPlayerCAD"  DROP NOT NULL;
ALTER TABLE "Payment"  ALTER COLUMN "bookingId"          DROP NOT NULL;

-- ─── Create tables (IF NOT EXISTS) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "BookingGroup" (
    "id"              TEXT            NOT NULL,
    "userId"          TEXT            NOT NULL,
    "facilityId"      TEXT            NOT NULL,
    "totalCAD"        DECIMAL(10,2)   NOT NULL,
    "subtotalCAD"     DECIMAL(10,2)   NOT NULL,
    "taxCAD"          DECIMAL(10,2)   NOT NULL,
    "status"          "GroupBookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus"   "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        TEXT            NOT NULL,
    "userId"    TEXT            NOT NULL,
    "type"      "NotificationType" NOT NULL,
    "title"     TEXT            NOT NULL,
    "body"      TEXT            NOT NULL,
    "data"      JSONB,
    "isRead"    BOOLEAN         NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- ─── Create indexes (IF NOT EXISTS) ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "BookingGroup_userId_idx"    ON "BookingGroup"("userId");
CREATE INDEX IF NOT EXISTS "BookingGroup_facilityId_idx" ON "BookingGroup"("facilityId");
CREATE INDEX IF NOT EXISTS "BookingGroup_status_idx"    ON "BookingGroup"("status");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx"    ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Booking_bookingGroupId_idx" ON "Booking"("bookingGroupId");
CREATE INDEX IF NOT EXISTS "OpenGame_gameDate_idx"      ON "OpenGame"("gameDate");

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_slotId_userId_key"    ON "Booking"("slotId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_bookingGroupId_key"   ON "Payment"("bookingGroupId");

-- ─── Add foreign keys (IF NOT EXISTS) ────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingGroupId_fkey"
    FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingGroupId_fkey"
    FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OpenGame" ADD CONSTRAINT "OpenGame_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
