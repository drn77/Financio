-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('MANUAL', 'AUTO_PAY', 'DIRECT_DEBIT');

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "autoCreateExpense" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "budgetLimit" DECIMAL(12,2),
ADD COLUMN     "paymentType" "PaymentType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "reminderDays" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "tag_groups" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "tagGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2ECC71',
    "icon" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_tags" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "bill_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_groups_familyId_name_key" ON "tag_groups"("familyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_tagGroupId_name_key" ON "tags"("tagGroupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "bill_tags_billId_tagId_key" ON "bill_tags"("billId", "tagId");

-- CreateIndex
CREATE INDEX "bill_payments_billId_dueDate_idx" ON "bill_payments"("billId", "dueDate");

-- AddForeignKey
ALTER TABLE "tag_groups" ADD CONSTRAINT "tag_groups_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_tagGroupId_fkey" FOREIGN KEY ("tagGroupId") REFERENCES "tag_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tags" ADD CONSTRAINT "bill_tags_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_tags" ADD CONSTRAINT "bill_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
