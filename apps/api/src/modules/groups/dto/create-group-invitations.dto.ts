import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupInvitationsDto {
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  @Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item) =>
      typeof item === 'string' ? item.trim().toLowerCase() : item,
    );
  })
  emails?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  message?: string;
}
