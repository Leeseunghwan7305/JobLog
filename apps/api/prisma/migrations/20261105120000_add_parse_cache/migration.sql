-- 파싱 결과 캐시 (URL/본문 해시 키, TTL은 앱에서 적용)
CREATE TABLE "ParseCache" (
  "key" TEXT NOT NULL,
  "resultJson" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParseCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "ParseCache_createdAt_idx" ON "ParseCache"("createdAt");
