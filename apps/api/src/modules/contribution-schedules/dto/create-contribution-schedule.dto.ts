import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ScheduleFrequency } from '@prisma/client';

export class CreateContributionScheduleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsEnum(ScheduleFrequency)
  frequency!: ScheduleFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dueDayOfWeek?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDayOfMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  graceDays?: number;

  @IsISO8601()
  startsOn!: string;

  @IsOptional()
  @IsISO8601()
  endsOn?: string;
}
