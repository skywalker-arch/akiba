import { BadRequestException, Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateLoanDto } from './dto/create-loan.dto';

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

    return this.prisma.loan.create({
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
  }

  async getGroupLoans(userId: string, groupId: string) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    return this.prisma.loan.findMany({
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
  }
}
