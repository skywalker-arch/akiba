import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  MembershipRole,
  MembershipStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  WalletType,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateContributionDto,
  RejectContributionDto,
} from './dto/create-contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContribution(
    userId: string,
    groupId: string,
    input: CreateContributionDto,
  ) {
    const amount = Number(input.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Contribution amount must be greater than 0');
    }

    const currency = this.normalizeCurrency(input.currency);
    const reference = this.normalizeReference(input.reference);

    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.groupMembership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId,
          },
        },
        select: {
          id: true,
          status: true,
          group: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!membership || membership.status !== MembershipStatus.ACTIVE) {
        throw new ForbiddenException(
          'Only ACTIVE group members can create contributions',
        );
      }

      const existingContribution = await tx.contribution.findUnique({
        where: { reference },
        select: { id: true },
      });

      if (existingContribution) {
        throw new ConflictException('Contribution reference already exists');
      }

      const contribution = await tx.contribution.create({
        data: {
          membershipId: membership.id,
          amount: new Prisma.Decimal(amount.toFixed(2)),
          currency,
          status: ContributionStatus.PENDING,
          contributedAt: new Date(),
          reference,
          notes: input.notes?.trim() || undefined,
        },
      });

      return {
        ...contribution,
        amount: Number(contribution.amount),
        status: contribution.status,
        wallet: null,
        transaction: null,
      };
    }).catch((error) => {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Contribution reference must be unique');
      }

      throw error;
    });
  }

  async approveContribution(userId: string, groupId: string, contributionId: string) {
    const actorMembership = await this.ensureActiveGroupManager(userId, groupId);

    return this.prisma.$transaction(async (tx) => {
      const contribution = await tx.contribution.findUnique({
        where: { id: contributionId },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          membership: {
            select: {
              groupId: true,
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!contribution) {
        throw new NotFoundException('Contribution not found');
      }

      if (contribution.membership.groupId !== groupId) {
        throw new ForbiddenException('This contribution does not belong to this group');
      }

      if (contribution.status !== ContributionStatus.PENDING) {
        throw new ConflictException('Only pending contributions can be approved');
      }

      const groupWallet = await tx.wallet.upsert({
        where: {
          groupId_currency: {
            groupId,
            currency: contribution.currency,
          },
        },
        create: {
          groupId,
          type: WalletType.GROUP,
          currency: contribution.currency,
          balance: 0,
        },
        update: {},
      });

      const reviewedAt = new Date();

      const claim = await tx.contribution.updateMany({
        where: {
          id: contributionId,
          status: ContributionStatus.PENDING,
        },
        data: {
          status: ContributionStatus.POSTED,
          reviewedById: userId,
          reviewedAt,
          reviewReason: null,
        },
      });

      if (claim.count !== 1) {
        throw new ConflictException(
          'This contribution has already been reviewed',
        );
      }

      const updatedContribution = await tx.contribution.findUnique({
        where: { id: contributionId },
      });

      if (!updatedContribution) {
        throw new NotFoundException('Contribution not found');
      }

      const transaction = await tx.transaction.create({
        data: {
          walletId: groupWallet.id,
          contributionId: updatedContribution.id,
          type: TransactionType.CONTRIBUTION,
          status: TransactionStatus.POSTED,
          amount: updatedContribution.amount,
          currency: updatedContribution.currency,
          occurredAt: new Date(),
          description: `Approved contribution for ${contribution.membership.group.name}`,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: groupWallet.id },
        data: {
          balance: {
            increment: updatedContribution.amount,
          },
        },
      });

      return {
        ...updatedContribution,
        amount: Number(updatedContribution.amount),
        wallet: updatedWallet,
        transaction,
        reviewer: {
          id: actorMembership.id,
          role: actorMembership.role,
        },
      };
    });
  }

  async rejectContribution(
    userId: string,
    groupId: string,
    contributionId: string,
    input: RejectContributionDto,
  ) {
    const reason = input.reason.trim();

    if (!reason) {
      throw new BadRequestException('A rejection reason is required');
    }

    await this.ensureActiveGroupManager(userId, groupId);

    return this.prisma.$transaction(async (tx) => {
      const contribution = await tx.contribution.findUnique({
        where: { id: contributionId },
        select: {
          id: true,
          status: true,
          membership: {
            select: {
              groupId: true,
            },
          },
        },
      });

      if (!contribution) {
        throw new NotFoundException('Contribution not found');
      }

      if (contribution.membership.groupId !== groupId) {
        throw new ForbiddenException('This contribution does not belong to this group');
      }

      if (contribution.status !== ContributionStatus.PENDING) {
        throw new ConflictException('Only pending contributions can be rejected');
      }

      const updatedContribution = await tx.contribution.update({
        where: { id: contributionId },
        data: {
          status: ContributionStatus.REJECTED,
          reviewedById: userId,
          reviewReason: reason,
          reviewedAt: new Date(),
        },
      });

      return {
        ...updatedContribution,
        amount: Number(updatedContribution.amount),
        reason,
      };
    });
  }

  async getGroupContributions(userId: string, groupId: string) {
    await this.ensureGroupMember(userId, groupId);

    return this.prisma.contribution.findMany({
      where: {
        membership: {
          groupId,
        },
      },
      orderBy: {
        contributedAt: 'desc',
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        contributedAt: true,
        reference: true,
        notes: true,
        reviewReason: true,
        reviewedAt: true,
        createdAt: true,
        membership: {
          select: {
            id: true,
            role: true,
            status: true,
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
  }

  async getContributionById(userId: string, contributionId: string) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id: contributionId },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        contributedAt: true,
        reference: true,
        notes: true,
        reviewReason: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        membership: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            group: {
              select: {
                id: true,
                name: true,
                code: true,
                createdAt: true,
              },
            },
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
        transactions: {
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            currency: true,
            occurredAt: true,
            wallet: {
              select: {
                id: true,
                type: true,
                groupId: true,
                currency: true,
                balance: true,
                updatedAt: true,
              },
            },
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });

    if (!contribution) {
      throw new NotFoundException('Contribution not found');
    }

    await this.ensureGroupMember(userId, contribution.membership.group.id);

    return contribution;
  }

  async getUserTransactions(
    userId: string,
    filters?: { type?: string; status?: string; groupId?: string },
  ) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        userId,
        status: {
          not: MembershipStatus.LEFT,
        },
      },
      select: {
        groupId: true,
      },
    });

    const groupIds = [...new Set(memberships.map((membership) => membership.groupId))];

    if (groupIds.length === 0) {
      return [];
    }

    const where: {
      wallet?: { groupId: { in: string[] } | string };
      type?: TransactionType;
      status?: TransactionStatus;
    } = {
      wallet: {
        groupId: { in: groupIds },
      },
    };

    if (filters?.groupId) {
      const membership = await this.prisma.groupMembership.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: filters.groupId,
          },
        },
        select: { id: true },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this group');
      }

      where.wallet = {
        groupId: filters.groupId,
      };
    }

    if (filters?.type) {
      const normalizedType = filters.type.toUpperCase();
      if (!(Object.values(TransactionType) as string[]).includes(normalizedType)) {
        throw new ForbiddenException('Unsupported transaction type filter');
      }

      where.type = normalizedType as TransactionType;
    }

    if (filters?.status) {
      const normalizedStatus = filters.status.toUpperCase();
      if (!(Object.values(TransactionStatus) as string[]).includes(normalizedStatus)) {
        throw new ForbiddenException('Unsupported transaction status filter');
      }

      where.status = normalizedStatus as TransactionStatus;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: {
        occurredAt: 'desc',
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
        metadata: true,
        createdAt: true,
        updatedAt: true,
        wallet: {
          select: {
            id: true,
            type: true,
            groupId: true,
            currency: true,
            balance: true,
            updatedAt: true,
            group: {
              select: {
                id: true,
                name: true,
                code: true,
                description: true,
                isActive: true,
              },
            },
          },
        },
        contribution: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            membership: {
              select: {
                id: true,
                role: true,
                status: true,
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
        },
        loan: {
          select: {
            id: true,
            principalAmount: true,
            interestRate: true,
            termMonths: true,
            status: true,
            borrowerMembership: {
              select: {
                id: true,
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
        },
        loanRepayment: {
          select: {
            id: true,
            amount: true,
            status: true,
            reference: true,
            paidAt: true,
          },
        },
      },
    });

    return transactions.map((transaction) => ({
      ...transaction,
      wallet: {
        ...transaction.wallet,
        group: transaction.wallet.group ?? null,
      },
    }));
  }

  private async ensureGroupMember(userId: string, groupId: string) {
    const membership = await this.prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!membership || membership.status === MembershipStatus.LEFT) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return membership;
  }

  private async ensureActiveGroupManager(userId: string, groupId: string) {
    const membership = await this.prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId,
          groupId,
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!membership || membership.status === MembershipStatus.LEFT) {
      throw new ForbiddenException('You are not a member of this group');
    }

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only ACTIVE group managers can approve or reject contributions',
      );
    }

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can approve or reject contributions',
      );
    }

    return membership;
  }

  private normalizeCurrency(currency?: string) {
    const normalized = (currency ?? 'KES').trim().toUpperCase();

    if (!normalized || normalized.length !== 3) {
      throw new BadRequestException('Currency code must be a 3-letter ISO code');
    }

    return normalized;
  }

  private normalizeReference(reference: string) {
    const normalized = reference.trim();

    if (!normalized) {
      throw new BadRequestException('M-Pesa payment reference is required');
    }

    if (normalized.length < 3 || normalized.length > 100) {
      throw new BadRequestException(
        'M-Pesa payment reference must be between 3 and 100 characters',
      );
    }

    return normalized;
  }
}
