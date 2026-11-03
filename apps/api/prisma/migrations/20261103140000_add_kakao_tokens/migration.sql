-- 카카오 '나에게 보내기' 리마인더용 토큰 + 알림 옵트인
ALTER TABLE "User" ADD COLUMN "kakaoAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "kakaoRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "kakaoTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "notifyKakao" BOOLEAN NOT NULL DEFAULT true;
