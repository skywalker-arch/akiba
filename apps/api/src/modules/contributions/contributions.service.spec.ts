import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { ContributionsService } from './contributions.service';

describe('ContributionsService', () => {
  const prisma = {
    groupMembership: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the authenticated user transaction history for their groups', async () => {
    const service = new ContributionsService(prisma as any);
    prisma.groupMembership.findMany.mockResolvedValue([
      { groupId: 'group-1' },
      { groupId: 'group-2' },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        type: TransactionType.CONTRIBUTION,
        status: TransactionStatus.POSTED,
        amount: 2500,
        currency: 'KES',
        occurredAt: new Date('2026-01-02T09:00:00Z'),
        description: 'Contribution to group Alpha',
        externalReference: null,
        metadata: null,
        wallet: {
          id: 'wallet-1',
          type: 'GROUP',
          groupId: 'group-1',
          group: {
            id: 'group-1',
            name: 'Alpha Group',
            code: 'ALPHA',
          },
          user: null,
          currency: 'KES',
        },
        contribution: {
          id: 'contribution-1',
          amount: 2500,
          currency: 'KES',
          membership: {
            group: { id: 'group-1', name: 'Alpha Group' },
            user: {
              id: 'user-1',
              firstName: 'Jane',
              lastName: 'Wanjiku',
              email: 'jane@example.com',
              phone: null,
            },
          },
        },
        loan: null,
        loanRepayment: null,
      },
    ]);

    const result = await service.getUserTransactions('user-1', {
      type: 'CONTRIBUTION',
    });

    expect(prisma.groupMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          status: { not: MembershipStatus.LEFT },
        }),
      }),
    );
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: TransactionType.CONTRIBUTION,
          wallet: expect.objectContaining({
            groupId: { in: ['group-1', 'group-2'] },
          }),
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].wallet.group?.name).toBe('Alpha Group');
  });

  it('rejects invalid transaction filters that are not supported', async () => {
    const service = new ContributionsService(prisma as any);

    await expect(
      service.getUserTransactions('user-1', {
        type: 'NOT_A_REAL_TYPE',
      } as any),
    ).rejects.toThrow(ForbiddenException);
  });
});
