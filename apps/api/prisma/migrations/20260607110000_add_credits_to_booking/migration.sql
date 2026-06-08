-- AlterTable: add credits columns to Booking
ALTER TABLE "Booking" ADD COLUMN "creditsAppliedCAD" DECIMAL(10,2);
ALTER TABLE "Booking" ADD COLUMN "cardChargeCAD"     DECIMAL(10,2);
