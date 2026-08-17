import {
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanStatusDto } from './dto/update-loan-status.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  async createLoan(userId: string, groupId: string, input: CreateLoanDto) {
    void input;
    await this.groupsService.ensureGroupMember(userId, groupId);

    throw new NotImplementedException('Loan creation is not implemented yet');
  }

  async getGroupLoans(userId: string, groupId: string) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    throw new NotImplementedException('Loan listing is not implemented yet');
  }

  async getLoanById(userId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        borrowerMembershipId: true,
        principalAmount: true,
        interestRate: true,
        termMonths: true,
        purpose: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        disbursedAt: true,
        dueAt: true,
        borrowerMembership: {
          select: {
            id: true,
            groupId: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    await this.groupsService.ensureGroupMember(
      userId,
      loan.borrowerMembership.groupId,
    );

    throw new NotImplementedException('Loan retrieval is not implemented yet');
  }

  async updateLoanStatus(
    userId: string,
    loanId: string,
    input: UpdateLoanStatusDto,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        status: true,
        borrowerMembership: {
          select: {
            groupId: true,
          },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    await this.groupsService.ensureGroupManager(
      userId,
      loan.borrowerMembership.groupId,
    );

    if (!Object.values(LoanStatus).includes(input.status)) {
      throw new NotFoundException('Loan status is invalid');
    }

    throw new NotImplementedException(
      'Loan status updates are not implemented yet',
    );
  }
}
