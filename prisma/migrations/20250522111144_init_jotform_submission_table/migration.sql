-- CreateTable
CREATE TABLE "JotFormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "formTitle" TEXT,
    "submissionDate" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "formDataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JotFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JotFormSubmission_submissionId_key" ON "JotFormSubmission"("submissionId");

-- CreateIndex
CREATE INDEX "JotFormSubmission_formId_idx" ON "JotFormSubmission"("formId");
