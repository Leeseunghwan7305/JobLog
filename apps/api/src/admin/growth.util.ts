// 성장 지표 순수 집계 — 네트워크/DB 없음, 단위 테스트 대상.
import type { SiteParseStat } from '@joblog/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00.000Z`);
const msToDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 활성화율 = 지원 1건 이상 등록한 사용자 / 전체 사용자. 사용자 0명이면 null. */
export function activationRate(
  usersTotal: number,
  usersActivated: number,
): number | null {
  return usersTotal === 0 ? null : usersActivated / usersTotal;
}

/** 공고당 평균 상태 변경 수 = 전체 StatusLog / 전체 지원. 지원 0건이면 null. */
export function avgUpdatesPerApp(
  totalLogs: number,
  totalApps: number,
): number | null {
  return totalApps === 0 ? null : totalLogs / totalApps;
}

/**
 * 가입 offset일 뒤 재방문율(D1/D7). 분모는 "그 날이 이미 지난" 가입자만.
 * signupDay+offset이 미래면 아직 판정 불가라 분모에서 제외한다. 분모 0이면 null.
 */
export function retentionRate(
  signups: { userId: string; signupDay: string }[],
  activeDays: { userId: string; day: string }[],
  today: string,
  offset: number,
): number | null {
  const todayMs = dayMs(today);
  const active = new Set(activeDays.map((a) => `${a.userId}|${a.day}`));
  let eligible = 0;
  let retained = 0;
  for (const s of signups) {
    const targetMs = dayMs(s.signupDay) + offset * DAY_MS;
    if (targetMs > todayMs) continue; // 아직 그 날이 오지 않음
    eligible++;
    if (active.has(`${s.userId}|${msToDay(targetMs)}`)) retained++;
  }
  return eligible === 0 ? null : retained / eligible;
}

/** 사이트별 파싱 성공률. total 내림차순, 동률이면 host 오름차순. */
export function parseSuccessBySite(
  logs: { host: string; ok: boolean }[],
): SiteParseStat[] {
  const byHost = new Map<string, { total: number; ok: number }>();
  for (const l of logs) {
    const e = byHost.get(l.host) ?? { total: 0, ok: 0 };
    e.total += 1;
    if (l.ok) e.ok += 1;
    byHost.set(l.host, e);
  }
  return [...byHost.entries()]
    .map(([host, { total, ok }]) => ({
      host,
      total,
      ok,
      successRate: total === 0 ? 0 : ok / total,
    }))
    .sort((a, b) => b.total - a.total || a.host.localeCompare(b.host));
}
