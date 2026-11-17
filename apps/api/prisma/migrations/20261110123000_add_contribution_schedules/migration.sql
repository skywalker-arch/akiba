-- Create enums for contribution scheduling and obligations
CREATE TYPE "ScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'OVERDUE', 'PAID', 'WAIVED');

-- Create schedule table
CREATE TABLE "ContributionSchedule" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "frequency" "ScheduleFrequency" NOT NULL,
  "dueDayOfWeek" INTEGER,
  "dueDayOfMonth" INTEGER,
  "graceDays" INTEGER NOT NULL DEFAULT 0,
  "startsOn" TIMESTAMP(3) NOT NULL,
  "endsOn" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionSchedule_pkey" PRIMARY KEY ("id")
);

-- Create obligations table
CREATE TABLE "ContributionObligation" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "expectedAmount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paidContributionId" TEXT,
  "waivedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContributionObligation_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "ContributionSchedule_groupId_isActive_idx" ON "ContributionSchedule"("groupId", "isActive");
CREATE INDEX "ContributionSchedule_startsOn_endsOn_idx" ON "ContributionSchedule"("startsOn", "endsOn");
CREATE INDEX "ContributionObligation_membershipId_dueDate_idx" ON "ContributionObligation"("membershipId", "dueDate");
CREATE INDEX "ContributionObligation_status_dueDate_idx" ON "ContributionObligation"("status", "dueDate");

-- Create unique constraints
CREATE UNIQUE INDEX "ContributionObligation_scheduleId_membershipId_dueDate_key"
  ON "ContributionObligation"("scheduleId", "membershipId", "dueDate");

-- Foreign keys
ALTER TABLE "ContributionSchedule"
  ADD CONSTRAINT "ContributionSchedule_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "SavingsGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionSchedule"
  ADD CONSTRAINT "ContributionSchedule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionSchedule"
  ADD CONSTRAINT "ContributionSchedule_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContributionObligation"
  ADD CONSTRAINT "ContributionObligation_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "ContributionSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionObligation"
  ADD CONSTRAINT "ContributionObligation_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "GroupMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContributionObligation"
  ADD CONSTRAINT "ContributionObligation_paidContributionId_fkey"
  FOREIGN KEY ("paidContributionId") REFERENCES "Contribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
