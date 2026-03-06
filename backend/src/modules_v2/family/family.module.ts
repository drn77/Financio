import { Module } from '@nestjs/common';
import { FamilyController } from './family.controller';
import { FamilyContextService } from './family-context.service';
import { FamilyActionsService } from './family-actions.service';

@Module({
  controllers: [FamilyController],
  providers: [FamilyContextService, FamilyActionsService],
  exports: [FamilyActionsService],
})
export class FamilyModule {}
