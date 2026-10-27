-- 이력서↔공고 핏 분석 결과 캐시
ALTER TABLE "Application" ADD COLUMN "fitResult" JSONB;
ALTER TABLE "Application" ADD COLUMN "fitAt" TIMESTAMP(3);
