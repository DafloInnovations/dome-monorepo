-- AlterTable: make Booking.slotId nullable to support walk-in POS bookings
ALTER TABLE "Booking" ALTER COLUMN "slotId" DROP NOT NULL;
