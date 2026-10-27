import type { Prisma } from '@prisma/client';

/**
 * 지원 목록 키워드 검색의 where 조각을 만든다. (M4 메모·검색)
 * - 회사명·직무·메모를 대소문자 무시 부분일치로 OR 검색한다.
 * - 공백/빈 문자열이면 필터 없음({})을 반환한다 (전체 매칭·불필요한 조건 방지).
 */
export function applicationSearchWhere(
  q?: string,
): Prisma.ApplicationWhereInput {
  const term = q?.trim();
  if (!term) return {};
  const mode: Prisma.QueryMode = 'insensitive';
  return {
    OR: [
      { companyName: { contains: term, mode } },
      { position: { contains: term, mode } },
      { memo: { contains: term, mode } },
    ],
  };
}
