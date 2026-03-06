import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './shared/prisma/prisma.module';
import { AuthModule } from './modules_v2/auth/auth.module';
import { AdminModule } from './modules_v2/admin/admin.module';
import { FamilyModule } from './modules_v2/family/family.module';
import { CategoryModule } from './modules_v2/category/category.module';
import { BillModule } from './modules_v2/bill/bill.module';
import { ReceiptModule } from './modules_v2/receipt/receipt.module';
import { FixedExpenseModule } from './modules_v2/fixed-expense/fixed-expense.module';
import { SavingsModule } from './modules_v2/savings/savings.module';
import { DashboardModule } from './modules_v2/dashboard/dashboard.module';
import { TemplateModule } from './modules_v2/template/template.module';
import { TagModule } from './modules_v2/tag/tag.module';
import { StoreModule } from './modules_v2/store/store.module';
import { BudgetModule } from './modules_v2/budget/budget.module';
import { EventModule } from './modules_v2/event/event.module';
import { CsrfMiddleware } from './shared/middleware/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    FamilyModule,
    CategoryModule,
    TagModule,
    TemplateModule,
    BillModule,
    ReceiptModule,
    StoreModule,
    BudgetModule,
    EventModule,
    FixedExpenseModule,
    SavingsModule,
    DashboardModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
