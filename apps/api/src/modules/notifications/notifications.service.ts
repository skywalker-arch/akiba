import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listNotifications(userId: string, query: ListNotificationsDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return items;
  }

  async getSummary(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      unreadCount,
    };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
      },
    });
  }

  async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesDto,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        contributionDueEnabled: input.contributionDueEnabled,
        contributionOverdueEnabled: input.contributionOverdueEnabled,
        contributionPostedEnabled: input.contributionPostedEnabled,
        loanStatusEnabled: input.loanStatusEnabled,
        systemEnabled: input.systemEnabled,
      },
      create: {
        userId,
        contributionDueEnabled: input.contributionDueEnabled ?? true,
        contributionOverdueEnabled: input.contributionOverdueEnabled ?? true,
        contributionPostedEnabled: input.contributionPostedEnabled ?? true,
        loanStatusEnabled: input.loanStatusEnabled ?? true,
        systemEnabled: input.systemEnabled ?? true,
      },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const item = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Notification not found');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this notification',
      );
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  async createNotification(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
    dedupeKey?: string;
  }) {
    const enabled = await this.isNotificationEnabled(input.userId, input.type);
    if (!enabled) {
      return null;
    }

    return this.prisma.notification
      .create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
          metadata: input.metadata,
          dedupeKey: input.dedupeKey,
        },
      })
      .catch((error) => {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          input.dedupeKey
        ) {
          return null;
        }

        throw error;
      });
  }

  private async isNotificationEnabled(userId: string, type: NotificationType) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
      select: {
        contributionDueEnabled: true,
        contributionOverdueEnabled: true,
        contributionPostedEnabled: true,
        loanStatusEnabled: true,
        systemEnabled: true,
      },
    });

    if (!preference) {
      return true;
    }

    if (type === NotificationType.CONTRIBUTION_DUE) {
      return preference.contributionDueEnabled;
    }

    if (type === NotificationType.CONTRIBUTION_OVERDUE) {
      return preference.contributionOverdueEnabled;
    }

    if (type === NotificationType.CONTRIBUTION_POSTED) {
      return preference.contributionPostedEnabled;
    }

    if (type === NotificationType.LOAN_STATUS) {
      return preference.loanStatusEnabled;
    }

    return preference.systemEnabled;
  }
}
