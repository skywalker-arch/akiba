import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  const prisma = {
    loan: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
    loanRepayment: {
      findMany: jest.fn(),
    },
  };

  const groupsService = {
    ensureActiveGroupMember: jest.fn(),
    ensureGroupMember: jest.fn(),
    ensureGroupManager: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid loan requests before creating a record', async () => {
    const service = new LoansService(prisma as any, groupsService as any);
    groupsService.ensureActiveGroupMember.mockResolvedValue({
      id: 'membership-1',
    });

    await expect(
      service.createLoan('user-1', 'group-1', {
        principalAmount: 1000,
        interestRate: 0,
        termMonths: 0,
        purpose: 'School fees',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('blocks loan requests from inactive members', async () => {
    const service = new LoansService(prisma as any, groupsService as any);
    groupsService.ensureActiveGroupMember.mockRejectedValue(
      new ForbiddenException('Only ACTIVE group members can request loans'),
    );

    await expect(
      service.createLoan('user-1', 'group-1', {
        principalAmount: 5000,
        interestRate: 12,
        termMonths: 6,
        purpose: 'Emergency funds',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns group loans ordered by newest first', async () => {
    const service = new LoansService(prisma as any, groupsService as any);
    groupsService.ensureGroupMember.mockResolvedValue({ id: 'membership-1' });
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        borrowerMembershipId: 'membership-1',
        principalAmount: 12000,
        interestRate: 10,
        termMonths: 6,
        purpose: 'School fees',
        status: LoanStatus.REQUESTED,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        disbursedAt: null,
        dueAt: null,
        borrowerMembership: {
          id: 'membership-1',
          role: 'MEMBER',
          status: 'ACTIVE',
          joinedAt: null,
          user: {
            id: 'user-1',
            firstName: 'Jane',
            lastName: 'Wanjiku',
            email: 'jane@example.com',
            phone: null,
          },
        },
      },
    ]);
    prisma.loanRepayment.findMany.mockResolvedValue([]);

    const result = await service.getGroupLoans('user-1', 'group-1');

    expect(groupsService.ensureGroupMember).toHaveBeenCalledWith(
      'user-1',
      'group-1',
    );
    expect(prisma.loan.findMany).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].financialSummary.outstandingAmount).toBe(13200);
  });

  it('prevents reviewing a loan that has already been claimed', async () => {
    const service = new LoansService(prisma as any, groupsService as any);

    groupsService.ensureGroupManager.mockResolvedValue({
      id: 'manager-membership-1',
    });

    prisma.loan.findFirst.mockResolvedValue({
      id: 'loan-1',
      status: LoanStatus.REQUESTED,
      borrowerMembership: {
        userId: 'borrower-1',
        user: {
          firstName: 'Jane',
          lastName: 'Wanjiku',
        },
      },
    });

    const tx = {
      loan: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      wallet: {
        upsert: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation((callback: any) => callback(tx));

    await expect(
      service.reviewLoan('manager-1', 'group-1', 'loan-1', {
        decision: 'APPROVED',
      }),
    ).rejects.toThrow(ConflictException);

    expect(tx.loan.updateMany).toHaveBeenCalled();
    expect(tx.wallet.upsert).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  describe('markOverdueLoans', () => {
    const overdueLoan = {
      id: 'loan-1',
      principalAmount: 10000,
      interestRate: 10,
      termMonths: 6,
      disbursedAt: new Date('2026-01-01T00:00:00Z'),
      dueAt: new Date('2026-02-01T00:00:00Z'),
      repayments: [],
    };

    const setupSchedulerTransaction = (loan: any) => {
      const tx = {
        $queryRaw: jest.fn(),
        loan: {
          findFirst: jest.fn().mockResolvedValue(loan),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };

      prisma.$transaction.mockImplementation(
        (callback: any) => callback(tx),
      );

      return tx;
    };

    it('marks an overdue loan with an outstanding balance as OVERDUE', async () => {
      const service = new LoansService(prisma as any, groupsService as any);
      prisma.loan.findMany.mockResolvedValue([{ id: 'loan-1' }]);

      const tx = setupSchedulerTransaction({
        ...overdueLoan,
        repayments: [{ amount: 1000 }],
      });

      const result = await service.markOverdueLoans();

      expect(result).toBe(1);
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.loan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'loan-1' }),
          data: { status: LoanStatus.OVERDUE },
        }),
      );
    });

    it('does not mark a fully repaid loan as OVERDUE', async () => {
      const service = new LoansService(prisma as any, groupsService as any);
      prisma.loan.findMany.mockResolvedValue([{ id: 'loan-1' }]);

      const tx = setupSchedulerTransaction({
        ...overdueLoan,
        repayments: [{ amount: 11000 }],
      });

      const result = await service.markOverdueLoans();

      expect(result).toBe(0);
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });

    it('does not update a loan that is no longer eligible after locking', async () => {
      const service = new LoansService(prisma as any, groupsService as any);
      prisma.loan.findMany.mockResolvedValue([{ id: 'loan-1' }]);

      const tx = setupSchedulerTransaction(null);

      const result = await service.markOverdueLoans();

      expect(result).toBe(0);
      expect(tx.loan.findFirst).toHaveBeenCalled();
      expect(tx.loan.updateMany).not.toHaveBeenCalled();
    });
  });

});
