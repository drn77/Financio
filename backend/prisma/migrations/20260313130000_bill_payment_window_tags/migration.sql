-- Add scheduling window and dynamic tag configuration for recurring bills
ALTER TABLE "bills"
ADD COLUMN "paymentStartDate" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "paymentEndDate" TIMESTAMP(3),
ADD COLUMN "tagBeforePaymentId" TEXT,
ADD COLUMN "tagAfterPaymentId" TEXT;

ALTER TABLE "bills"
ADD CONSTRAINT "bills_tagBeforePaymentId_fkey"
FOREIGN KEY ("tagBeforePaymentId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bills"
ADD CONSTRAINT "bills_tagAfterPaymentId_fkey"
FOREIGN KEY ("tagAfterPaymentId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "bills_tagBeforePaymentId_idx" ON "bills"("tagBeforePaymentId");
CREATE INDEX "bills_tagAfterPaymentId_idx" ON "bills"("tagAfterPaymentId");
