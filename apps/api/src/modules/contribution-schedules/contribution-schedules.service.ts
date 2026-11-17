import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MembershipStatus,
  NotificationType,
  ObligationStatus,
  Prisma,
  ScheduleFrequency,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { GroupsService } from '../groups/groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateContributionScheduleDto } from './dto/create-contribution-schedule.dto';
import { UpdateContributionScheduleDto } from './dto/update-contribution-schedule.dto';

const OBLIGATION_LOOKBACK_DAYS = 90;
const OBLIGATION_LOOKAHEAD_DAYS = 120;

@Injectable()
export class ContributionSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async processObligationReminders() {
    await this.refreshOverdueObligations();

    const now = new Date();
    const dueSoonCutoff = this.addDays(now, 1);

    const dueSoon = await this.prisma.contributionObligation.findMany({
      where: {
        status: ObligationStatus.PENDING,
        dueDate: {
          gte: now,
          lte: dueSoonCutoff,
        },
        membership: {
          status: MembershipStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        dueDate: true,
        expectedAmount: true,
        currency: true,
        membership: {
          select: {
            userId: true,
          },
        },
        schedule: {
          select: {
            name: true,
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

    const recentlyOverdue = await this.prisma.contributionObligation.findMany({
      where: {
        status: ObligationStatus.OVERDUE,
        updatedAt: {
          gte: this.addDays(now, -1),
        },
        membership: {
          status: MembershipStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        dueDate: true,
        expectedAmount: true,
        currency: true,
        membership: {
          select: {
            userId: true,
          },
        },
        schedule: {
          select: {
            name: true,
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

    await Promise.all([
      ...dueSoon.map((item) =>
        this.safeNotify(
          item.membership.userId,
          NotificationType.CONTRIBUTION_DUE,
          'Contribution due soon',
          `${item.schedule.name} in ${item.schedule.group.name} is due by ${item.dueDate.toLocaleDateString('en-KE')}. Expected amount: ${item.currency} ${Number(item.expectedAmount).toLocaleString('en-KE')}.`,
          {
            obligationId: item.id,
            groupId: item.schedule.group.id,
            dueDate: item.dueDate,
            expectedAmount: Number(item.expectedAmount),
            currency: item.currency,
          },
          `obligation-due:${item.id}:${item.dueDate.toISOString().slice(0, 10)}`,
        ),
      ),
      ...recentlyOverdue.map((item) =>
        this.safeNotify(
          item.membership.userId,
          NotificationType.CONTRIBUTION_OVERDUE,
          'Contribution overdue',
          `${item.schedule.name} in ${item.schedule.group.name} is overdue since ${item.dueDate.toLocaleDateString('en-KE')}. Expected amount: ${item.currency} ${Number(item.expectedAmount).toLocaleString('en-KE')}.`,
          {
            obligationId: item.id,
            groupId: item.schedule.group.id,
            dueDate: item.dueDate,
            expectedAmount: Number(item.expectedAmount),
            currency: item.currency,
          },
          `obligation-overdue:${item.id}`,
        ),
      ),
    ]);
  }

  async createSchedule(
    userId: string,
    groupId: string,
    input: CreateContributionScheduleDto,
  ) {
    await this.groupsService.ensureGroupManager(userId, groupId);

    const normalized = this.normalizeScheduleInput(input);

    const created = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.contributionSchedule.create({
        data: {
          groupId,
          createdById: userId,
          updatedById: userId,
          name: normalized.name,
          amount: new Prisma.Decimal(normalized.amount.toFixed(2)),
          currency: normalized.currency,
          frequency: normalized.frequency,
          dueDayOfWeek: normalized.dueDayOfWeek,
          dueDayOfMonth: normalized.dueDayOfMonth,
          graceDays: normalized.graceDays,
          startsOn: normalized.startsOn,
          endsOn: normalized.endsOn,
          isActive: true,
        },
      });

      await this.syncObligationsForSchedule(tx, schedule.id);

      return schedule;
    });

    await this.refreshOverdueObligations();

    return this.getScheduleByIdForGroup(userId, groupId, created.id);
  }

  async listGroupSchedules(userId: string, groupId: string) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    await this.refreshOverdueObligations();

    const schedules = await this.prisma.contributionSchedule.findMany({
      where: { groupId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: {
          select: { obligations: true },
        },
        obligations: {
          where: {
            dueDate: {
              gte: this.addDays(new Date(), -OBLIGATION_LOOKBACK_DAYS),
              lte: this.addDays(new Date(), OBLIGATION_LOOKAHEAD_DAYS),
            },
          },
          select: {
            id: true,
            status: true,
            dueDate: true,
            expectedAmount: true,
            paidAt: true,
            membership: {
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
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return schedules.map((schedule) => ({
      id: schedule.id,
      groupId: schedule.groupId,
      name: schedule.name,
      amount: Number(schedule.amount),
      currency: schedule.currency,
      frequency: schedule.frequency,
      dueDayOfWeek: schedule.dueDayOfWeek,
      dueDayOfMonth: schedule.dueDayOfMonth,
      graceDays: schedule.graceDays,
      startsOn: schedule.startsOn,
      endsOn: schedule.endsOn,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      obligationCount: schedule._count.obligations,
      obligations: schedule.obligations.map((obligation) => ({
        id: obligation.id,
        dueDate: obligation.dueDate,
        status: obligation.status,
        expectedAmount: Number(obligation.expectedAmount),
        paidAt: obligation.paidAt,
        member: obligation.membership.user,
      })),
    }));
  }

  async getScheduleByIdForGroup(
    userId: string,
    groupId: string,
    scheduleId: string,
  ) {
    await this.groupsService.ensureGroupMember(userId, groupId);

    const schedule = await this.prisma.contributionSchedule.findFirst({
      where: {
        id: scheduleId,
        groupId,
      },
      include: {
        obligations: {
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
          take: 60,
          select: {
            id: true,
            status: true,
            dueDate: true,
            expectedAmount: true,
            currency: true,
            paidAt: true,
            paidContributionId: true,
            membership: {
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
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Contribution schedule not found');
    }

    return {
      id: schedule.id,
      groupId: schedule.groupId,
      name: schedule.name,
      amount: Number(schedule.amount),
      currency: schedule.currency,
      frequency: schedule.frequency,
      dueDayOfWeek: schedule.dueDayOfWeek,
      dueDayOfMonth: schedule.dueDayOfMonth,
      graceDays: schedule.graceDays,
      startsOn: schedule.startsOn,
      endsOn: schedule.endsOn,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
      obligations: schedule.obligations.map((obligation) => ({
        id: obligation.id,
        dueDate: obligation.dueDate,
        expectedAmount: Number(obligation.expectedAmount),
        currency: obligation.currency,
        status: obligation.status,
        paidAt: obligation.paidAt,
        paidContributionId: obligation.paidContributionId,
        member: obligation.membership.user,
      })),
    };
  }

  async updateSchedule(
    userId: string,
    groupId: string,
    scheduleId: string,
    input: UpdateContributionScheduleDto,
  ) {
    await this.groupsService.ensureGroupManager(userId, groupId);

    const existing = await this.prisma.contributionSchedule.findFirst({
      where: {
        id: scheduleId,
        groupId,
      },
      select: {
        id: true,
        groupId: true,
        startsOn: true,
        endsOn: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Contribution schedule not found');
    }

    const mergedInput: CreateContributionScheduleDto = {
      name: input.name ?? 'Schedule',
      amount: input.amount ?? 1,
      currency: input.currency,
      frequency: input.frequency ?? ScheduleFrequency.MONTHLY,
      dueDayOfWeek: input.dueDayOfWeek,
      dueDayOfMonth: input.dueDayOfMonth,
      graceDays: input.graceDays,
      startsOn: input.startsOn ?? existing.startsOn.toISOString(),
      endsOn: input.endsOn ?? existing.endsOn?.toISOString(),
    };

    const normalized = this.normalizeScheduleInput(mergedInput);

    await this.prisma.$transaction(async (tx) => {
      await tx.contributionSchedule.update({
        where: { id: scheduleId },
        data: {
          name: input.name?.trim(),
          amount:
            input.amount === undefined
              ? undefined
              : new Prisma.Decimal(input.amount.toFixed(2)),
          currency: input.currency?.trim().toUpperCase(),
          frequency: input.frequency,
          dueDayOfWeek: input.dueDayOfWeek,
          dueDayOfMonth: input.dueDayOfMonth,
          graceDays: input.graceDays,
          startsOn: input.startsOn ? new Date(input.startsOn) : undefined,
          endsOn:
            input.endsOn === undefined
              ? undefined
              : input.endsOn
                ? new Date(input.endsOn)
                : null,
          isActive: input.isActive,
          updatedById: userId,
        },
      });

      await this.syncObligationsForSchedule(tx, scheduleId);
    });

    await this.refreshOverdueObligations();

    return this.getScheduleByIdForGroup(userId, groupId, scheduleId);
  }

  async getMyObligations(
    userId: string,
    filters?: {
      status?: ObligationStatus;
      groupId?: string;
      limit?: number;
    },
  ) {
    await this.refreshOverdueObligations();

    if (filters?.groupId) {
      await this.groupsService.ensureGroupMember(userId, filters.groupId);
    }

    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);

    const obligations = await this.prisma.contributionObligation.findMany({
      where: {
        status: filters?.status,
        membership: {
          userId,
          status: {
            not: MembershipStatus.LEFT,
          },
          groupId: filters?.groupId,
        },
      },
      orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        dueDate: true,
        expectedAmount: true,
        currency: true,
        status: true,
        paidAt: true,
        waivedReason: true,
        schedule: {
          select: {
            id: true,
            name: true,
            frequency: true,
            graceDays: true,
            group: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return obligations.map((item) => ({
      id: item.id,
      dueDate: item.dueDate,
      expectedAmount: Number(item.expectedAmount),
      currency: item.currency,
      status: item.status,
      paidAt: item.paidAt,
      waivedReason: item.waivedReason,
      schedule: item.schedule,
    }));
  }

  async refreshOverdueObligations() {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ContributionObligation" AS o
        SET "status" = 'OVERDUE', "updatedAt" = NOW()
        FROM "ContributionSchedule" AS s
        WHERE o."scheduleId" = s."id"
          AND o."status" = 'PENDING'
          AND o."dueDate" + make_interval(days => s."graceDays") < NOW()
      `,
    );

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "ContributionObligation" AS o
        SET "status" = 'PENDING', "updatedAt" = NOW()
        FROM "ContributionSchedule" AS s
        WHERE o."scheduleId" = s."id"
          AND o."status" = 'OVERDUE'
          AND o."dueDate" + make_interval(days => s."graceDays") >= NOW()
      `,
    );
  }

  private normalizeScheduleInput(input: CreateContributionScheduleDto) {
    const startsOn = new Date(input.startsOn);
    if (Number.isNaN(startsOn.getTime())) {
      throw new BadRequestException('Schedule start date is invalid');
    }

    const endsOn = input.endsOn ? new Date(input.endsOn) : null;
    if (endsOn && Number.isNaN(endsOn.getTime())) {
      throw new BadRequestException('Schedule end date is invalid');
    }

    if (endsOn && endsOn <= startsOn) {
      throw new BadRequestException(
        'Schedule end date must be after start date',
      );
    }

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Schedule name is required');
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Schedule amount must be greater than 0');
    }

    const currency = input.currency?.trim().toUpperCase() || 'KES';
    if (currency.length !== 3) {
      throw new BadRequestException(
        'Schedule currency must be a 3-letter ISO code',
      );
    }

    const graceDays = input.graceDays ?? 0;

    if (input.frequency === ScheduleFrequency.WEEKLY) {
      if (input.dueDayOfWeek === undefined) {
        throw new BadRequestException(
          'Weekly schedules require dueDayOfWeek (0-6)',
        );
      }
    } else if (input.dueDayOfMonth === undefined) {
      throw new BadRequestException(
        'Monthly, quarterly, and yearly schedules require dueDayOfMonth (1-28)',
      );
    }

    return {
      name,
      amount,
      currency,
      frequency: input.frequency,
      dueDayOfWeek:
        input.frequency === ScheduleFrequency.WEEKLY
          ? (input.dueDayOfWeek ?? null)
          : null,
      dueDayOfMonth:
        input.frequency === ScheduleFrequency.WEEKLY
          ? null
          : (input.dueDayOfMonth ?? null),
      graceDays,
      startsOn,
      endsOn,
    };
  }

  private async syncObligationsForSchedule(
    tx: Prisma.TransactionClient,
    scheduleId: string,
  ) {
    const schedule = await tx.contributionSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        groupId: true,
        amount: true,
        currency: true,
        frequency: true,
        dueDayOfWeek: true,
        dueDayOfMonth: true,
        startsOn: true,
        endsOn: true,
        isActive: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Contribution schedule not found');
    }

    if (!schedule.isActive) {
      return;
    }

    const now = new Date();
    const rangeStart = new Date(
      Math.max(
        schedule.startsOn.getTime(),
        this.addDays(now, -OBLIGATION_LOOKBACK_DAYS).getTime(),
      ),
    );

    const configuredEnd = schedule.endsOn?.getTime();
    const rangeEnd = new Date(
      Math.min(
        configuredEnd ?? Number.POSITIVE_INFINITY,
        this.addDays(now, OBLIGATION_LOOKAHEAD_DAYS).getTime(),
      ),
    );

    if (rangeEnd < rangeStart) {
      return;
    }

    const dueDates = this.generateDueDatesForSchedule(
      schedule.frequency,
      rangeStart,
      rangeEnd,
      schedule.startsOn,
      schedule.dueDayOfWeek,
      schedule.dueDayOfMonth,
    );

    if (dueDates.length === 0) {
      return;
    }

    const memberships = await tx.groupMembership.findMany({
      where: {
        groupId: schedule.groupId,
        status: MembershipStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (memberships.length === 0) {
      return;
    }

    const rows: Prisma.ContributionObligationCreateManyInput[] = [];

    for (const membership of memberships) {
      for (const dueDate of dueDates) {
        rows.push({
          scheduleId: schedule.id,
          membershipId: membership.id,
          dueDate,
          expectedAmount: schedule.amount,
          currency: schedule.currency,
          status: ObligationStatus.PENDING,
        });
      }
    }

    await tx.contributionObligation.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  private generateDueDatesForSchedule(
    frequency: ScheduleFrequency,
    rangeStart: Date,
    rangeEnd: Date,
    scheduleStart: Date,
    dueDayOfWeek: number | null,
    dueDayOfMonth: number | null,
  ) {
    const results: Date[] = [];

    if (frequency === ScheduleFrequency.WEEKLY) {
      const targetDay = dueDayOfWeek ?? scheduleStart.getDay();
      const cursor = new Date(rangeStart);
      cursor.setHours(0, 0, 0, 0);
      while (cursor.getDay() !== targetDay) {
        cursor.setDate(cursor.getDate() + 1);
      }

      while (cursor <= rangeEnd) {
        if (cursor >= scheduleStart) {
          results.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 7);
      }

      return results;
    }

    const targetDay = dueDayOfMonth ?? Math.min(scheduleStart.getDate(), 28);
    const stepMonths =
      frequency === ScheduleFrequency.MONTHLY
        ? 1
        : frequency === ScheduleFrequency.QUARTERLY
          ? 3
          : 12;

    const cursor = new Date(scheduleStart);
    cursor.setHours(0, 0, 0, 0);
    cursor.setDate(Math.min(targetDay, 28));

    while (cursor < rangeStart) {
      cursor.setMonth(cursor.getMonth() + stepMonths);
      cursor.setDate(Math.min(targetDay, 28));
    }

    while (cursor <= rangeEnd) {
      if (cursor >= scheduleStart) {
        results.push(new Date(cursor));
      }
      cursor.setMonth(cursor.getMonth() + stepMonths);
      cursor.setDate(Math.min(targetDay, 28));
    }

    return results;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private async safeNotify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata: Prisma.InputJsonValue,
    dedupeKey: string,
  ) {
    try {
      await this.notificationsService.createNotification({
        userId,
        type,
        title,
        message,
        metadata,
        dedupeKey,
      });
    } catch {
      // Reminder failures should not break scheduler runs.
    }
  }

  async settleObligationsFromContribution(
    tx: Prisma.TransactionClient,
    membershipId: string,
    contributionId: string,
    amount: Prisma.Decimal,
    currency: string,
    paidAt: Date,
  ) {
    let remaining = new Prisma.Decimal(amount);

    while (remaining.greaterThan(0)) {
      const obligation = await tx.contributionObligation.findFirst({
        where: {
          membershipId,
          currency,
          status: {
            in: [ObligationStatus.PENDING, ObligationStatus.OVERDUE],
          },
          expectedAmount: {
            lte: remaining,
          },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          expectedAmount: true,
        },
      });

      if (!obligation) {
        break;
      }

      await tx.contributionObligation.update({
        where: { id: obligation.id },
        data: {
          status: ObligationStatus.PAID,
          paidAt,
          paidContributionId: contributionId,
        },
      });

      remaining = remaining.minus(obligation.expectedAmount);
    }
  }
}
