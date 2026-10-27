import * as Sentry from '@sentry/nextjs';

// 서버(Node 런타임) Sentry 초기화. DSN이 없으면 enabled:false로 조용히 꺼진다.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
