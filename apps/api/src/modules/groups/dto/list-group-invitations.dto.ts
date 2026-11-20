import { GroupInvitationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListGroupInvitationsDto {
  @IsOptional()
  @IsEnum(GroupInvitationStatus)
  status?: GroupInvitationStatus;
}
