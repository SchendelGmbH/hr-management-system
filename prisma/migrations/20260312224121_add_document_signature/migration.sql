-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'SIGNED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SignatureRequestRole" AS ENUM ('REQUESTER', 'APPROVER', 'SIGNER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SIGNATURE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SIGNATURE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SIGNATURE_SIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'SIGNATURE_REJECTED';

-- CreateTable
CREATE TABLE "document_signature_requests" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "createdById" TEXT NOT NULL,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "document_signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signature_participants" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SignatureRequestRole" NOT NULL,
    "actedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "document_signature_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signatures" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "signerId" TEXT NOT NULL,
    "signatureData" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "pageNumber" INTEGER NOT NULL DEFAULT 1,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,

    CONSTRAINT "document_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_signature_requests_documentId_idx" ON "document_signature_requests"("documentId");

-- CreateIndex
CREATE INDEX "document_signature_requests_status_idx" ON "document_signature_requests"("status");

-- CreateIndex
CREATE INDEX "document_signature_requests_createdById_idx" ON "document_signature_requests"("createdById");

-- CreateIndex
CREATE INDEX "document_signature_requests_roomId_idx" ON "document_signature_requests"("roomId");

-- CreateIndex
CREATE INDEX "document_signature_participants_requestId_idx" ON "document_signature_participants"("requestId");

-- CreateIndex
CREATE INDEX "document_signature_participants_userId_idx" ON "document_signature_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "document_signature_participants_requestId_userId_role_key" ON "document_signature_participants"("requestId", "userId", "role");

-- CreateIndex
CREATE INDEX "document_signatures_requestId_idx" ON "document_signatures"("requestId");

-- CreateIndex
CREATE INDEX "document_signatures_signerId_idx" ON "document_signatures"("signerId");

-- AddForeignKey
ALTER TABLE "document_signature_requests" ADD CONSTRAINT "document_signature_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signature_requests" ADD CONSTRAINT "document_signature_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signature_requests" ADD CONSTRAINT "document_signature_requests_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chat_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signature_participants" ADD CONSTRAINT "document_signature_participants_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "document_signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signature_participants" ADD CONSTRAINT "document_signature_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "document_signature_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
