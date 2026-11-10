import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DashboardInsights } from '@joblog/types';

import { computeBenchmark } from './benchmark.util';

const base: DashboardInsights = {
  total: 20,
  offer: 4,
  rejected: 6,
  inProgress: 10,
  closed: 0,
  decided: 10,
  offerRate: 0.4,
  stages: [
    { name: '서류', total: 20, passed: 8, failed: 4, undecided: 8, passRate: 8 / 12 }, // decided 12 ≥5
    { name: '1차 면접', total: 6, passed: 3, failed: 2, undecided: 1, passRate: 3 / 5 }, // decided 5 ≥5
    { name: '커피챗', total: 3, passed: 2, failed: 1, undecided: 0, passRate: 2 / 3 }, // decided 3 <5 → 숨김
  ],
};

test('표본 충분한 전형만 노출, 표본 수 내림차순', () => {
  const b = computeBenchmark(base, 15, '2026-11-11T00:00:00.000Z');
  assert.deepEqual(
    b.stages.map((s) => s.name),
    ['서류', '1차 면접'], // 커피챗(3)은 MIN_SAMPLE 미만이라 제외
  );
  assert.equal(b.stages[0].decided, 12);
  assert.equal(Math.round(b.stages[0].passRate * 100), 67);
});

test('합격률: 결론 표본 충분하면 노출', () => {
  const b = computeBenchmark(base, 15, 'x');
  assert.equal(b.offerRate, 0.4);
  assert.equal(b.users, 15);
  assert.equal(b.applications, 20);
});

test('합격률: 결론 표본 부족하면 null', () => {
  const few = { ...base, decided: 3, offer: 1, rejected: 2 };
  const b = computeBenchmark(few, 5, 'x');
  assert.equal(b.offerRate, null);
});

test('전형 표본이 전부 부족하면 빈 배열(초기 상태)', () => {
  const tiny: DashboardInsights = {
    total: 2, offer: 0, rejected: 1, inProgress: 1, closed: 0, decided: 1, offerRate: 0,
    stages: [{ name: '서류', total: 2, passed: 0, failed: 1, undecided: 1, passRate: 0 }],
  };
  const b = computeBenchmark(tiny, 2, 'x');
  assert.deepEqual(b.stages, []);
  assert.equal(b.offerRate, null);
});
