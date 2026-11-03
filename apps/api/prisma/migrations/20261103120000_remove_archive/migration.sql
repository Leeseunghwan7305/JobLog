-- 보관함(archive) 기능 제거에 따른 컬럼·인덱스 삭제. IF EXISTS로 멱등하게.
DROP INDEX IF EXISTS "Application_userId_archivedAt_idx";
ALTER TABLE "Application" DROP COLUMN IF EXISTS "archivedAt";
