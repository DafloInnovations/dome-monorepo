/*
  Warnings:

  - A unique constraint covering the columns `[slotId,userId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bookingGroupId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'BOOKING_REMINDER', 'JOIN_REQUEST', 'PLAYER_CONFIRMED', 'PLAYER_DECLINED', 'NEW_MESSAGE', 'GAME_FULL', 'GAME_CANCELLED');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "BookingUnitType" AS ENUM ('COURT', 'LANE', 'TEE_TIME', 'SESSION', 'PASS', 'TABLE');

-- CreateEnum
CREATE TYPE "BookingModel" AS ENUM ('SLOT_BASED', 'TEE_TIME', 'SESSION', 'OPEN_PLAY');

-- CreateEnum
CREATE TYPE "GroupBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'PARTIAL_CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SkillLevel" ADD VALUE 'ROOKIE';
ALTER TYPE "SkillLevel" ADD VALUE 'PRO';
ALTER TYPE "SkillLevel" ADD VALUE 'ELITE';

-- AlterEnum
ALTER TYPE "SlotStatus" ADD VALUE 'HELD';

-- DropForeignKey
ALTER TABLE "OpenGame" DROP CONSTRAINT "OpenGame_slotId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_bookingId_fkey";

-- DropIndex
DROP INDEX "Booking_slotId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bookingGroupId" TEXT;

-- AlterTable
ALTER TABLE "Court" ADD COLUMN     "maxPlayers" INTEGER,
ADD COLUMN     "unitLabel" TEXT NOT NULL DEFAULT 'Court',
ADD COLUMN     "unitType" "BookingUnitType" NOT NULL DEFAULT 'COURT';

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "bookingModel" "BookingModel" NOT NULL DEFAULT 'SLOT_BASED';

-- AlterTable
ALTER TABLE "OpenGame" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "gameDate" DATE,
ADD COLUMN     "playersConfirmed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "playersNeeded" INTEGER,
ADD COLUMN     "startTime" TEXT,
ALTER COLUMN "slotId" DROP NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ALTER COLUMN "maxPlayers" SET DEFAULT 2,
ALTER COLUMN "pricePerPlayerCAD" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OpenGameParticipant" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PlayerStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bookingGroupId" TEXT,
ALTER COLUMN "bookingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "isOpenPlay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spotsBooked" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceToken" TEXT;

-- CreateTable
CREATE TABLE "BookingGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "totalCAD" DECIMAL(10,2) NOT NULL,
    "subtotalCAD" DECIMAL(10,2) NOT NULL,
    "taxCAD" DECIMAL(10,2) NOT NULL,
    "status" "GroupBookingStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingGroup_userId_idx" ON "BookingGroup"("userId");

-- CreateIndex
CREATE INDEX "BookingGroup_facilityId_idx" ON "BookingGroup"("facilityId");

-- CreateIndex
CREATE INDEX "BookingGroup_status_idx" ON "BookingGroup"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Booking_bookingGroupId_idx" ON "Booking"("bookingGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_slotId_userId_key" ON "Booking"("slotId", "userId");

-- CreateIndex
CREATE INDEX "OpenGame_gameDate_idx" ON "OpenGame"("gameDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingGroupId_key" ON "Payment"("bookingGroupId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGroup" ADD CONSTRAINT "BookingGroup_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "BookingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenGame" ADD CONSTRAINT "OpenGame_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
