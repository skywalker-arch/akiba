import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContributionsService } from './contributions.service';
import {
  CreateContributionDto,
  RejectContributionDto,
} from './dto/create-contribution.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post('groups/:groupId/contributions')
  createContribution(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() body: CreateContributionDto,
  ) {
    return this.contributionsService.createContribution(user.sub, groupId, body);
  }

  @Post('groups/:groupId/contributions/:contributionId/approve')
  approveContribution(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('contributionId', new ParseUUIDPipe()) contributionId: string,
  ) {
    return this.contributionsService.approveContribution(
      user.sub,
      groupId,
      contributionId,
    );
  }

  @Post('groups/:groupId/contributions/:contributionId/reject')
  rejectContribution(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('contributionId', new ParseUUIDPipe()) contributionId: string,
    @Body() body: RejectContributionDto,
  ) {
    return this.contributionsService.rejectContribution(
      user.sub,
      groupId,
      contributionId,
      body,
    );
  }

  @Get('groups/:groupId/contributions')
  getGroupContributions(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ) {
    return this.contributionsService.getGroupContributions(user.sub, groupId);
  }

  @Get('contributions/:id')
  getContributionById(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.contributionsService.getContributionById(user.sub, id);
  }

  @Get('transactions')
  getUserTransactions(
    @CurrentUser() user: { sub: string; email: string },
    @Query() query: { type?: string; status?: string; groupId?: string },
  ) {
    return this.contributionsService.getUserTransactions(user.sub, query);
  }
}
