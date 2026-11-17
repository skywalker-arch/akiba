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
import { ObligationStatus } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContributionScheduleDto } from './dto/create-contribution-schedule.dto';
import { UpdateContributionScheduleDto } from './dto/update-contribution-schedule.dto';
import { ContributionSchedulesService } from './contribution-schedules.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class ContributionSchedulesController {
  constructor(
    private readonly contributionSchedulesService: ContributionSchedulesService,
  ) {}

  @Post('groups/:groupId/contribution-schedules')
  createSchedule(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() body: CreateContributionScheduleDto,
  ) {
    return this.contributionSchedulesService.createSchedule(
      user.sub,
      groupId,
      body,
    );
  }

  @Get('groups/:groupId/contribution-schedules')
  listGroupSchedules(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ) {
    return this.contributionSchedulesService.listGroupSchedules(
      user.sub,
      groupId,
    );
  }

  @Patch('groups/:groupId/contribution-schedules/:scheduleId')
  updateSchedule(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('scheduleId', new ParseUUIDPipe()) scheduleId: string,
    @Body() body: UpdateContributionScheduleDto,
  ) {
    return this.contributionSchedulesService.updateSchedule(
      user.sub,
      groupId,
      scheduleId,
      body,
    );
  }

  @Get('users/me/contribution-obligations')
  getMyObligations(
    @CurrentUser() user: { sub: string; email: string },
    @Query('status') status?: ObligationStatus,
    @Query('groupId') groupId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const parsedLimit =
      typeof limitRaw === 'string' && limitRaw.trim().length > 0
        ? Number(limitRaw)
        : undefined;

    return this.contributionSchedulesService.getMyObligations(user.sub, {
      status,
      groupId,
      limit:
        parsedLimit !== undefined && Number.isFinite(parsedLimit)
          ? parsedLimit
          : undefined,
    });
  }
}
