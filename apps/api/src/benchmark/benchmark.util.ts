// 익명 벤치마크 집계 — 순수 함수. computeInsights(전 사용자) 위에 프라이버시 임계값을 씌운다.
import type { Benchmark, DashboardInsights } from '@joblog/types';

// 표본이 이보다 적은 전형/합격률은 노출하지 않는다(식별 방지 + 노이즈 제거).
const MIN_SAMPLE = 5;

/**
 * 전 사용자 insights + 사용자 수 → 공개 벤치마크.
 * - 합격률: 결론 난 지원이 MIN_SAMPLE 이상일 때만.
 * - 전형별: 결정된 표본(passed+failed)이 MIN_SAMPLE 이상인 것만, 표본 수 내림차순.
 */
export function computeBenchmark(
  insights: DashboardInsights,
  users: number,
  nowIso: string,
): Benchmark {
  const stages = insights.stages
    .map((s) => ({ name: s.name, decided: s.passed + s.failed, passRate: s.passRate }))
    .filter(
      (s): s is { name: string; decided: number; passRate: number } =>
        s.decided >= MIN_SAMPLE && s.passRate !== null,
    )
    .sort((a, b) => b.decided - a.decided || a.name.localeCompare(b.name));

  return {
    users,
    applications: insights.total,
    decided: insights.decided,
    offerRate: insights.decided >= MIN_SAMPLE ? insights.offerRate : null,
    stages,
    updatedAt: nowIso,
  };
}
