-- AlterTable
ALTER TABLE "JotFormSubmission" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "JotFormSubmission_deletedAt_idx" ON "JotFormSubmission"("deletedAt");
