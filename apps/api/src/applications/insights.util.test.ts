import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type AppForInsights,computeInsights } from './insights.util';

test('빈 입력: 모두 0, offerRate는 null, 전형 목록은 빈 배열', () => {
  const r = computeInsights([]);
  assert.deepEqual(r, {
    total: 0,
    offer: 0,
    rejected: 0,
    inProgress: 0,
    closed: 0,
    decided: 0,
    offerRate: null,
    stages: [],
  });
});

test('합격률: offer / (offer + rejected), 진행중·철회는 분모에서 제외', () => {
  const apps: AppForInsights[] = [
    { status: 'OFFER', stages: [] },
    { status: 'OFFER', stages: [] },
    { status: 'REJECTED', stages: [] },
    { status: 'REJECTED', stages: [] },
    { status: 'IN_PROGRESS', stages: [] }, // 미결정 → 분모 제외
    { status: 'CLOSED', stages: [] }, // 철회 → 분모 제외
  ];
  const r = computeInsights(apps);
  assert.equal(r.total, 6);
  assert.equal(r.offer, 2);
  assert.equal(r.rejected, 2);
  assert.equal(r.inProgress, 1);
  assert.equal(r.closed, 1);
  assert.equal(r.decided, 4);
  assert.equal(r.offerRate, 0.5); // 2 / 4
});

test('합격률: 결론 난 지원이 없으면 offerRate는 null (0으로 나누지 않음)', () => {
  const apps: AppForInsights[] = [
    { status: 'IN_PROGRESS', stages: [] },
    { status: 'CLOSED', stages: [] },
  ];
  assert.equal(computeInsights(apps).offerRate, null);
});

test('전형별 통과율: 단계명으로 묶어 passed/(passed+failed) 계산', () => {
  const apps: AppForInsights[] = [
    {
      status: 'REJECTED',
      stages: [
        { name: '서류', status: 'PASSED' },
        { name: '1차 면접', status: 'FAILED' },
      ],
    },
    {
      status: 'IN_PROGRESS',
      stages: [
        { name: '서류', status: 'PASSED' },
        { name: '1차 면접', status: 'IN_PROGRESS' },
      ],
    },
  ];
  const r = computeInsights(apps);
  const doc = r.stages.find((s) => s.name === '서류');
  const iv = r.stages.find((s) => s.name === '1차 면접');
  assert.deepEqual(doc, {
    name: '서류',
    total: 2,
    passed: 2,
    failed: 0,
    undecided: 0,
    passRate: 1, // 2 / 2
  });
  assert.deepEqual(iv, {
    name: '1차 면접',
    total: 2,
    passed: 0,
    failed: 1,
    undecided: 1, // IN_PROGRESS 1건
    passRate: 0, // 0 / 1
  });
});

test('전형별: 결정된 단계가 없으면 passRate는 null (전부 PENDING/IN_PROGRESS)', () => {
  const apps: AppForInsights[] = [
    {
      status: 'IN_PROGRESS',
      stages: [
        { name: '서류', status: 'PENDING' },
        { name: '서류', status: 'IN_PROGRESS' },
      ],
    },
  ];
  const doc = computeInsights(apps).stages.find((s) => s.name === '서류');
  assert.equal(doc?.passRate, null);
  assert.equal(doc?.undecided, 2);
});

test('전형별 정렬: 등장 횟수 내림차순, 동률이면 이름 오름차순', () => {
  const apps: AppForInsights[] = [
    {
      status: 'IN_PROGRESS',
      stages: [
        { name: '서류', status: 'PASSED' }, // 서류 ×3
        { name: '서류', status: 'PASSED' },
        { name: '서류', status: 'PASSED' },
        { name: '최종', status: 'PENDING' }, // 최종 ×1
        { name: '과제', status: 'PENDING' }, // 과제 ×1
      ],
    },
  ];
  const names = computeInsights(apps).stages.map((s) => s.name);
  // 서류(3) 먼저, 그다음 동률(1)끼리 가나다순: 과제 < 최종
  assert.deepEqual(names, ['서류', '과제', '최종']);
});

test('단계명 정규화: 앞뒤 공백을 trim해 같은 이름으로 묶고, 빈 이름은 무시', () => {
  const apps: AppForInsights[] = [
    {
      status: 'IN_PROGRESS',
      stages: [
        { name: ' 서류 ', status: 'PASSED' },
        { name: '서류', status: 'FAILED' },
        { name: '   ', status: 'PASSED' }, // 빈 이름 → 무시
      ],
    },
  ];
  const r = computeInsights(apps);
  assert.equal(r.stages.length, 1);
  assert.equal(r.stages[0]?.name, '서류');
  assert.equal(r.stages[0]?.total, 2);
  assert.equal(r.stages[0]?.passRate, 0.5); // 1 / 2
});
