-- 이력서(핏 분석 입력). PDF 업로드 시 텍스트만 추출해 저장.
ALTER TABLE "User" ADD COLUMN "resumeText" TEXT;
ALTER TABLE "User" ADD COLUMN "resumeFilename" TEXT;
ALTER TABLE "User" ADD COLUMN "resumeUpdatedAt" TIMESTAMP(3);
