import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoanStatus,
  Prisma,
  RepaymentStatus,
  TransactionStatus,
  TransactionType,
  WalletType,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { ReviewLoanDto } from './dto/review-loan.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async createLoan(userId: string, groupId: string, input: CreateLoanDto) {
    const membership = await this.groupsService.ensureActiveGroupMember(
      userId,
      groupId,
    );

    if (input.principalAmount <= 0) {
      throw new BadRequestException(
        'Loan principal amount must be greater than 0',
      );
    }

    if (input.interestRate <= 0) {
      throw new BadRequestException('Interest rate must be greater than 0');
    }

    if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
      throw new BadRequestException(
        'Loan term in months must be greater than 0',
      );
    }

    const purpose = input.purpose?.trim();

    const created = await this.prisma.loan.create({
      data: {
        borrowerMembershipId: membership.id,
        principalAmount: input.principalAmount,
        interestRate: input.interestRate,
        termMonths: input.termMonths,
        purpose: purpose || undefined,
        status: LoanStatus.REQUESTED,
      },
      select: {
        id: true,
        borrowerMembershipId: true,
        principalAmount: true,
        interestRate: true,
        termMonths: true,
        purpose: true,
        disbursedAt: true,
        dueAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        borrowerMembership: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return this.withFinancialSummary(created, []);
  }

  async getGroupLoans(userId: string, groupId: string) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    const loans = await this.prisma.loan.findMany({
      where: {
        borrowerMembership: {
          groupId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        borrowerMembershipId: true,
        principalAmount: true,
        interestRate: true,
        termMonths: true,
        purpose: true,
        disbursedAt: true,
        dueAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        borrowerMembership: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    return Promise.all(
      loans.map(async (loan) => {
        const repayments = await this.prisma.loanRepayment.findMany({
          where: {
            loanId: loan.id,
            status: RepaymentStatus.POSTED,
          },
          orderBy: {
            paidAt: 'asc',
          },
          select: {
            id: true,
            amount: true,
            status: true,
            reference: true,
            notes: true,
            paidAt: true,
            paidByMembership: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

        return this.withFinancialSummary(loan, repayments);
      }),
    );
  }

  async getLoanById(userId: string, groupId: string, loanId: string) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    const loan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        borrowerMembership: {
          groupId,
        },
      },
      select: {
        id: true,
        borrowerMembershipId: true,
        principalAmount: true,
        interestRate: true,
        termMonths: true,
        purpose: true,
        disbursedAt: true,
        dueAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        borrowerMembership: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const repayments = await this.prisma.loanRepayment.findMany({
      where: {
        loanId,
      },
      orderBy: {
        paidAt: 'asc',
      },
      select: {
        id: true,
        amount: true,
        status: true,
        reference: true,
        notes: true,
        paidAt: true,
        createdAt: true,
        paidByMembership: {
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return this.withFinancialSummary(loan, repayments);
  }

  async reviewLoan(
    userId: string,
    groupId: string,
    loanId: string,
    input: ReviewLoanDto,
  ) {
    const managerMembership = await this.groupsService.ensureGroupManager(
      userId,
      groupId,
    );

    const loan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        borrowerMembership: {
          groupId,
        },
      },
      select: {
        id: true,
        status: true,
        borrowerMembership: {
          select: {
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.status !== LoanStatus.REQUESTED) {
      throw new ConflictException('Only requested loans can be reviewed');
    }

    if (loan.borrowerMembership.userId === userId) {
      throw new ForbiddenException(
        'You cannot approve or reject your own loan request',
      );
    }

    if (input.decision === 'REJECTED' && !input.reason?.trim()) {
      throw new BadRequestException(
        'A rejection reason is required when rejecting a loan',
      );
    }

    const status =
      input.decision === 'APPROVED' ? LoanStatus.APPROVED : LoanStatus.REJECTED;

    return this.prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: {
          status,
        },
      });

      await this.createAuditTransaction(tx, {
        groupId,
        loanId,
        actorUserId: userId,
        description: `Loan ${input.decision.toLowerCase()} by group manager`,
        metadata: {
          loanDecision: input.decision,
          reason: input.reason?.trim() || null,
          reviewerMembershipId: managerMembership.id,
        },
      });

      const repayments = await tx.loanRepayment.findMany({
        where: {
          loanId,
          status: RepaymentStatus.POSTED,
        },
      });

      return this.withFinancialSummary(updatedLoan, repayments);
    });
  }

  async disburseLoan(
    userId: string,
    groupId: string,
    loanId: string,
    input: DisburseLoanDto,
  ) {
    await this.groupsService.ensureGroupManager(userId, groupId);

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: {
          id: loanId,
          borrowerMembership: {
            groupId,
          },
        },
        select: {
          id: true,
          principalAmount: true,
          status: true,
          termMonths: true,
          borrowerMembership: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (loan.status !== LoanStatus.APPROVED) {
        throw new ConflictException('Only approved loans can be disbursed');
      }

      const disbursementAmount = new Prisma.Decimal(
        (input.amount ?? Number(loan.principalAmount)).toFixed(2),
      );

      const groupWallet = await tx.wallet.upsert({
        where: {
          groupId_currency: {
            groupId,
            currency: 'KES',
          },
        },
        create: {
          groupId,
          type: WalletType.GROUP,
          currency: 'KES',
          balance: 0,
        },
        update: {},
      });

      if (groupWallet.balance.lessThan(disbursementAmount)) {
        throw new BadRequestException(
          'Insufficient group wallet balance for disbursement',
        );
      }

      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setMonth(dueAt.getMonth() + loan.termMonths);

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: LoanStatus.DISBURSED,
          disbursedAt: now,
          dueAt,
        },
      });

      await tx.transaction.create({
        data: {
          walletId: groupWallet.id,
          loanId: loan.id,
          type: TransactionType.LOAN_DISBURSEMENT,
          status: TransactionStatus.POSTED,
          amount: disbursementAmount,
          currency: groupWallet.currency,
          occurredAt: now,
          externalReference: input.reference.trim(),
          description: `Loan disbursement to ${loan.borrowerMembership.user.firstName} ${loan.borrowerMembership.user.lastName}`,
          metadata: {
            actorUserId: userId,
            notes: input.notes?.trim() || null,
          },
        },
      });

      await tx.wallet.update({
        where: {
          id: groupWallet.id,
        },
        data: {
          balance: {
            decrement: disbursementAmount,
          },
        },
      });

      const repayments = await tx.loanRepayment.findMany({
        where: {
          loanId,
          status: RepaymentStatus.POSTED,
        },
      });

      return this.withFinancialSummary(updatedLoan, repayments);
    });
  }

  async createRepayment(
    userId: string,
    groupId: string,
    loanId: string,
    input: CreateLoanRepaymentDto,
  ) {
    const actorMembership = await this.groupsService.ensureGroupMember(
      userId,
      groupId,
    );

    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findFirst({
        where: {
          id: loanId,
          borrowerMembership: {
            groupId,
          },
        },
        select: {
          id: true,
          status: true,
          principalAmount: true,
          interestRate: true,
          termMonths: true,
          borrowerMembership: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      });

      if (!loan) {
        throw new NotFoundException('Loan not found');
      }

      if (
        loan.status !== LoanStatus.DISBURSED &&
        loan.status !== LoanStatus.ACTIVE &&
        loan.status !== LoanStatus.OVERDUE
      ) {
        throw new ConflictException(
          'Repayments are only allowed for disbursed or active loans',
        );
      }

      const repaymentAmount = new Prisma.Decimal(input.amount.toFixed(2));
      const financialSummary = this.calculateFinancialSummary({
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        disbursedAt: null,
        dueAt: null,
      },
      await tx.loanRepayment.findMany({
        where: {
          loanId,
          status: RepaymentStatus.POSTED,
        },
        select: {
          amount: true,
        },
      }));

      if (repaymentAmount.greaterThan(new Prisma.Decimal(financialSummary.outstandingAmount))) {
        throw new BadRequestException(
          'Repayment amount cannot be greater than the outstanding balance',
        );
      }

      const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

      const repayment = await tx.loanRepayment
        .create({
          data: {
            loanId,
            paidByMembershipId:
              actorMembership.id ?? loan.borrowerMembership.id,
            amount: repaymentAmount,
            paidAt,
            status: RepaymentStatus.POSTED,
            reference: input.reference.trim(),
            notes: input.notes?.trim() || undefined,
          },
        })
        .catch((error) => {
          if (
            error instanceof PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new ConflictException(
              'A repayment with this reference already exists',
            );
          }

          throw error;
        });

      const groupWallet = await tx.wallet.upsert({
        where: {
          groupId_currency: {
            groupId,
            currency: 'KES',
          },
        },
        create: {
          groupId,
          type: WalletType.GROUP,
          currency: 'KES',
          balance: 0,
        },
        update: {},
      });

      await tx.transaction.create({
        data: {
          walletId: groupWallet.id,
          loanId: loan.id,
          loanRepaymentId: repayment.id,
          type: TransactionType.LOAN_REPAYMENT,
          status: TransactionStatus.POSTED,
          amount: repaymentAmount,
          currency: groupWallet.currency,
          occurredAt: paidAt,
          externalReference: repayment.reference,
          description: 'Loan repayment',
          metadata: {
            actorUserId: userId,
          },
        },
      });

      await tx.wallet.update({
        where: {
          id: groupWallet.id,
        },
        data: {
          balance: {
            increment: repaymentAmount,
          },
        },
      });

      const allPostedRepayments = await tx.loanRepayment.findMany({
        where: {
          loanId,
          status: RepaymentStatus.POSTED,
        },
      });

      const nextSummary = this.calculateFinancialSummary(
        {
          principalAmount: loan.principalAmount,
          interestRate: loan.interestRate,
          termMonths: loan.termMonths,
          disbursedAt: null,
          dueAt: null,
        },
        allPostedRepayments,
      );

      const nextStatus =
        nextSummary.outstandingAmount <= 0
          ? LoanStatus.CLOSED
          : LoanStatus.ACTIVE;

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: nextStatus,
        },
      });

      return {
        repaymentId: repayment.id,
        loanId,
        status: nextStatus,
        outstandingAmount: nextSummary.outstandingAmount,
      };
    });
  }

  private calculateFinancialSummary(
    loan: {
      principalAmount: Prisma.Decimal | number;
      interestRate: Prisma.Decimal | number;
      termMonths: number;
      disbursedAt: Date | null;
      dueAt: Date | null;
    },
    repayments: Array<{ amount: Prisma.Decimal | number }>,
  ) {
    const principal = new Prisma.Decimal(loan.principalAmount);
    const interestRate = new Prisma.Decimal(loan.interestRate);
    const rate = interestRate.dividedBy(100);
    const totalInterest = principal.mul(rate).toDecimalPlaces(2);
    const totalRepayable = principal.add(totalInterest).toDecimalPlaces(2);
    const installmentAmount = totalRepayable
      .dividedBy(loan.termMonths)
      .toDecimalPlaces(2);
    const repaidAmount = repayments
      .reduce(
        (sum, item) => sum.add(new Prisma.Decimal(item.amount)),
        new Prisma.Decimal(0),
      )
      .toDecimalPlaces(2);
    const outstandingAmount = Prisma.Decimal.max(
      totalRepayable.sub(repaidAmount),
      new Prisma.Decimal(0),
    ).toDecimalPlaces(2);

    return {
      principalAmount: Number(principal),
      totalInterest: Number(totalInterest),
      totalRepayable: Number(totalRepayable),
      installmentAmount: Number(installmentAmount),
      repaidAmount: Number(repaidAmount),
      outstandingAmount: Number(outstandingAmount),
      interestMethod: 'FLAT',
    };
  }

  private withFinancialSummary<T extends {
    principalAmount: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    termMonths: number;
    disbursedAt: Date | null;
    dueAt: Date | null;
  }>(
    loan: T,
    repayments: Array<{ amount: Prisma.Decimal }>,
  ) {
    return {
      ...loan,
      principalAmount: Number(loan.principalAmount),
      interestRate: Number(loan.interestRate),
      financialSummary: this.calculateFinancialSummary(loan, repayments),
    };
  }

  private async createAuditTransaction(
    tx: Prisma.TransactionClient,
    input: {
      groupId: string;
      loanId: string;
      actorUserId: string;
      description: string;
      metadata: Prisma.InputJsonValue;
    },
  ) {
    const wallet = await tx.wallet.upsert({
      where: {
        groupId_currency: {
          groupId: input.groupId,
          currency: 'KES',
        },
      },
      create: {
        groupId: input.groupId,
        type: WalletType.GROUP,
        currency: 'KES',
        balance: 0,
      },
      update: {},
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        loanId: input.loanId,
        type: TransactionType.ADJUSTMENT,
        status: TransactionStatus.POSTED,
        amount: new Prisma.Decimal(0),
        currency: wallet.currency,
        occurredAt: new Date(),
        description: input.description,
        metadata: {
          actorUserId: input.actorUserId,
          ...((input.metadata as object) ?? {}),
        },
      },
    });
  }
}
