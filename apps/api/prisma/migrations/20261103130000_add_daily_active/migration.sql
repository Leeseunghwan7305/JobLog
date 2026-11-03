-- DAU/MAU 집계용 일별 활동 기록 테이블.
CREATE TABLE "DailyActive" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    CONSTRAINT "DailyActive_pkey" PRIMARY KEY ("userId","day")
);

CREATE INDEX "DailyActive_day_idx" ON "DailyActive"("day");

ALTER TABLE "DailyActive" ADD CONSTRAINT "DailyActive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
