-- Gmail 자동 상태감지용 Google OAuth 토큰
ALTER TABLE "User" ADD COLUMN "googleEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "googleAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleTokenExpiresAt" TIMESTAMP(3);
