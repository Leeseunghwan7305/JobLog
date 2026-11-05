-- 파싱 품질 계측 (사이트별 성공률)
CREATE TABLE "ParseLog" (
  "id" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "confidence" TEXT,
  "needsManualInput" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParseLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParseLog_createdAt_idx" ON "ParseLog"("createdAt");
CREATE INDEX "ParseLog_host_idx" ON "ParseLog"("host");
