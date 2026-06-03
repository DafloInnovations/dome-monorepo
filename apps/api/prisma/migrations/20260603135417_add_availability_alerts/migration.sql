-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'TRIGGERED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AVAILABILITY_ALERT';

-- CreateTable
CREATE TABLE "AvailabilityAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "courtId" TEXT,
    "sport" TEXT,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityAlert_facilityId_date_status_idx" ON "AvailabilityAlert"("facilityId", "date", "status");

-- CreateIndex
CREATE INDEX "AvailabilityAlert_userId_status_idx" ON "AvailabilityAlert"("userId", "status");

-- CreateIndex
CREATE INDEX "AvailabilityAlert_expiresAt_status_idx" ON "AvailabilityAlert"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityAlert_userId_facilityId_date_startTime_endTime_key" ON "AvailabilityAlert"("userId", "facilityId", "date", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "AvailabilityAlert" ADD CONSTRAINT "AvailabilityAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityAlert" ADD CONSTRAINT "AvailabilityAlert_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityAlert" ADD CONSTRAINT "AvailabilityAlert_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;
