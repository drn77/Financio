import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreContextService } from './store-context.service';
import { StoreActionsService } from './store-actions.service';

@Module({
  controllers: [StoreController],
  providers: [StoreContextService, StoreActionsService],
  exports: [StoreActionsService],
})
export class StoreModule {}
