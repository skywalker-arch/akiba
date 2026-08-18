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
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoansService } from './loans.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('groups/:groupId/loans')
  createLoan(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Body() body: CreateLoanDto,
  ) {
    return this.loansService.createLoan(user.sub, groupId, body);
  }

  @Get('groups/:groupId/loans')
  getGroupLoans(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
  ) {
    return this.loansService.getGroupLoans(user.sub, groupId);
  }
}
