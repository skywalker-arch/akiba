import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipRole, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

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

  async addMember(userId: string, groupId: string, input: AddMemberDto) {
    await this.ensureGroupManager(userId, groupId);

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User to add was not found');
    }

    const existingMembership = await this.prisma.groupMembership.findUnique({
      where: {
        userId_groupId: {
          userId: input.userId,
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
        userId: input.userId,
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

    await this.prisma.groupMembership.delete({
      where: { id: memberId },
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

    if (
      membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only OWNER or ADMIN can manage group members',
      );
    }

    return membership;
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
