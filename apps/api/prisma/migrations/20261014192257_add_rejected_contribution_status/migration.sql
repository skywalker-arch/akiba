-- AlterEnum
ALTER TYPE "ContributionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
