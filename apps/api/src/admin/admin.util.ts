/**
 * 어드민 판정 — role 컬럼 대신 환경변수 허용목록(ADMIN_KAKAO_IDS) 기반.
 * 마이그레이션 없이, 기본값(미설정)은 "아무도 어드민 아님"으로 안전하게 시작한다.
 */

/** "123, 456 , " → ["123","456"] (공백·빈 항목 제거) */
export function parseAdminIds(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** kakaoId가 허용목록에 있으면 어드민. kakaoId 없거나 목록 비면 false. */
export function isAdminKakaoId(
  kakaoId: string | null | undefined,
  raw: string | undefined | null,
): boolean {
  if (!kakaoId) return false;
  return parseAdminIds(raw).includes(kakaoId);
}

/**
 * 이메일 부분 마스킹. 로컬파트 앞 2자(짧으면 1자)만 남기고 가린다.
 * "seunghwan@gmail.com" → "se***@gmail.com". @ 없으면 통째로 "***".
 */
export function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

/**
 * 집주소를 지역 수준(공백 기준 앞 2토큰)까지만 노출.
 * "서울 강남구 테헤란로 152" → "서울 강남구". 2토큰 이하면 그대로.
 */
export function maskRegion(address: string | null): string | null {
  if (!address) return address;
  const tokens = address.split(/\s+/).filter((t) => t.length > 0);
  return tokens.slice(0, 2).join(' ');
}

/**
 * page/pageSize 쿼리를 정규화. page≥1, pageSize 1..max(기본 def).
 * skip/take까지 함께 계산해 Prisma에 바로 넘긴다.
 */
export function parsePaging(
  page: string | number | undefined | null,
  pageSize: string | number | undefined | null,
  def = 50,
  max = 200,
): { page: number; pageSize: number; skip: number; take: number } {
  const p = Math.max(1, toInt(page, 1));
  const s = Math.min(max, Math.max(1, toInt(pageSize, def)));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}

function toInt(v: string | number | undefined | null, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
