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
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGoalMilestoneDto } from './dto/create-goal-milestone.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto';
import { UpdateGoalMilestoneDto } from './dto/update-goal-milestone.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto';

type GoalWithMilestones = {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  targetAmount: Prisma.Decimal;
  currency: string;
  startDate: Date;
  targetDate: Date;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  milestones: Array<{
    id: string;
    name: string;
    targetAmount: Prisma.Decimal;
    dueDate: Date;
    isCompleted: boolean;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async createGroup(userId: string, input: CreateGroupDto) {
    const code = input.code ?? (await this.generateUniqueGroupCode());

    if (input.code) {
      const existingCode = await this.prisma.savingsGroup.findUnique({
        where: { code },
        select: { id: true },
      });

      if (existingCode) {
        throw new ConflictException('Group code already exists');
      }
    }

    const group = await this.prisma.$transaction(async (tx) => {
      const createdGroup = await tx.savingsGroup.create({
        data: {
          name: input.name,
          description: input.description,
          code,
          createdById: userId,
        },
      });

      await tx.groupMembership.create({
        data: {
          userId,
          groupId: createdGroup.id,
          role: MembershipRole.OWNER,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      return createdGroup;
    });

    return group;
  }

  async getMyGroups(userId: string) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        userId,
        status: {
          not: MembershipStatus.LEFT,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
      group: membership.group,
    }));
  }

  async getGroupById(userId: string, groupId: string) {
    await this.ensureGroupMember(userId, groupId);

    const group = await this.prisma.savingsGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        isActive: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        memberships: {
          where: {
            status: {
              not: MembershipStatus.LEFT,
            },
          },
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    return {
      ...group,
      memberCount: group.memberships.length,
    };
  }

  async getGroupBalance(userId: string, groupId: string) {
    await this.ensureGroupMember(userId, groupId);

    const wallet = await this.prisma.wallet.findUnique({
      where: {
        groupId_currency: {
          groupId,
          currency: 'KES',
        },
      },
      select: {
        balance: true,
        currency: true,
      },
    });

    return {
      amount: Number(wallet?.balance ?? 0),
      currency: wallet?.currency ?? 'KES',
    };
  }

  async getGroupGoals(userId: string, groupId: string, includeArchived = false) {
    await this.ensureGroupMember(userId, groupId);

    const goals = await this.prisma.savingsGoal.findMany({
      where: {
        groupId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: [{ isArchived: 'asc' }, { targetDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        targetAmount: true,
        currency: true,
        startDate: true,
        targetDate: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        milestones: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            targetAmount: true,
            dueDate: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return Promise.all(goals.map((goal) => this.enrichGoalWithProgress(goal)));
  }

  async createGoal(userId: string, groupId: string, input: CreateSavingsGoalDto) {
    await this.ensureGroupManager(userId, groupId);

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const targetDate = new Date(input.targetDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid goal date values');
    }

    if (targetDate <= startDate) {
      throw new BadRequestException('Target date must be after the start date');
    }

    const goal = await this.prisma.savingsGoal.create({
      data: {
        groupId,
        createdById: userId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        targetAmount: input.targetAmount,
        currency: input.currency?.trim().toUpperCase() ?? 'KES',
        startDate,
        targetDate,
      },
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        targetAmount: true,
        currency: true,
        startDate: true,
        targetDate: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        milestones: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            targetAmount: true,
            dueDate: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return this.enrichGoalWithProgress(goal);
  }

  async updateGoal(
    userId: string,
    groupId: string,
    goalId: string,
    input: UpdateSavingsGoalDto,
  ) {
    await this.ensureGroupManager(userId, groupId);

    const existing = await this.prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        groupId,
      },
      select: {
        id: true,
        startDate: true,
        targetDate: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Savings goal not found');
    }

    if (
      input.name === undefined &&
      input.description === undefined &&
      input.targetAmount === undefined &&
      input.currency === undefined &&
      input.startDate === undefined &&
      input.targetDate === undefined &&
      input.isArchived === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const nextStartDate = input.startDate
      ? new Date(input.startDate)
      : existing.startDate;
    const nextTargetDate = input.targetDate
      ? new Date(input.targetDate)
      : existing.targetDate;

    if (
      Number.isNaN(nextStartDate.getTime()) ||
      Number.isNaN(nextTargetDate.getTime())
    ) {
      throw new BadRequestException('Invalid goal date values');
    }

    if (nextTargetDate <= nextStartDate) {
      throw new BadRequestException('Target date must be after the start date');
    }

    const data: Prisma.SavingsGoalUpdateInput = {
      name: input.name?.trim(),
      targetAmount: input.targetAmount,
      currency: input.currency?.trim().toUpperCase(),
      startDate: input.startDate ? nextStartDate : undefined,
      targetDate: input.targetDate ? nextTargetDate : undefined,
      isArchived: input.isArchived,
    };

    if (input.description !== undefined) {
      data.description = input.description.trim() || null;
    }

    const goal = await this.prisma.savingsGoal.update({
      where: {
        id: goalId,
      },
      data,
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        targetAmount: true,
        currency: true,
        startDate: true,
        targetDate: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        milestones: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            targetAmount: true,
            dueDate: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return this.enrichGoalWithProgress(goal);
  }

  async createGoalMilestone(
    userId: string,
    groupId: string,
    goalId: string,
    input: CreateGoalMilestoneDto,
  ) {
    await this.ensureGroupManager(userId, groupId);

    const goal = await this.prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        groupId,
      },
      select: {
        id: true,
        startDate: true,
        targetDate: true,
      },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const dueDate = new Date(input.dueDate);

    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('Invalid milestone due date');
    }

    if (dueDate < goal.startDate || dueDate > goal.targetDate) {
      throw new BadRequestException(
        'Milestone due date must fall within the goal date window',
      );
    }

    await this.prisma.savingsGoalMilestone.create({
      data: {
        goalId,
        createdById: userId,
        name: input.name.trim(),
        targetAmount: input.targetAmount,
        dueDate,
      },
    });

    const refreshedGoal = await this.getGoalWithMilestonesOrThrow(groupId, goalId);
    return this.enrichGoalWithProgress(refreshedGoal);
  }

  async updateGoalMilestone(
    userId: string,
    groupId: string,
    goalId: string,
    milestoneId: string,
    input: UpdateGoalMilestoneDto,
  ) {
    await this.ensureGroupManager(userId, groupId);

    if (
      input.name === undefined &&
      input.targetAmount === undefined &&
      input.dueDate === undefined &&
      input.isCompleted === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const goal = await this.prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        groupId,
      },
      select: {
        id: true,
        startDate: true,
        targetDate: true,
      },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    const milestone = await this.prisma.savingsGoalMilestone.findFirst({
      where: {
        id: milestoneId,
        goalId,
      },
      select: {
        id: true,
        dueDate: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Savings milestone not found');
    }

    const nextDueDate = input.dueDate ? new Date(input.dueDate) : milestone.dueDate;

    if (Number.isNaN(nextDueDate.getTime())) {
      throw new BadRequestException('Invalid milestone due date');
    }

    if (nextDueDate < goal.startDate || nextDueDate > goal.targetDate) {
      throw new BadRequestException(
        'Milestone due date must fall within the goal date window',
      );
    }

    const data: Prisma.SavingsGoalMilestoneUpdateInput = {
      name: input.name?.trim(),
      targetAmount: input.targetAmount,
      dueDate: input.dueDate ? nextDueDate : undefined,
      isCompleted: input.isCompleted,
      completedAt:
        input.isCompleted === undefined
          ? undefined
          : input.isCompleted
            ? new Date()
            : null,
    };

    await this.prisma.savingsGoalMilestone.update({
      where: { id: milestoneId },
      data,
    });

    const refreshedGoal = await this.getGoalWithMilestonesOrThrow(groupId, goalId);
    return this.enrichGoalWithProgress(refreshedGoal);
  }

  async addMember(userId: string, groupId: string, input: AddMemberDto) {
    await this.ensureGroupManager(userId, groupId);

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundException(
        'No registered account was found for that email address',
      );
    }

    const existingMembership = await this.prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId: user.id,
          groupId,
        },
      },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this group');
    }

    return this.prisma.groupMembership.create({
      data: {
        groupId,
        userId: user.id,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.PENDING,
      },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async searchMemberCandidates(userId: string, groupId: string, query: string) {
    await this.ensureGroupManager(userId, groupId);

    const searchTerm = query.trim();

    if (searchTerm.length < 3) {
      throw new BadRequestException(
        'Search query must be at least 3 characters long',
      );
    }

    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          {
            email: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            firstName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            lastName: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (users.length === 0) {
      return [];
    }

    const existingMemberships = await this.prisma.groupMembership.findMany({
      where: {
        groupId,
        userId: {
          in: users.map((candidate) => candidate.id),
        },
      },
      select: {
        userId: true,
      },
    });

    const existingMemberIds = new Set(
      existingMemberships.map((membership) => membership.userId),
    );

    return users
      .filter((candidate) => !existingMemberIds.has(candidate.id))
      .map((candidate) => ({
        id: candidate.id,
        email: candidate.email,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
      }));
  }

  async updateMember(
    userId: string,
    groupId: string,
    memberId: string,
    input: UpdateMemberDto,
  ) {
    await this.ensureGroupManager(userId, groupId);

    if (input.role === undefined && input.status === undefined) {
      throw new BadRequestException(
        'Provide at least one field: role or status',
      );
    }

    const targetMembership = await this.prisma.groupMembership.findFirst({
      where: {
        id: memberId,
        groupId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Group member not found');
    }

    if (targetMembership.role === MembershipRole.OWNER) {
      throw new BadRequestException('Owner membership cannot be updated here');
    }

    const data: Prisma.GroupMembershipUpdateInput = {
      role: input.role,
      status: input.status,
    };

    if (input.status === MembershipStatus.ACTIVE) {
      data.joinedAt = new Date();
      data.leftAt = null;
    }

    if (input.status === MembershipStatus.LEFT) {
      data.leftAt = new Date();
    }

    return this.prisma.groupMembership.update({
      where: { id: memberId },
      data,
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        leftAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async removeMember(userId: string, groupId: string, memberId: string) {
    const actorMembership = await this.ensureGroupManager(userId, groupId);

    const targetMembership = await this.prisma.groupMembership.findFirst({
      where: {
        id: memberId,
        groupId,
      },
      select: {
        id: true,
        role: true,
        userId: true,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Group member not found');
    }

    if (targetMembership.role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'Transfer ownership before removing the owner',
      );
    }

    if (
      actorMembership.role === MembershipRole.OWNER &&
      targetMembership.userId === userId
    ) {
      throw new BadRequestException(
        'Owner cannot remove themselves before transferring ownership',
      );
    }

    await this.prisma.groupMembership.update({
      where: { id: memberId },
      data: {
        status: MembershipStatus.LEFT,
        leftAt: new Date(),
      },
    });
  }

  public async ensureGroupMember(userId: string, groupId: string) {
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

  public async ensureActiveGroupMember(userId: string, groupId: string) {
    const membership = await this.ensureGroupMember(userId, groupId);

    if (membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only ACTIVE group members can request loans',
      );
    }

    return membership;
  }

  public async ensureGroupManager(userId: string, groupId: string) {
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
        'Only ACTIVE group managers can perform this action',
      );
    }

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can perform this action',
      );
    }

    return membership;
  }

  private async enrichGoalWithProgress(goal: GoalWithMilestones) {
    const now = new Date();

    const aggregate = await this.prisma.contribution.aggregate({
      where: {
        status: ContributionStatus.POSTED,
        currency: goal.currency,
        membership: {
          groupId: goal.groupId,
        },
        contributedAt: {
          gte: goal.startDate,
          lte: now,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const currentAmount = Number(aggregate._sum.amount ?? 0);
    const targetAmount = Number(goal.targetAmount);
    const achieved = currentAmount >= targetAmount;
    const remainingAmount = Math.max(0, targetAmount - currentAmount);
    const progressPercent =
      targetAmount > 0
        ? Math.min(100, Number(((currentAmount / targetAmount) * 100).toFixed(2)))
        : 0;

    let status: 'ON_TRACK' | 'OVERDUE' | 'ACHIEVED';

    if (achieved) {
      status = 'ACHIEVED';
    } else if (now > goal.targetDate) {
      status = 'OVERDUE';
    } else {
      status = 'ON_TRACK';
    }

    const milestones = goal.milestones.map((milestone) => {
      const milestoneTargetAmount = Number(milestone.targetAmount);
      const milestoneProgressPercent =
        milestoneTargetAmount > 0
          ? Math.min(
              100,
              Number(((currentAmount / milestoneTargetAmount) * 100).toFixed(2)),
            )
          : 0;

      let milestoneStatus: 'ON_TRACK' | 'OVERDUE' | 'ACHIEVED';

      if (milestone.isCompleted || currentAmount >= milestoneTargetAmount) {
        milestoneStatus = 'ACHIEVED';
      } else if (now > milestone.dueDate) {
        milestoneStatus = 'OVERDUE';
      } else {
        milestoneStatus = 'ON_TRACK';
      }

      return {
        id: milestone.id,
        name: milestone.name,
        targetAmount: milestoneTargetAmount,
        dueDate: milestone.dueDate,
        isCompleted: milestone.isCompleted,
        completedAt: milestone.completedAt,
        progressPercent: milestoneProgressPercent,
        status: milestoneStatus,
        createdAt: milestone.createdAt,
        updatedAt: milestone.updatedAt,
      };
    });

    return {
      ...goal,
      targetAmount,
      currentAmount,
      remainingAmount,
      progressPercent,
      status,
      milestones,
    };
  }

  private async getGoalWithMilestonesOrThrow(groupId: string, goalId: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: {
        id: goalId,
        groupId,
      },
      select: {
        id: true,
        groupId: true,
        name: true,
        description: true,
        targetAmount: true,
        currency: true,
        startDate: true,
        targetDate: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        milestones: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            targetAmount: true,
            dueDate: true,
            isCompleted: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException('Savings goal not found');
    }

    return goal;
  }

  private async generateUniqueGroupCode(): Promise<string> {
    const attempts = 10;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const code = `AKB${this.randomAlphaNumeric(7)}`;

      const existing = await this.prisma.savingsGroup.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    throw new ConflictException('Unable to generate a unique group code');
  }

  private randomAlphaNumeric(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let output = '';

    for (let index = 0; index < length; index += 1) {
      output += chars[Math.floor(Math.random() * chars.length)];
    }

    return output;
  }
}
