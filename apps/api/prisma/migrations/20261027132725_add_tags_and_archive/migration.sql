-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Application_userId_archivedAt_idx" ON "Application"("userId", "archivedAt");
