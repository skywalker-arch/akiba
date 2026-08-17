import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [GroupsModule],
  controllers: [LoansController],
  providers: [LoansService],
})
export class LoansModule {}
