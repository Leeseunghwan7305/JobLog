import type { Prisma } from '@prisma/client';

/**
 * 보관(아카이브) 필터 where 조각. (M4 공고 아카이브)
 * - archived=false → 활성만(archivedAt null)
 * - archived=true  → 보관된 것만(archivedAt 값 존재)
 */
export function archiveWhere(archived: boolean): Prisma.ApplicationWhereInput {
  return archived ? { archivedAt: { not: null } } : { archivedAt: null };
}

/**
 * update DTO의 archived 플래그를 archivedAt 컬럼 값으로 변환한다.
 * - true → 보관 시각(now)
 * - false → null (보관 해제)
 * - undefined → undefined (변경 없음)
 * now를 주입받아 순수 함수로 유지한다.
 */
export function resolveArchivedAt(
  archived: boolean | undefined,
  now: Date,
): Date | null | undefined {
  if (archived === undefined) return undefined;
  return archived ? now : null;
}
