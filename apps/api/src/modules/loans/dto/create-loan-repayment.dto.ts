import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLoanRepaymentDto {
  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  reference!: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
