-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurringPaymentModel" AS ENUM ('PAY_PER_SESSION', 'PAY_UPFRONT');

-- CreateEnum
CREATE TYPE "RecurringSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "recurringSeriesId" TEXT,
ADD COLUMN     "recurringSeriesIndex" INTEGER;

-- CreateTable
CREATE TABLE "RecurringSeries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "daysOfWeek" INTEGER[],
    "totalOccurrences" INTEGER NOT NULL,
    "completedOccurrences" INTEGER NOT NULL DEFAULT 0,
    "cancelledOccurrences" INTEGER NOT NULL DEFAULT 0,
    "pricePerSessionCAD" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "paymentModel" "RecurringPaymentModel" NOT NULL,
    "paymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "stripePaymentMethodId" TEXT,
    "status" "RecurringSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringSeries_userId_idx" ON "RecurringSeries"("userId");

-- CreateIndex
CREATE INDEX "RecurringSeries_facilityId_idx" ON "RecurringSeries"("facilityId");

-- CreateIndex
CREATE INDEX "RecurringSeries_courtId_idx" ON "RecurringSeries"("courtId");

-- CreateIndex
CREATE INDEX "RecurringSeries_status_idx" ON "RecurringSeries"("status");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_recurringSeriesId_fkey" FOREIGN KEY ("recurringSeriesId") REFERENCES "RecurringSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSeries" ADD CONSTRAINT "RecurringSeries_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
