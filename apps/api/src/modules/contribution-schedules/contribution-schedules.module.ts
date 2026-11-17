import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContributionSchedulesController } from './contribution-schedules.controller';
import { ContributionSchedulesService } from './contribution-schedules.service';

@Module({
  imports: [GroupsModule, NotificationsModule],
  controllers: [ContributionSchedulesController],
  providers: [ContributionSchedulesService],
})
export class ContributionSchedulesModule {}
