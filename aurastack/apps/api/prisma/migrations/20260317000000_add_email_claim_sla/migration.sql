-- AlterTable: Add new optional fields to CaseRecord
ALTER TABLE "CaseRecord" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "CaseRecord" ADD COLUMN "claimClassification" TEXT;
ALTER TABLE "CaseRecord" ADD COLUMN "policyNumber" TEXT;
ALTER TABLE "CaseRecord" ADD COLUMN "claimAmount" DOUBLE PRECISION;
ALTER TABLE "CaseRecord" ADD COLUMN "incidentDate" TIMESTAMP(3);
ALTER TABLE "CaseRecord" ADD COLUMN "slaDeadline" TIMESTAMP(3);
ALTER TABLE "CaseRecord" ADD COLUMN "slaBreached" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: EmailThread
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "messageId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "status" TEXT NOT NULL DEFAULT 'new',
    "rawHeaders" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClaimType
CREATE TABLE "ClaimType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workflowKey" TEXT,
    "requiredDocuments" JSONB,
    "slaHours" INTEGER NOT NULL DEFAULT 48,
    "autoApproveThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.92,
    "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "validationRules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClaimType_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SLAPolicy
CREATE TABLE "SLAPolicy" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "metAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SLAPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "EmailThread_messageId_key" ON "EmailThread"("messageId");
CREATE UNIQUE INDEX "ClaimType_key_key" ON "ClaimType"("key");
CREATE UNIQUE INDEX "SLAPolicy_caseId_key" ON "SLAPolicy"("caseId");

-- CreateIndex
CREATE INDEX "EmailThread_caseId_createdAt_idx" ON "EmailThread"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SLAPolicy" ADD CONSTRAINT "SLAPolicy_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
