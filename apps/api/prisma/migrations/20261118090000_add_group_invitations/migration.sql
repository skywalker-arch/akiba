-- CreateEnum
CREATE TYPE "GroupInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "status" "GroupInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "pendingKey" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_tokenHash_key" ON "GroupInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvitation_pendingKey_key" ON "GroupInvitation"("pendingKey");

-- CreateIndex
CREATE INDEX "GroupInvitation_groupId_status_createdAt_idx" ON "GroupInvitation"("groupId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GroupInvitation_groupId_invitedEmail_idx" ON "GroupInvitation"("groupId", "invitedEmail");

-- CreateIndex
CREATE INDEX "GroupInvitation_invitedEmail_status_idx" ON "GroupInvitation"("invitedEmail", "status");

-- CreateIndex
CREATE INDEX "GroupInvitation_expiresAt_status_idx" ON "GroupInvitation"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "SavingsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
