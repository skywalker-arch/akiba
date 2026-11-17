import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGoalMilestoneDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetAmount!: number;

  @IsDateString()
  dueDate!: string;
}
