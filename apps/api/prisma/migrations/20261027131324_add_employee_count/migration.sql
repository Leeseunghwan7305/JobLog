-- 회사규모 스냅샷(국민연금 가입자수≈직원수). nullable 추가 컬럼.
ALTER TABLE "Application" ADD COLUMN "employeeCount" INTEGER;
