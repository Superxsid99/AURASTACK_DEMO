-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'reviewer',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRecord" (
    "id" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "workflowStage" TEXT NOT NULL,
    "assignedUserName" TEXT,
    "aiStatus" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentsTotal" INTEGER NOT NULL DEFAULT 0,
    "documentsComplete" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pages" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeJob" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "flowConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "intakeJobId" TEXT,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeJob" ADD CONSTRAINT "IntakeJob_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_intakeJobId_fkey" FOREIGN KEY ("intakeJobId") REFERENCES "IntakeJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CaseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
