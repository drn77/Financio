-- Invoice extensions: recurring invoices, audit log, multi-currency, email sending

-- Add new columns to invoices
ALTER TABLE "invoices" ADD COLUMN "exchange_rate" DECIMAL(10, 4);
ALTER TABLE "invoices" ADD COLUMN "exchange_currency" TEXT;
ALTER TABLE "invoices" ADD COLUMN "sent_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "sent_to" TEXT;
ALTER TABLE "invoices" ADD COLUMN "recurring_invoice_id" TEXT;

-- Recurring Invoices table
CREATE TABLE "recurring_invoices" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
    "next_issue_date" TIMESTAMP(3) NOT NULL,
    "last_issued_at" TIMESTAMP(3),
    "type" TEXT NOT NULL DEFAULT 'STANDARD',
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'przelew',
    "bank_account" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "due_days" INTEGER NOT NULL DEFAULT 14,
    "notes" TEXT,
    "auto_issue" BOOLEAN NOT NULL DEFAULT false,
    "auto_send" BOOLEAN NOT NULL DEFAULT false,
    "items_template" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id")
);

-- Invoice Audit Log table
CREATE TABLE "invoice_audit_logs" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "user_id" TEXT,
    "user_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "recurring_invoices_family_id_is_active_idx" ON "recurring_invoices"("family_id", "is_active");
CREATE INDEX "recurring_invoices_next_issue_date_idx" ON "recurring_invoices"("next_issue_date");
CREATE INDEX "invoice_audit_logs_invoice_id_idx" ON "invoice_audit_logs"("invoice_id");

-- Foreign keys for recurring_invoices
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for invoice_audit_logs
ALTER TABLE "invoice_audit_logs" ADD CONSTRAINT "invoice_audit_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key for invoices -> recurring_invoices
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recurring_invoice_id_fkey" FOREIGN KEY ("recurring_invoice_id") REFERENCES "recurring_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
