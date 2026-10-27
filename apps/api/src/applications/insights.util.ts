import type { DashboardInsights, StageInsight } from '@joblog/types';
import type { AppStatus, StageStatus } from '@prisma/client';

export interface AppForInsights {
  status: AppStatus;
  stages: { name: string; status: StageStatus }[];
}

/**
 * 합격률·전형별 통과율 인사이트를 계산한다. (M4 인사이트, 순수 함수)
 * - 합격률: offer / (offer + rejected). 진행중·철회(CLOSED)는 분모에서 제외.
 * - 전형별: 단계 이름(trim)으로 묶어 passed / (passed + failed) 통과율.
 *   결정된 단계가 없으면 passRate는 null (0으로 나누지 않음).
 */
export function computeInsights(apps: AppForInsights[]): DashboardInsights {
  let offer = 0;
  let rejected = 0;
  let inProgress = 0;
  let closed = 0;

  const byName = new Map<string, StageInsight>();

  for (const app of apps) {
    if (app.status === 'OFFER') offer += 1;
    else if (app.status === 'REJECTED') rejected += 1;
    else if (app.status === 'IN_PROGRESS') inProgress += 1;
    else if (app.status === 'CLOSED') closed += 1;

    for (const stage of app.stages) {
      const name = stage.name.trim();
      if (!name) continue; // 빈 이름은 집계하지 않는다
      const agg =
        byName.get(name) ??
        ({ name, total: 0, passed: 0, failed: 0, undecided: 0, passRate: null });
      agg.total += 1;
      if (stage.status === 'PASSED') agg.passed += 1;
      else if (stage.status === 'FAILED') agg.failed += 1;
      else agg.undecided += 1; // PENDING + IN_PROGRESS
      byName.set(name, agg);
    }
  }

  const stages = [...byName.values()]
    .map((s) => {
      const decided = s.passed + s.failed;
      return { ...s, passRate: decided === 0 ? null : s.passed / decided };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const decided = offer + rejected;
  return {
    total: apps.length,
    offer,
    rejected,
    inProgress,
    closed,
    decided,
    offerRate: decided === 0 ? null : offer / decided,
    stages,
  };
}
