-- AlterTable: add booking duration rules to Court
ALTER TABLE "Court" ADD COLUMN "minBookingMinutes"   INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Court" ADD COLUMN "durationStepMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Court" ADD COLUMN "maxBookingMinutes"   INTEGER NOT NULL DEFAULT 180;
