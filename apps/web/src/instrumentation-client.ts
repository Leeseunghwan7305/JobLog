import * as Sentry from '@sentry/nextjs';

// 브라우저(클라이언트) Sentry 초기화. DSN이 없으면 enabled:false로 조용히 꺼진다.
// 세션 리플레이·피드백은 번들·비용을 늘려 지금은 제외(에러 + 트레이싱만).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});

// App Router 라우트 전환 추적
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
