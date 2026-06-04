-- AlterTable: add equipment fields to Booking
ALTER TABLE "Booking" ADD COLUMN "equipmentTotalCAD" DECIMAL(10,2);
ALTER TABLE "Booking" ADD COLUMN "paymentIntentId" TEXT;

-- CreateTable: Equipment
CREATE TABLE "Equipment" (
    "id"          TEXT NOT NULL,
    "facilityId"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "sport"       TEXT NOT NULL,
    "priceCAD"    DECIMAL(10,2) NOT NULL,
    "quantity"    INTEGER NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "imageUrl"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EquipmentRental
CREATE TABLE "EquipmentRental" (
    "id"          TEXT NOT NULL,
    "bookingId"   TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "quantity"    INTEGER NOT NULL DEFAULT 1,
    "priceCAD"    DECIMAL(10,2) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentRental_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Equipment_facilityId_isActive_idx" ON "Equipment"("facilityId", "isActive");
CREATE INDEX "EquipmentRental_bookingId_idx" ON "EquipmentRental"("bookingId");
CREATE INDEX "EquipmentRental_equipmentId_idx" ON "EquipmentRental"("equipmentId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_facilityId_fkey"
    FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentRental" ADD CONSTRAINT "EquipmentRental_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EquipmentRental" ADD CONSTRAINT "EquipmentRental_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
