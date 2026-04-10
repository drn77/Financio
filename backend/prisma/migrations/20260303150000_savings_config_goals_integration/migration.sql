-- AlterTable: Family – add savingsConfig
ALTER TABLE "families" ADD COLUMN "savingsConfig" JSONB;

-- AlterTable: SavingsGoal – add auto-expense fields
ALTER TABLE "savings_goals" ADD COLUMN "autoCreateExpense" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "savings_goals" ADD COLUMN "paymentTagId" TEXT;
ALTER TABLE "savings_goals" ADD COLUMN "paymentTemplateData" JSONB;

-- AlterTable: Bill – link to savings goal
ALTER TABLE "bills" ADD COLUMN "savingsGoalId" TEXT;

-- AlterTable: FixedExpense – link to savings goal
ALTER TABLE "fixed_expenses" ADD COLUMN "savingsGoalId" TEXT;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_savingsGoalId_fkey" FOREIGN KEY ("savingsGoalId") REFERENCES "savings_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_savingsGoalId_fkey" FOREIGN KEY ("savingsGoalId") REFERENCES "savings_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
