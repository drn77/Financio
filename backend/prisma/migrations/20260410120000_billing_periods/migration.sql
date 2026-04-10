-- AlterTable
ALTER TABLE "templates" ADD COLUMN "billingPeriod" JSONB;

-- CreateTable
CREATE TABLE "billing_period_overrides" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "overrideResetDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_period_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_period_overrides_templateId_periodStart_key" ON "billing_period_overrides"("templateId", "periodStart");

-- AddForeignKey
ALTER TABLE "billing_period_overrides" ADD CONSTRAINT "billing_period_overrides_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
