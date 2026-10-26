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
