-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "creditsIssuedCAD" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Slot" ADD COLUMN     "courtId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditBalanceCAD" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomeCredit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "amountCAD" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomeCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Court_facilityId_idx" ON "Court"("facilityId");

-- CreateIndex
CREATE INDEX "DomeCredit_userId_idx" ON "DomeCredit"("userId");

-- CreateIndex
CREATE INDEX "DomeCredit_bookingId_idx" ON "DomeCredit"("bookingId");

-- CreateIndex
CREATE INDEX "Slot_courtId_date_idx" ON "Slot"("courtId", "date");

-- AddForeignKey
ALTER TABLE "Court" ADD CONSTRAINT "Court_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slot" ADD CONSTRAINT "Slot_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomeCredit" ADD CONSTRAINT "DomeCredit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomeCredit" ADD CONSTRAINT "DomeCredit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
