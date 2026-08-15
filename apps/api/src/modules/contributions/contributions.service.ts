import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContributionStatus,
  MembershipStatus,
  TransactionStatus,
  TransactionType,
  WalletType,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createContribution(
    userId: string,
    groupId: string,
    input: CreateContributionDto,
  ) {
    if (input.amount <= 0) {
      throw new BadRequestException('Contribution amount must be greater than 0');
    }

    const currency = (input.currency ?? 'KES').trim().toUpperCase();

    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const now = new Date();

        const groupWallet = await tx.wallet.upsert({
          where: {
            groupId_currency: {
              groupId,
              currency,
            },
          },
          create: {
            groupId,
            type: WalletType.GROUP,
            currency,
            balance: 0,
          },
          update: {},
        });

        const updatedWallet = await tx.wallet.update({
          where: { id: groupWallet.id },
          data: {
            balance: {
              increment: input.amount,
            },
          },
          select: {
            id: true,
            type: true,
            groupId: true,
            currency: true,
            balance: true,
            updatedAt: true,
          },
        });

        const contribution = await tx.contribution.create({
          data: {
            membershipId: membership.id,
            amount: input.amount,
            currency,
            status: ContributionStatus.POSTED,
            contributedAt: now,
            reference: input.reference,
            notes: input.notes,
          },
        });

        const transaction = await tx.transaction.create({
          data: {
            walletId: updatedWallet.id,
            contributionId: contribution.id,
            type: TransactionType.CONTRIBUTION,
            status: TransactionStatus.POSTED,
            amount: input.amount,
            currency,
            occurredAt: now,
            description: `Contribution to group ${membership.group.name}`,
          },
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            currency: true,
            occurredAt: true,
          },
        });

        return {
          ...contribution,
          transaction,
          wallet: updatedWallet,
        };
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Contribution reference must be unique');
      }

      throw error;
    }
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
}
