/*
  Warnings:

  - You are about to drop the column `memberEmail` on the `CaseRecord` table. All the data in the column will be lost.
  - You are about to drop the column `memberId` on the `CaseRecord` table. All the data in the column will be lost.
  - You are about to drop the column `policyNumber` on the `CaseRecord` table. All the data in the column will be lost.
  - You are about to drop the column `context` on the `IntakeJob` table. All the data in the column will be lost.
  - You are about to drop the column `workflowId` on the `IntakeJob` table. All the data in the column will be lost.
  - You are about to drop the `InboundEmail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InsuranceMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OutboundNotification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkflowDefinition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WorkflowRun` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "CaseRecord" DROP COLUMN "memberEmail",
DROP COLUMN "memberId",
DROP COLUMN "policyNumber";

-- AlterTable
ALTER TABLE "IntakeJob" DROP COLUMN "context",
DROP COLUMN "workflowId";

-- DropTable
DROP TABLE "InboundEmail";

-- DropTable
DROP TABLE "InsuranceMember";

-- DropTable
DROP TABLE "OutboundNotification";

-- DropTable
DROP TABLE "WorkflowDefinition";

-- DropTable
DROP TABLE "WorkflowRun";

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stepType" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "config" JSONB,
    "nextStepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecutionStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowExecutionStep_executionId_idx" ON "WorkflowExecutionStep"("executionId");

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecutionStep" ADD CONSTRAINT "WorkflowExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
