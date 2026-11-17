import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  contributionDueEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  contributionOverdueEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  contributionPostedEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  loanStatusEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  systemEnabled?: boolean;
}
