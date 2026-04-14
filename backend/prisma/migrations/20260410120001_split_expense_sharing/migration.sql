-- CreateEnum
CREATE TYPE "SplitStatus" AS ENUM ('ACTIVE', 'SETTLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "splits" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "status" "SplitStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_participants" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "userId" TEXT,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "guestToken" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_messages" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "content" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "splitReceiptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_receipts" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "uploadedByParticipantId" TEXT NOT NULL,
    "paidByParticipantId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "storeName" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "ocrRawText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "split_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_receipt_items" (
    "id" TEXT NOT NULL,
    "splitReceiptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "split_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "split_item_claims" (
    "id" TEXT NOT NULL,
    "splitReceiptItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "split_item_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "splits_inviteCode_key" ON "splits"("inviteCode");
CREATE INDEX "splits_eventId_idx" ON "splits"("eventId");
CREATE INDEX "splits_inviteCode_idx" ON "splits"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "split_participants_guestToken_key" ON "split_participants"("guestToken");
CREATE UNIQUE INDEX "split_participants_splitId_userId_key" ON "split_participants"("splitId", "userId");
CREATE INDEX "split_participants_splitId_idx" ON "split_participants"("splitId");
CREATE INDEX "split_participants_guestToken_idx" ON "split_participants"("guestToken");

-- CreateIndex
CREATE INDEX "split_messages_splitId_createdAt_idx" ON "split_messages"("splitId", "createdAt");

-- CreateIndex
CREATE INDEX "split_receipts_splitId_idx" ON "split_receipts"("splitId");

-- CreateIndex
CREATE INDEX "split_receipt_items_splitReceiptId_idx" ON "split_receipt_items"("splitReceiptId");

-- CreateIndex
CREATE UNIQUE INDEX "split_item_claims_splitReceiptItemId_participantId_key" ON "split_item_claims"("splitReceiptItemId", "participantId");
CREATE INDEX "split_item_claims_splitReceiptItemId_idx" ON "split_item_claims"("splitReceiptItemId");

-- AddForeignKey
ALTER TABLE "splits" ADD CONSTRAINT "splits_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_participants" ADD CONSTRAINT "split_participants_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_messages" ADD CONSTRAINT "split_messages_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "split_messages" ADD CONSTRAINT "split_messages_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "split_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_receipts" ADD CONSTRAINT "split_receipts_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "splits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "split_receipts" ADD CONSTRAINT "split_receipts_paidByParticipantId_fkey" FOREIGN KEY ("paidByParticipantId") REFERENCES "split_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_receipt_items" ADD CONSTRAINT "split_receipt_items_splitReceiptId_fkey" FOREIGN KEY ("splitReceiptId") REFERENCES "split_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "split_item_claims" ADD CONSTRAINT "split_item_claims_splitReceiptItemId_fkey" FOREIGN KEY ("splitReceiptItemId") REFERENCES "split_receipt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "split_item_claims" ADD CONSTRAINT "split_item_claims_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "split_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
