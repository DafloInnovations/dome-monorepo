-- AlterTable: add shared-court fields to Court
ALTER TABLE "Court" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Court" ADD COLUMN "sports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Court" ADD COLUMN "primarySport" TEXT;

-- AlterTable: add multi-sport fields to Slot
ALTER TABLE "Slot" ADD COLUMN "sport" TEXT;
ALTER TABLE "Slot" ADD COLUMN "linkedSlotIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Slot" ADD COLUMN "blockReason" TEXT;

-- CreateTable: per-sport pricing on shared courts
CREATE TABLE "CourtSportPricing" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "priceCAD" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "CourtSportPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtSportPricing_courtId_idx" ON "CourtSportPricing"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtSportPricing_courtId_sport_key" ON "CourtSportPricing"("courtId", "sport");

-- AddForeignKey
ALTER TABLE "CourtSportPricing" ADD CONSTRAINT "CourtSportPricing_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
