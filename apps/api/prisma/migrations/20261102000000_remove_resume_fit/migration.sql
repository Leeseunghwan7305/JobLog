-- 이력서(resume) + 핏 분석(fit) 기능 제거에 따른 컬럼 삭제.
-- 해당 컬럼은 사용되지 않았고(값 전무) rawPosting은 유지한다. IF EXISTS로 멱등하게.
ALTER TABLE "User" DROP COLUMN IF EXISTS "resumeText";
ALTER TABLE "User" DROP COLUMN IF EXISTS "resumeFilename";
ALTER TABLE "User" DROP COLUMN IF EXISTS "resumeUpdatedAt";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "fitResult";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "fitAt";
