-- AlterTable
ALTER TABLE "AgentDefinition" ADD COLUMN     "department" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "integrations" JSONB,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "policyRules" JSONB,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "tools" JSONB;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "inputJson" JSONB,
ADD COLUMN     "outputJson" JSONB,
ADD COLUMN     "stepKind" TEXT;

-- CreateIndex
CREATE INDEX "AgentRun_agentId_createdAt_idx" ON "AgentRun"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_caseId_createdAt_idx" ON "AgentRun"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
