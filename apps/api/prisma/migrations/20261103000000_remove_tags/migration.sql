-- 태그 기능 제거에 따른 컬럼 삭제. IF EXISTS로 멱등하게.
ALTER TABLE "Application" DROP COLUMN IF EXISTS "tags";
