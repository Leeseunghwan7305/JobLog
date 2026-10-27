import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppStatus, type StageStatus } from '@prisma/client';

import { deriveStatus } from './status.util';

interface Stage {
  order: number;
  status: StageStatus;
}

// spec 2.3 — 전체 상태는 단계 상태의 투영(projection)이다.
// deriveStatus는 규칙 2·3·4만 담당한다. 규칙 1(CLOSED, 사용자 철회)은
// 단계 바깥의 결정이라 서비스(recompute)가 오버라이드로 유지한다.

test('규칙4: 빈 단계는 IN_PROGRESS (마지막 단계 없음)', () => {
  assert.equal(deriveStatus([]), AppStatus.IN_PROGRESS);
});

test('규칙4: 모두 PENDING이면 IN_PROGRESS', () => {
  const stages: Stage[] = [
    { order: 0, status: 'PENDING' },
    { order: 1, status: 'PENDING' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.IN_PROGRESS);
});

test('규칙3: order가 가장 큰 단계가 PASSED면 OFFER', () => {
  const stages: Stage[] = [
    { order: 0, status: 'PASSED' },
    { order: 1, status: 'PASSED' },
    { order: 2, status: 'PASSED' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.OFFER);
});

test('규칙3: 마지막 단계만 PASSED여도 OFFER (앞 단계가 PENDING/IN_PROGRESS여도)', () => {
  const stages: Stage[] = [
    { order: 0, status: 'IN_PROGRESS' },
    { order: 1, status: 'PASSED' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.OFFER);
});

test('규칙3: 마지막 단계가 PASSED가 아니면 OFFER가 아니다 (앞이 PASSED여도 IN_PROGRESS)', () => {
  const stages: Stage[] = [
    { order: 0, status: 'PASSED' },
    { order: 1, status: 'IN_PROGRESS' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.IN_PROGRESS);
});

test('규칙2: 하나라도 FAILED면 REJECTED', () => {
  const stages: Stage[] = [
    { order: 0, status: 'PASSED' },
    { order: 1, status: 'FAILED' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.REJECTED);
});

test('규칙2 우선순위: 마지막 단계가 PASSED여도 앞에 FAILED가 있으면 REJECTED', () => {
  const stages: Stage[] = [
    { order: 0, status: 'FAILED' },
    { order: 1, status: 'PASSED' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.REJECTED);
});

test('order 기준으로 "마지막"을 정한다 (입력 배열 순서와 무관)', () => {
  // 배열 순서는 뒤섞였지만 order=2(PASSED)가 마지막 → OFFER
  const stages: Stage[] = [
    { order: 2, status: 'PASSED' },
    { order: 0, status: 'IN_PROGRESS' },
    { order: 1, status: 'IN_PROGRESS' },
  ];
  assert.equal(deriveStatus(stages), AppStatus.OFFER);
});

test('단일 단계 PASSED → OFFER', () => {
  assert.equal(deriveStatus([{ order: 0, status: 'PASSED' }]), AppStatus.OFFER);
});

test('단일 단계 PENDING → IN_PROGRESS', () => {
  assert.equal(
    deriveStatus([{ order: 0, status: 'PENDING' }]),
    AppStatus.IN_PROGRESS,
  );
});

test('계약: deriveStatus는 CLOSED를 절대 반환하지 않는다 (철회는 서비스가 유지)', () => {
  const samples: Stage[][] = [
    [],
    [{ order: 0, status: 'PENDING' }],
    [{ order: 0, status: 'PASSED' }],
    [{ order: 0, status: 'FAILED' }],
    [
      { order: 0, status: 'IN_PROGRESS' },
      { order: 1, status: 'PASSED' },
    ],
  ];
  for (const stages of samples) {
    assert.notEqual(deriveStatus(stages), AppStatus.CLOSED);
  }
});
