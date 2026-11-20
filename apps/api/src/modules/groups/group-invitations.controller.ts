import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupsService } from './groups.service';

@Controller('group-invitations')
export class GroupInvitationsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get(':token')
  getInvitationByToken(@Param('token') token: string) {
    return this.groupsService.getInvitationByToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  acceptInvitation(
    @CurrentUser() user: { sub: string; email: string },
    @Param('token') token: string,
  ) {
    return this.groupsService.acceptInvitation(token, user.sub);
  }
}
