-- Fix column naming: snake_case -> camelCase to match Prisma schema (no @map annotations)

-- ═══ invoices table: rename new columns ═══
ALTER TABLE "invoices" RENAME COLUMN "exchange_rate" TO "exchangeRate";
ALTER TABLE "invoices" RENAME COLUMN "exchange_currency" TO "exchangeCurrency";
ALTER TABLE "invoices" RENAME COLUMN "sent_at" TO "sentAt";
ALTER TABLE "invoices" RENAME COLUMN "sent_to" TO "sentTo";
ALTER TABLE "invoices" RENAME COLUMN "recurring_invoice_id" TO "recurringInvoiceId";

-- Drop old FK on invoices.recurring_invoice_id
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_recurring_invoice_id_fkey";
-- Re-add FK with camelCase column
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══ recurring_invoices table: rename columns ═══
ALTER TABLE "recurring_invoices" RENAME COLUMN "family_id" TO "familyId";
ALTER TABLE "recurring_invoices" RENAME COLUMN "is_active" TO "isActive";
ALTER TABLE "recurring_invoices" RENAME COLUMN "next_issue_date" TO "nextIssueDate";
ALTER TABLE "recurring_invoices" RENAME COLUMN "last_issued_at" TO "lastIssuedAt";
ALTER TABLE "recurring_invoices" RENAME COLUMN "seller_id" TO "sellerId";
ALTER TABLE "recurring_invoices" RENAME COLUMN "buyer_id" TO "buyerId";
ALTER TABLE "recurring_invoices" RENAME COLUMN "payment_method" TO "paymentMethod";
ALTER TABLE "recurring_invoices" RENAME COLUMN "bank_account" TO "bankAccount";
ALTER TABLE "recurring_invoices" RENAME COLUMN "due_days" TO "dueDays";
ALTER TABLE "recurring_invoices" RENAME COLUMN "auto_issue" TO "autoIssue";
ALTER TABLE "recurring_invoices" RENAME COLUMN "auto_send" TO "autoSend";
ALTER TABLE "recurring_invoices" RENAME COLUMN "items_template" TO "itemsTemplate";
ALTER TABLE "recurring_invoices" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "recurring_invoices" RENAME COLUMN "updated_at" TO "updatedAt";

-- Drop old FKs on recurring_invoices
ALTER TABLE "recurring_invoices" DROP CONSTRAINT IF EXISTS "recurring_invoices_family_id_fkey";
ALTER TABLE "recurring_invoices" DROP CONSTRAINT IF EXISTS "recurring_invoices_seller_id_fkey";
ALTER TABLE "recurring_invoices" DROP CONSTRAINT IF EXISTS "recurring_invoices_buyer_id_fkey";

-- Drop old indexes on recurring_invoices
DROP INDEX IF EXISTS "recurring_invoices_family_id_is_active_idx";
DROP INDEX IF EXISTS "recurring_invoices_next_issue_date_idx";

-- Re-create indexes with camelCase columns
CREATE INDEX "recurring_invoices_familyId_isActive_idx" ON "recurring_invoices"("familyId", "isActive");
CREATE INDEX "recurring_invoices_nextIssueDate_idx" ON "recurring_invoices"("nextIssueDate");

-- Re-add FKs with camelCase columns
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══ invoice_audit_logs table: rename columns ═══
ALTER TABLE "invoice_audit_logs" RENAME COLUMN "invoice_id" TO "invoiceId";
ALTER TABLE "invoice_audit_logs" RENAME COLUMN "user_id" TO "userId";
ALTER TABLE "invoice_audit_logs" RENAME COLUMN "user_name" TO "userName";
ALTER TABLE "invoice_audit_logs" RENAME COLUMN "created_at" TO "createdAt";

-- Drop old FK and index on invoice_audit_logs
ALTER TABLE "invoice_audit_logs" DROP CONSTRAINT IF EXISTS "invoice_audit_logs_invoice_id_fkey";
DROP INDEX IF EXISTS "invoice_audit_logs_invoice_id_idx";

-- Re-create index with camelCase column
CREATE INDEX "invoice_audit_logs_invoiceId_idx" ON "invoice_audit_logs"("invoiceId");

-- Re-add FK with camelCase column
ALTER TABLE "invoice_audit_logs" ADD CONSTRAINT "invoice_audit_logs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
