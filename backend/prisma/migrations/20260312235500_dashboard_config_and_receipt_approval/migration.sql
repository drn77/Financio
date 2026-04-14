-- Add dashboard configuration to families
ALTER TABLE "families"
ADD COLUMN "dashboardConfig" JSONB DEFAULT '{}'::jsonb;

-- Receipt OCR + approval lifecycle
CREATE TYPE "ReceiptOcrStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

ALTER TABLE "receipts"
ADD COLUMN "ocrStatus" "ReceiptOcrStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "ocrError" TEXT,
ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Existing receipts are treated as already reviewed/accepted
UPDATE "receipts"
SET "isApproved" = true,
    "approvedAt" = COALESCE("updatedAt", "createdAt")
WHERE "isApproved" = false;
