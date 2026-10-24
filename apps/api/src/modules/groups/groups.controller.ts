import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { GroupsService } from './groups.service';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(
    @CurrentUser() user: { sub: string; email: string },
    @Body() body: CreateGroupDto,
  ) {
    return this.groupsService.createGroup(user.sub, body);
  }

  @Get()
  getMyGroups(@CurrentUser() user: { sub: string; email: string }) {
    return this.groupsService.getMyGroups(user.sub);
  }

  @Get(':id')
  getGroupById(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groupsService.getGroupById(user.sub, id);
  }

  @Get(':id/balance')
  getGroupBalance(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.groupsService.getGroupBalance(user.sub, id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AddMemberDto,
  ) {
    return this.groupsService.addMember(user.sub, id, body);
  }

  @Get(':id/member-candidates')
  searchMemberCandidates(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('query') query: string,
  ) {
    return this.groupsService.searchMemberCandidates(user.sub, id, query ?? '');
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.groupsService.updateMember(user.sub, id, memberId, body);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(204)
  async removeMember(
    @CurrentUser() user: { sub: string; email: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ): Promise<void> {
    await this.groupsService.removeMember(user.sub, id, memberId);
  }
}
