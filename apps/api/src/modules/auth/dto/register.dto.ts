import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  firstName!: string;

  @IsString()
  @MinLength(2)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  lastName!: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone?: string;
}
