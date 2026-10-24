import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  const prisma = {
    loan: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    loanRepayment: {
      findMany: jest.fn(),
    },
  };

  const groupsService = {
    ensureActiveGroupMember: jest.fn(),
    ensureGroupMember: jest.fn(),
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
});
