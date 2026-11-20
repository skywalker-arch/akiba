import { Module } from '@nestjs/common';
import { GroupInvitationsController } from './group-invitations.controller';
import { InvitationDeliveryService } from './invitation-delivery.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [GroupsController, GroupInvitationsController],
  providers: [GroupsService, InvitationDeliveryService],
  exports: [GroupsService],
})
export class GroupsModule {}
