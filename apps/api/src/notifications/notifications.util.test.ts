import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dueWindowUtc,
  isStale,
  kstDayKey,
  kstWeekKey,
  kstWeekWindowUtc,
} from './notifications.util';

test('D-3 윈도우: now 기준 3일 뒤 KST 하루를 UTC 범위로', () => {
  // 2026-10-26 09:00 KST
  const now = new Date('2026-10-26T00:00:00.000Z');
  const { gte, lt, dayKey } = dueWindowUtc(now, 3);
  assert.equal(dayKey, '2026-10-29'); // 3일 뒤
  assert.equal(gte.toISOString(), '2026-10-28T15:00:00.000Z'); // 10-29 00:00 KST
  assert.equal(lt.toISOString(), '2026-10-29T15:00:00.000Z'); // 10-30 00:00 KST
});

test('D-3 윈도우: KST 날짜 경계(자정 직후)에도 올바른 날', () => {
  // 2026-10-27 00:30 KST (= 전날 15:30 UTC)
  const now = new Date('2026-10-26T15:30:00.000Z');
  const { dayKey } = dueWindowUtc(now, 3);
  assert.equal(dayKey, '2026-10-30');
});

test('daysAhead 가변: D-1도 동작', () => {
  const now = new Date('2026-10-26T00:00:00.000Z');
  assert.equal(dueWindowUtc(now, 1).dayKey, '2026-10-27');
});

test('kstDayKey: UTC→KST 날짜 경계', () => {
  // 15:00Z = 다음날 00:00 KST
  assert.equal(kstDayKey(new Date('2026-10-28T15:00:00.000Z')), '2026-10-29');
  // 14:59Z = 같은날 23:59 KST
  assert.equal(kstDayKey(new Date('2026-10-28T14:59:00.000Z')), '2026-10-28');
});

test('주차 키: 같은 KST 주는 그 주 월요일 날짜로 동일', () => {
  const wed = new Date('2026-11-04T05:00:00.000Z'); // 수 14:00 KST
  const monEarly = new Date('2026-11-02T00:30:00.000Z'); // 월 09:30 KST
  const sunLate = new Date('2026-11-08T14:00:00.000Z'); // 일 23:00 KST
  assert.equal(kstWeekKey(wed), 'W2026-11-02');
  assert.equal(kstWeekKey(monEarly), 'W2026-11-02');
  assert.equal(kstWeekKey(sunLate), 'W2026-11-02');
});

test('주차 키: KST 월요일 자정을 넘으면 다음 주', () => {
  const nextMon = new Date('2026-11-08T15:30:00.000Z'); // 11-09 00:30 KST(월)
  assert.equal(kstWeekKey(nextMon), 'W2026-11-09');
});

test('주간 윈도우: 월 00:00 ~ 다음 월 00:00 (KST)을 UTC 범위로', () => {
  const wed = new Date('2026-11-04T05:00:00.000Z');
  const { gte, lt } = kstWeekWindowUtc(wed);
  assert.equal(gte.toISOString(), '2026-11-01T15:00:00.000Z'); // 11-02 00:00 KST
  assert.equal(lt.toISOString(), '2026-11-08T15:00:00.000Z'); // 11-09 00:00 KST
});

test('isStale: 14일 경계(정확히 14일은 stale)', () => {
  const now = new Date('2026-11-15T00:00:00.000Z');
  assert.equal(isStale(new Date('2026-11-01T00:00:00.000Z'), now, 14), true);
  assert.equal(isStale(new Date('2026-11-05T00:00:00.000Z'), now, 14), false);
});
