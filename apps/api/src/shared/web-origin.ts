/**
 * WEB_ORIGIN 파싱 — 콤마로 여러 웹 출처를 허용한다(커스텀 도메인 + vercel.app 병행).
 * CORS 허용목록과 로그인/콜백 리다이렉트 대상이 같은 소스를 쓰도록 공용화한다.
 * 호출 시점에 읽어 모듈 로드 순서에 의존하지 않는다.
 */
export function webOrigins(): string[] {
  const raw = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 로그인·OAuth 콜백 후 돌려보낼 기본(정규) 웹 주소 = 목록의 첫 번째. */
export function primaryWebOrigin(): string {
  return webOrigins()[0] ?? 'http://localhost:3000';
}
