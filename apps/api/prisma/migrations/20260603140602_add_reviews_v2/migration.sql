/*
  Warnings:

  - You are about to drop the column `comment` on the `Review` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Review_facilityId_idx";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "comment",
ADD COLUMN     "body" TEXT,
ADD COLUMN     "cleanliness" INTEGER,
ADD COLUMN     "courtQuality" INTEGER,
ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sport" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "staffFriendly" INTEGER,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "valueForMoney" INTEGER;

-- CreateIndex
CREATE INDEX "Review_facilityId_isVisible_idx" ON "Review"("facilityId", "isVisible");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");
