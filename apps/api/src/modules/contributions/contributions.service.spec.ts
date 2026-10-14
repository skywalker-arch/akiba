import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ContributionStatus,
  MembershipRole,
  MembershipStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { ContributionsService } from './contributions.service';

describe('ContributionsService', () => {
  const prisma = {
    $transaction: jest.fn(),
    groupMembership: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    contribution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    wallet: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
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

  it('creates a valid contribution in a pending state without crediting the wallet', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.ACTIVE,
      group: { id: 'group-1', name: 'Alpha Group' },
    });
    prisma.contribution.findUnique.mockResolvedValue(null);
    prisma.contribution.create.mockResolvedValue({
      id: 'contribution-1',
      membershipId: 'membership-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.PENDING,
      contributedAt: new Date('2026-01-02T09:00:00Z'),
      reference: 'MPESA-123',
      notes: null,
    });

    const result = await service.createContribution('user-1', 'group-1', {
      amount: 2500,
      currency: 'KES',
      reference: 'MPESA-123',
    } as any);

    expect(result.status).toBe(ContributionStatus.PENDING);
    expect(prisma.wallet.upsert).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate M-Pesa references', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.ACTIVE,
      group: { id: 'group-1', name: 'Alpha Group' },
    });
    prisma.contribution.findUnique.mockResolvedValue({ id: 'existing-1' });

    await expect(
      service.createContribution('user-1', 'group-1', {
        amount: 2500,
        currency: 'KES',
        reference: 'MPESA-123',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('approves a pending contribution once and credits the wallet exactly once', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'admin-membership-1',
      role: MembershipRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    prisma.contribution.findUnique.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.PENDING,
      membership: {
        groupId: 'group-1',
        group: { id: 'group-1', name: 'Alpha Group' },
      },
    });
    prisma.wallet.upsert.mockResolvedValue({ id: 'wallet-1', balance: 1000 });
    prisma.contribution.updateMany.mockResolvedValue({ count: 1 });
    prisma.contribution.update.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.POSTED,
      reviewedById: 'admin-1',
      reviewReason: null,
      reviewedAt: new Date(),
    });
    prisma.transaction.create.mockResolvedValue({ id: 'tx-1', status: TransactionStatus.POSTED });
    prisma.wallet.update.mockResolvedValue({ id: 'wallet-1', balance: 3500 });

    const result = await service.approveContribution('admin-1', 'group-1', 'contribution-1');

    expect(prisma.contribution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'contribution-1',
          status: ContributionStatus.PENDING,
        }),
      }),
    );
    expect(prisma.wallet.update).toHaveBeenCalledTimes(1);
    expect(result.wallet.balance).toBe(3500);
  });

  it('prevents repeated approval from crediting the wallet twice', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'admin-membership-1',
      role: MembershipRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    prisma.contribution.findUnique.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.PENDING,
      membership: {
        groupId: 'group-1',
        group: { id: 'group-1', name: 'Alpha Group' },
      },
    });
    prisma.contribution.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.approveContribution('admin-1', 'group-1', 'contribution-1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.wallet.update).not.toHaveBeenCalled();
  });

  it('rejects a contribution from another group even for an authorized admin', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'admin-membership-1',
      role: MembershipRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    prisma.contribution.findUnique.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.PENDING,
      membership: {
        groupId: 'group-2',
        group: { id: 'group-2', name: 'Beta Group' },
      },
    });

    await expect(
      service.approveContribution('admin-1', 'group-1', 'contribution-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects approval requests from ordinary members', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'member-membership-1',
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      service.approveContribution('member-1', 'group-1', 'contribution-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a pending contribution without crediting the wallet and keeps the reason', async () => {
    const service = new ContributionsService({
      $transaction: async (callback) => callback(prisma),
      groupMembership: prisma.groupMembership,
      contribution: prisma.contribution,
      wallet: prisma.wallet,
      transaction: prisma.transaction,
    } as any);

    prisma.groupMembership.findUnique.mockResolvedValue({
      id: 'admin-membership-1',
      role: MembershipRole.ADMIN,
      status: MembershipStatus.ACTIVE,
    });
    prisma.contribution.findUnique.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.PENDING,
      membership: {
        groupId: 'group-1',
      },
    });
    prisma.contribution.update.mockResolvedValue({
      id: 'contribution-1',
      amount: 2500,
      currency: 'KES',
      status: ContributionStatus.REJECTED,
      reviewReason: 'Incorrect reference',
      reviewedById: 'admin-1',
      reviewedAt: new Date(),
    });

    const result = await service.rejectContribution('admin-1', 'group-1', 'contribution-1', {
      reason: 'Incorrect reference',
    } as any);

    expect(result.status).toBe(ContributionStatus.REJECTED);
    expect(result.reason).toBe('Incorrect reference');
    expect(prisma.wallet.update).not.toHaveBeenCalled();
  });
});
