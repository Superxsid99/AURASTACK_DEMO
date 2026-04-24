-- CreateTable
CREATE TABLE "InboxEmail" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'imap',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "pollInterval" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPolled" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxEmail_email_key" ON "InboxEmail"("email");
