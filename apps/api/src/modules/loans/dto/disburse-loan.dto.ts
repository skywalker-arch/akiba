import { Type } from 'class-transformer';
import { IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class DisburseLoanDto {
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  amount?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  reference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
