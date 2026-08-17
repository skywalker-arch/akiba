import { IsEnum } from 'class-validator';
import { LoanStatus } from '@prisma/client';

export class UpdateLoanStatusDto {
  @IsEnum(LoanStatus)
  status!: LoanStatus;
}
