import { AppStatus, StageStatus } from '@prisma/client';

/**
 * 전체 지원 상태를 단계 상태로부터 파생 계산한다. (spec 2.3)
 * - 하나라도 FAILED → REJECTED
 * - 마지막(order 최대) 단계가 PASSED → OFFER
 * - 그 외 → IN_PROGRESS
 * CLOSED(사용자 철회)는 여기서 다루지 않고 서비스에서 유지한다.
 */
export function deriveStatus(
  stages: { order: number; status: StageStatus }[],
): AppStatus {
  if (stages.some((s) => s.status === 'FAILED')) return AppStatus.REJECTED;
  if (stages.length > 0) {
    const last = [...stages].sort((a, b) => a.order - b.order).at(-1)!;
    if (last.status === 'PASSED') return AppStatus.OFFER;
  }
  return AppStatus.IN_PROGRESS;
}
