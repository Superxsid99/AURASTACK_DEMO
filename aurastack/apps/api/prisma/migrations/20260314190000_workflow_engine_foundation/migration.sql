-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "key" TEXT;

-- AlterTable
ALTER TABLE "WorkflowExecution" ADD COLUMN     "context" JSONB,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "input" JSONB,
ADD COLUMN     "output" JSONB,
ADD COLUMN     "source" TEXT,
ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable
ALTER TABLE "WorkflowExecutionStep" ADD COLUMN     "decision" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "stepName" TEXT NOT NULL,
ADD COLUMN     "stepType" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_key_key" ON "Workflow"("key");

-- CreateIndex
CREATE INDEX "Workflow_status_updatedAt_idx" ON "Workflow"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowId_status_startedAt_idx" ON "WorkflowExecution"("workflowId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowExecution_caseId_startedAt_idx" ON "WorkflowExecution"("caseId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowExecutionStep_stepId_startedAt_idx" ON "WorkflowExecutionStep"("stepId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowId_stepType_idx" ON "WorkflowStep"("workflowId", "stepType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowId_stepOrder_key" ON "WorkflowStep"("workflowId", "stepOrder");

-- AddForeignKey
ALTER TABLE "WorkflowExecutionStep" ADD CONSTRAINT "WorkflowExecutionStep_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "WorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
