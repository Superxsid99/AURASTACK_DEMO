ALTER TABLE "InboxEmail"
ADD COLUMN "domain" TEXT,
ADD COLUMN "workflowKey" TEXT,
ADD COLUMN "claimTypeKey" TEXT,
ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;
