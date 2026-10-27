import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 워크스페이스 타입 패키지를 소스로 가져다 쓰기 위해 트랜스파일
  transpilePackages: ['@joblog/types'],
};

// Sentry는 DSN이 설정된 경우에만 래핑한다.
// 미설정(로컬·초기) 환경에서는 소스맵 업로드/계측 없이 순수 Next 설정으로 빌드된다.
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // 소스맵 업로드는 SENTRY_AUTH_TOKEN(빌드타임 시크릿)이 있을 때만 수행된다.
      silent: !process.env.CI,
    })
  : nextConfig;
