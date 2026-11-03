import type { AdminActivityMetrics } from '@joblog/types';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Date → KST 기준 'YYYY-MM-DD'. (UTC+9로 민 뒤 날짜만) */
export function kstDayOf(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * today(KST 'YYYY-MM-DD')를 마지막으로 하는 최근 n일의 날짜 배열(오름차순).
 * 예: recentDays('2026-11-03', 3) → ['2026-11-01','2026-11-02','2026-11-03']
 */
export function recentDays(today: string, n: number): string[] {
  const end = new Date(`${today}T00:00:00.000Z`).getTime();
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(end - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * 활동 튜플 (userId, day)들을 받아 DAU/MAU 지표를 집계한다.
 * - daily: days 각 날짜의 고유 사용자 수(오름차순)
 * - dau: 마지막 날(today)의 고유 사용자 수
 * - mau: days 전체 창(롤링)의 고유 사용자 수
 * days 범위 밖 튜플은 무시. 같은 (userId, day) 중복은 1명으로.
 */
export function computeDauMau(
  tuples: { userId: string; day: string }[],
  days: string[],
): AdminActivityMetrics {
  const perDay = new Map<string, Set<string>>();
  for (const d of days) perDay.set(d, new Set());
  const windowUsers = new Set<string>();

  for (const t of tuples) {
    const bucket = perDay.get(t.day);
    if (!bucket) continue; // 범위 밖
    bucket.add(t.userId);
    windowUsers.add(t.userId);
  }

  const daily = days.map((day) => ({ day, count: perDay.get(day)?.size ?? 0 }));
  const today = days[days.length - 1];
  return {
    dau: perDay.get(today)?.size ?? 0,
    mau: windowUsers.size,
    daily,
  };
}
