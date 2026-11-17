import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContributionStatus,
  LoanStatus,
  MembershipStatus,
  Prisma,
  RepaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GetStatementQueryDto } from './dto/get-statement-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyStatement(userId: string, query: GetStatementQueryDto) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const periodStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const periodEnd = new Date(year, month, 1, 0, 0, 0, 0);

    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        userId,
        status: {
          not: MembershipStatus.LEFT,
        },
      },
      select: {
        id: true,
        group: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const membershipIds = memberships.map((item) => item.id);

    if (membershipIds.length === 0) {
      return {
        period: {
          month,
          year,
          start: periodStart,
          endExclusive: periodEnd,
        },
        memberships: [],
        contributions: {
          submittedTotal: 0,
          postedTotal: 0,
          pendingCount: 0,
        },
        loans: {
          requestedCount: 0,
          activeCount: 0,
          disbursedTotal: 0,
          repaidTotal: 0,
          outstandingTotal: 0,
        },
        transactions: [],
      };
    }

    const [contributions, loans, periodTransactions, repaymentAgg] = await Promise.all([
      this.prisma.contribution.findMany({
        where: {
          membershipId: {
            in: membershipIds,
          },
          contributedAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          contributedAt: true,
          reference: true,
          membership: {
            select: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          contributedAt: 'desc',
        },
      }),
      this.prisma.loan.findMany({
        where: {
          borrowerMembershipId: {
            in: membershipIds,
          },
        },
        select: {
          id: true,
          principalAmount: true,
          interestRate: true,
          termMonths: true,
          status: true,
          createdAt: true,
          repayments: {
            where: {
              status: RepaymentStatus.POSTED,
            },
            select: {
              amount: true,
              paidAt: true,
            },
          },
        },
      }),
      this.prisma.transaction.findMany({
        where: {
          occurredAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          OR: [
            {
              contribution: {
                membershipId: {
                  in: membershipIds,
                },
              },
            },
            {
              loan: {
                borrowerMembershipId: {
                  in: membershipIds,
                },
              },
            },
            {
              loanRepayment: {
                loan: {
                  borrowerMembershipId: {
                    in: membershipIds,
                  },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          currency: true,
          occurredAt: true,
          description: true,
          externalReference: true,
          wallet: {
            select: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          occurredAt: 'desc',
        },
        take: 200,
      }),
      this.prisma.loanRepayment.aggregate({
        where: {
          status: RepaymentStatus.POSTED,
          paidAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          loan: {
            borrowerMembershipId: {
              in: membershipIds,
            },
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const submittedTotal = contributions.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const postedTotal = contributions
      .filter((item) => item.status === ContributionStatus.POSTED)
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const pendingCount = contributions.filter(
      (item) => item.status === ContributionStatus.PENDING,
    ).length;

    const requestedCount = loans.filter(
      (item) => item.status === LoanStatus.REQUESTED,
    ).length;

    const activeCount = loans.filter((item) => {
      return (
        item.status === LoanStatus.APPROVED ||
        item.status === LoanStatus.DISBURSED ||
        item.status === LoanStatus.ACTIVE ||
        item.status === LoanStatus.OVERDUE
      );
    }).length;

    const disbursedTotal = loans
      .filter((item) => {
        return (
          item.status === LoanStatus.DISBURSED ||
          item.status === LoanStatus.ACTIVE ||
          item.status === LoanStatus.OVERDUE ||
          item.status === LoanStatus.CLOSED
        );
      })
      .reduce((sum, item) => sum + Number(item.principalAmount), 0);

    const repaidTotal = Number(repaymentAgg._sum.amount ?? 0);

    const outstandingTotal = loans.reduce((sum, item) => {
      const principal = new Prisma.Decimal(item.principalAmount);
      const interestRate = new Prisma.Decimal(item.interestRate);
      const totalInterest = principal.mul(interestRate.dividedBy(100));
      const totalRepayable = principal.add(totalInterest);
      const paid = item.repayments.reduce(
        (acc, repayment) => acc.add(new Prisma.Decimal(repayment.amount)),
        new Prisma.Decimal(0),
      );
      const outstanding = Prisma.Decimal.max(totalRepayable.sub(paid), new Prisma.Decimal(0));
      return sum + Number(outstanding);
    }, 0);

    const membershipMap = new Map(
      memberships.map((membership) => [
        membership.id,
        {
          id: membership.id,
          group: membership.group,
        },
      ]),
    );

    return {
      period: {
        month,
        year,
        start: periodStart,
        endExclusive: periodEnd,
      },
      memberships: Array.from(membershipMap.values()),
      contributions: {
        submittedTotal,
        postedTotal,
        pendingCount,
      },
      loans: {
        requestedCount,
        activeCount,
        disbursedTotal,
        repaidTotal,
        outstandingTotal,
      },
      transactions: periodTransactions.map((item) => ({
        id: item.id,
        type: item.type,
        status: item.status,
        amount: Number(item.amount),
        currency: item.currency,
        occurredAt: item.occurredAt,
        description: item.description,
        externalReference: item.externalReference,
        group: item.wallet.group,
      })),
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, input: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
