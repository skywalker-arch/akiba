import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { GetStatementQueryDto } from './dto/get-statement-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: { sub: string; email: string }) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: { sub: string; email: string },
    @Body() body: UpdateUserDto,
  ) {
    return this.usersService.updateMe(user.sub, body);
  }

  @Get('me/statement')
  getMyStatement(
    @CurrentUser() user: { sub: string; email: string },
    @Query() query: GetStatementQueryDto,
  ) {
    return this.usersService.getMyStatement(user.sub, query);
  }
}
