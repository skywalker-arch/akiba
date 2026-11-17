import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
