import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateGoalMilestoneDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }

    return value;
  })
  @IsBoolean()
  isCompleted?: boolean;
}
