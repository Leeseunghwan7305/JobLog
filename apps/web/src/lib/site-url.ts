/**
 * 공개 사이트의 절대 URL (OG·canonical·sitemap·robots 절대경로용).
 * 우선순위:
 *   1) NEXT_PUBLIC_SITE_URL  — 커스텀 도메인 등 명시 지정
 *   2) VERCEL_PROJECT_PRODUCTION_URL — Vercel 프로덕션 도메인(자동 주입, https 없이 host만)
 *   3) http://localhost:3000 — 로컬 폴백
 *
 * 서버에서만 호출한다(layout metadata / route handler). VERCEL_* 는 NEXT_PUBLIC 이
 * 아니라 서버 전용이라, 클라이언트 컴포넌트에서 import 하면 undefined 로 평가된다.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}
