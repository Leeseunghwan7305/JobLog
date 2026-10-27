/**
 * 외부 링크 href 정규화.
 * 사용자가 공고 URL을 스킴 없이 입력하면(예: "www.wanted.co.kr/wd/368286")
 * <a href>가 상대경로로 해석돼 앱 내부 경로(/applications/www...)로 잘못 열린다.
 * 스킴이 없으면 https 를 붙여 항상 외부 절대 URL로 열리게 한다.
 */
export function externalHref(
  raw: string | null | undefined,
): string | undefined {
  const url = raw?.trim();
  if (!url) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url; // http:// https:// 등 스킴 존재
  if (url.startsWith('//')) return `https:${url}`; // 프로토콜-상대
  return `https://${url.replace(/^\/+/, '')}`; // 스킴 없음 → https 보정
}
