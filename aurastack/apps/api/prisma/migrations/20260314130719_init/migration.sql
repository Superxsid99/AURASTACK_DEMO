-- AlterTable
ALTER TABLE "CaseRecord" ADD COLUMN     "memberEmail" TEXT,
ADD COLUMN     "memberId" TEXT,
ADD COLUMN     "policyNumber" TEXT;

-- AlterTable
ALTER TABLE "IntakeJob" ADD COLUMN     "context" JSONB,
ADD COLUMN     "workflowId" TEXT;

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "intakeEmail" TEXT NOT NULL,
    "claimKeywords" JSONB NOT NULL,
    "requiredFields" JSONB NOT NULL,
    "flowConfig" JSONB NOT NULL,
    "ocrAgentId" TEXT,
    "validationAgentId" TEXT,
    "policyAgentId" TEXT,
    "decisionAgentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "caseId" TEXT,
    "intakeJobId" TEXT,
    "inboundEmailId" TEXT,
    "status" TEXT NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT,
    "caseId" TEXT,
    "intakeJobId" TEXT,
    "workflowRunId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "documents" JSONB,
    "classification" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "parsedFields" JSONB,
    "missingFields" JSONB,
    "requestEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceMember" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "payerName" TEXT NOT NULL,
    "coverageStatus" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundNotification" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "intakeJobId" TEXT,
    "inboundEmailId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_name_key" ON "WorkflowDefinition"("name");

-- CreateIndex
CREATE INDEX "WorkflowRun_workflowId_createdAt_idx" ON "WorkflowRun"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowRun_caseId_createdAt_idx" ON "WorkflowRun"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEmail_workflowId_createdAt_idx" ON "InboundEmail"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEmail_caseId_createdAt_idx" ON "InboundEmail"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "InboundEmail_intakeJobId_createdAt_idx" ON "InboundEmail"("intakeJobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceMember_memberId_key" ON "InsuranceMember"("memberId");

-- CreateIndex
CREATE INDEX "InsuranceMember_policyNumber_idx" ON "InsuranceMember"("policyNumber");

-- CreateIndex
CREATE INDEX "InsuranceMember_email_idx" ON "InsuranceMember"("email");

-- CreateIndex
CREATE INDEX "OutboundNotification_caseId_createdAt_idx" ON "OutboundNotification"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotification_inboundEmailId_createdAt_idx" ON "OutboundNotification"("inboundEmailId", "createdAt");
