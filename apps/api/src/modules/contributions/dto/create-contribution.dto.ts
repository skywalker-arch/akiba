import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContributionDto {
  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  reference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RejectContributionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
