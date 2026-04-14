-- Add title and issuePlace columns to invoices
ALTER TABLE "invoices" ADD COLUMN "title" TEXT;
ALTER TABLE "invoices" ADD COLUMN "issuePlace" TEXT;
