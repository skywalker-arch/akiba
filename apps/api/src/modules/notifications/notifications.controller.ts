import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(
    @CurrentUser() user: { sub: string; email: string },
    @Query() query: ListNotificationsDto,
  ) {
    return this.notificationsService.listNotifications(user.sub, query);
  }

  @Get('summary')
  getSummary(@CurrentUser() user: { sub: string; email: string }) {
    return this.notificationsService.getSummary(user.sub);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { sub: string; email: string }) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: { sub: string; email: string },
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, body);
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentUser() user: { sub: string; email: string },
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
  ) {
    return this.notificationsService.markRead(user.sub, notificationId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: { sub: string; email: string }) {
    return this.notificationsService.markAllRead(user.sub);
  }
}
