import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { DisburseLoanDto } from './dto/disburse-loan.dto';
import { ReviewLoanDto } from './dto/review-loan.dto';
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

  @Get('groups/:groupId/loans/:loanId')
  getLoanById(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
  ) {
    return this.loansService.getLoanById(user.sub, groupId, loanId);
  }

  @Patch('groups/:groupId/loans/:loanId/review')
  reviewLoan(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Body() body: ReviewLoanDto,
  ) {
    return this.loansService.reviewLoan(user.sub, groupId, loanId, body);
  }

  @Post('groups/:groupId/loans/:loanId/disburse')
  disburseLoan(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Body() body: DisburseLoanDto,
  ) {
    return this.loansService.disburseLoan(user.sub, groupId, loanId, body);
  }

  @Post('groups/:groupId/loans/:loanId/repayments')
  createRepayment(
    @CurrentUser() user: { sub: string; email: string },
    @Param('groupId', new ParseUUIDPipe()) groupId: string,
    @Param('loanId', new ParseUUIDPipe()) loanId: string,
    @Body() body: CreateLoanRepaymentDto,
  ) {
    return this.loansService.createRepayment(user.sub, groupId, loanId, body);
  }
}
