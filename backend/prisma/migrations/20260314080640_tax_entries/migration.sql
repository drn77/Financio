-- CreateTable
CREATE TABLE "tax_entries" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "calculatedAmount" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_entries_familyId_month_year_idx" ON "tax_entries"("familyId", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_entries_familyId_type_month_year_name_key" ON "tax_entries"("familyId", "type", "month", "year", "name");

-- AddForeignKey
ALTER TABLE "tax_entries" ADD CONSTRAINT "tax_entries_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
