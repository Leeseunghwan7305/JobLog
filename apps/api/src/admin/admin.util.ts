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
