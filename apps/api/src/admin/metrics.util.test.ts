import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeDauMau, kstDayOf, recentDays } from './metrics.util';

test('kstDayOf: UTC 15:00은 KST로 다음날', () => {
  // 2026-11-02T15:00Z → KST 2026-11-03 00:00
  assert.equal(kstDayOf(new Date('2026-11-02T15:00:00.000Z')), '2026-11-03');
});

test('kstDayOf: UTC 00:00은 같은 날 KST 09:00', () => {
  assert.equal(kstDayOf(new Date('2026-11-03T00:00:00.000Z')), '2026-11-03');
});

test('recentDays: today를 마지막으로 n일 오름차순', () => {
  assert.deepEqual(recentDays('2026-11-03', 3), [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
  ]);
});

test('recentDays: 월 경계를 넘어가도 정확', () => {
  assert.deepEqual(recentDays('2026-03-02', 4), [
    '2026-02-27',
    '2026-02-28',
    '2026-03-01',
    '2026-03-02',
  ]);
});

test('computeDauMau: 일별 고유 사용자 + DAU(오늘) + MAU(창 전체)', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
  const tuples = [
    { userId: 'a', day: '2026-11-01' },
    { userId: 'b', day: '2026-11-01' },
    { userId: 'a', day: '2026-11-03' },
    { userId: 'a', day: '2026-11-03' }, // 중복 → 1명
    { userId: 'c', day: '2026-11-03' },
  ];
  const r = computeDauMau(tuples, days);
  assert.deepEqual(
    r.daily.map((d) => d.count),
    [2, 0, 2],
  );
  assert.equal(r.dau, 2); // 2026-11-03: a, c
  assert.equal(r.mau, 3); // a, b, c
});

test('computeDauMau: 범위 밖 날짜는 무시', () => {
  const days = ['2026-11-02', '2026-11-03'];
  const r = computeDauMau(
    [
      { userId: 'a', day: '2026-10-01' }, // 창 밖
      { userId: 'b', day: '2026-11-03' },
    ],
    days,
  );
  assert.equal(r.mau, 1);
  assert.equal(r.dau, 1);
});

test('computeDauMau: 빈 입력 → 전부 0', () => {
  const r = computeDauMau([], ['2026-11-03']);
  assert.equal(r.dau, 0);
  assert.equal(r.mau, 0);
  assert.deepEqual(r.daily, [{ day: '2026-11-03', count: 0 }]);
});
