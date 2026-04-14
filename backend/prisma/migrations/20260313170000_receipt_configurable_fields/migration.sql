ALTER TABLE "receipts"
ADD COLUMN "configurable_fields" JSONB NOT NULL DEFAULT '{}'::jsonb;
