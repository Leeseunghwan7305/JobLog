import * as Sentry from '@sentry/nextjs';

// Edge 런타임(미들웨어 등) Sentry 초기화. DSN이 없으면 조용히 꺼진다.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
