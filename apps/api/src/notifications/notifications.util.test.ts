import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueWindowUtc, kstDayKey } from './notifications.util';

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
