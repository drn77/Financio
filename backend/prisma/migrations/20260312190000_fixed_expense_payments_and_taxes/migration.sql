-- Add family tax config and extend fixed expenses for payment execution flow
ALTER TABLE "families"
  ADD COLUMN "taxConfig" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "fixed_expenses"
  ADD COLUMN "nextDueDate" TIMESTAMP(3),
  ADD COLUMN "lastPaidAt" TIMESTAMP(3),
  ADD COLUMN "paymentTagId" TEXT,
  ADD COLUMN "paymentTemplateData" JSONB;
