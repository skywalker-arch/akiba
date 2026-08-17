import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @Type(() => Number)
  @IsPositive()
  principalAmount!: number;

  @Type(() => Number)
  @IsPositive()
  interestRate!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  termMonths!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;
}
