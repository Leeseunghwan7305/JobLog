import * as Sentry from '@sentry/nextjs';

// Next.js가 서버 부팅 시 호출. 런타임에 맞는 Sentry 설정을 로드한다.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// 서버 컴포넌트·미들웨어·라우트 핸들러의 에러를 Sentry로 포착
export const onRequestError = Sentry.captureRequestError;
