import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryContextService } from './category-context.service';
import { CategoryActionsService } from './category-actions.service';

@Module({
  controllers: [CategoryController],
  providers: [CategoryContextService, CategoryActionsService],
  exports: [CategoryActionsService],
})
export class CategoryModule {}
