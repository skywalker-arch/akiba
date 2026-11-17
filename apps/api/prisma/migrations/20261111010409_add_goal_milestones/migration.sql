-- CreateTable
CREATE TABLE "SavingsGoalMilestone" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoalMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsGoalMilestone_goalId_dueDate_idx" ON "SavingsGoalMilestone"("goalId", "dueDate");

-- CreateIndex
CREATE INDEX "SavingsGoalMilestone_createdById_idx" ON "SavingsGoalMilestone"("createdById");


ALTER TABLE "SavingsGoalMilestone" ADD CONSTRAINT "SavingsGoalMilestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
