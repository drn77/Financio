import { Module } from '@nestjs/common';
import { SplitController } from './split.controller';
import { SplitContextService } from './split-context.service';
import { SplitActionsService } from './split-actions.service';
import { SplitGateway } from './split.gateway';
import { SplitAuthGuard } from '../../shared/guards/split-auth.guard';

@Module({
  controllers: [SplitController],
  providers: [SplitContextService, SplitActionsService, SplitGateway, SplitAuthGuard],
  exports: [SplitGateway],
})
export class SplitModule {}
