// 알림 대상 날짜 계산 (KST 기준). 순수 함수 → 단위 테스트 대상.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 임의 시각 → KST 달력 날짜 키 'YYYY-MM-DD' (멱등성 sendDate용) */
export function kstDayKey(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${kst.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * now로부터 daysAhead일 뒤의 "KST 달력 하루"를 UTC 범위 [gte, lt)로 반환.
 * deadline/scheduledAt이 이 범위에 들면 D-(daysAhead) 알림 대상.
 */
export function dueWindowUtc(
  now: Date,
  daysAhead: number,
): { gte: Date; lt: Date; dayKey: string } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  // 대상 날짜의 KST 자정을, 마치 UTC인 것처럼 계산한 ms
  const kstMidnightAsUtc = Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() + daysAhead,
  );
  // 실제 UTC 시각으로 환산 (KST 자정 = UTC 전날 15:00)
  const gte = new Date(kstMidnightAsUtc - KST_OFFSET_MS);
  const lt = new Date(gte.getTime() + DAY_MS);
  return { gte, lt, dayKey: kstDayKey(gte) };
}

/** KST 기준 그 주 월요일 자정의 UTC ms (주간 계산 공통 기준). */
function kstMondayMidnightAsUtc(now: Date): number {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0 … 일=6
  return Date.UTC(
    kst.getUTCFullYear(),
    kst.getUTCMonth(),
    kst.getUTCDate() - dow,
  );
}

/** KST 주차 키 'W YYYY-MM-DD'(그 주 월요일). 주간 요약·nudge 멱등 sendDate용. */
export function kstWeekKey(now: Date): string {
  return `W${kstDayKey(new Date(kstMondayMidnightAsUtc(now) - KST_OFFSET_MS))}`;
}

/** 이번 KST 주(월 00:00 ~ 다음 월 00:00)를 UTC 범위 [gte, lt)로. 주간 요약 집계용. */
export function kstWeekWindowUtc(now: Date): { gte: Date; lt: Date } {
  const gte = new Date(kstMondayMidnightAsUtc(now) - KST_OFFSET_MS);
  const lt = new Date(gte.getTime() + 7 * DAY_MS);
  return { gte, lt };
}

/** 마지막 활동 이후 days일 이상 지났으면 true (무변동 nudge 판정). */
export function isStale(lastActivity: Date, now: Date, days: number): boolean {
  return now.getTime() - lastActivity.getTime() >= days * DAY_MS;
}
