import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

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
    return this.contributionsService.createContribution(
      user.sub,
      groupId,
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
}
