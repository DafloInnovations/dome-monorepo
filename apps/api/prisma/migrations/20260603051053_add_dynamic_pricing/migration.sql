-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('TIME_OF_DAY', 'DAY_OF_WEEK', 'PEAK_HOURS', 'SEASONAL', 'EARLY_BIRD');

-- CreateEnum
CREATE TYPE "PriceAdjustmentType" AS ENUM ('PERCENTAGE_INCREASE', 'PERCENTAGE_DECREASE', 'FIXED_INCREASE', 'FIXED_DECREASE', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "DateOverrideType" AS ENUM ('CUSTOM_PRICE', 'BLOCKED', 'FREE');

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PricingRuleType" NOT NULL,
    "daysOfWeek" INTEGER[],
    "startTime" TEXT,
    "endTime" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "adjustmentType" "PriceAdjustmentType" NOT NULL,
    "adjustmentValue" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateOverride" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "DateOverrideType" NOT NULL,
    "customPriceCAD" DECIMAL(10,2),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingRule_courtId_isActive_idx" ON "PricingRule"("courtId", "isActive");

-- CreateIndex
CREATE INDEX "DateOverride_courtId_idx" ON "DateOverride"("courtId");

-- CreateIndex
CREATE UNIQUE INDEX "DateOverride_courtId_date_key" ON "DateOverride"("courtId", "date");

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateOverride" ADD CONSTRAINT "DateOverride_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;
