import { MembershipRole, MembershipStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
