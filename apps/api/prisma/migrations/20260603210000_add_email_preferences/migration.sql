-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailBookingConfirmation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "emailMarketing" BOOLEAN NOT NULL DEFAULT false;
