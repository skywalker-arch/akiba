import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ContributionSchedulesModule } from './modules/contribution-schedules/contribution-schedules.module';
import { ContributionsModule } from './modules/contributions/contributions.module';
import { GroupsModule } from './modules/groups/groups.module';
import { LoansModule } from './modules/loans/loans.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    ContributionSchedulesModule,
    ContributionsModule,
    GroupsModule,
    LoansModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
