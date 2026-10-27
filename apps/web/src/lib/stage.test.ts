import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type ApplicationDto,
  type AppStatus,
  type StageStatus,
} from '@joblog/types';

import { currentStageLabel, STAGE_STATUS_LABEL } from './stage';

function makeApp(
  status: AppStatus,
  stages: { name: string; status: StageStatus }[],
): ApplicationDto {
  return {
    id: 'a1',
    companyName: '네이버',
    position: 'FE',
    jobUrl: null,
    location: null,
    employmentType: null,
    deadline: null,
    appliedAt: null,
    employeeCount: null,
    fitResult: null,
    fitAt: null,
    memo: null,
    tags: [],
    archivedAt: null,
    status,
    stages: stages.map((s, i) => ({
      id: `s${i}`,
      name: s.name,
      order: i,
      status: s.status,
      scheduledAt: null,
      completedAt: null,
    })),
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  };
}

test('OFFER 상태는 최종합격', () => {
  assert.equal(currentStageLabel(makeApp('OFFER', [])), '최종합격');
});

test('CLOSED 상태는 지원철회', () => {
  assert.equal(currentStageLabel(makeApp('CLOSED', [])), '지원철회');
});

test('FAILED 단계가 있으면 "<이름> 탈락"', () => {
  const app = makeApp('IN_PROGRESS', [
    { name: '서류', status: 'PASSED' },
    { name: '코딩테스트', status: 'FAILED' },
  ]);
  assert.equal(currentStageLabel(app), '코딩테스트 탈락');
});

test('진행중 단계가 있으면 "<이름> 진행중"', () => {
  const app = makeApp('IN_PROGRESS', [
    { name: '서류', status: 'PASSED' },
    { name: '1차 면접', status: 'IN_PROGRESS' },
  ]);
  assert.equal(currentStageLabel(app), '1차 면접 진행중');
});

test('대기 단계만 있으면 "<이름> 대기"', () => {
  const app = makeApp('IN_PROGRESS', [{ name: '서류', status: 'PENDING' }]);
  assert.equal(currentStageLabel(app), '서류 대기');
});

test('탈락이 진행중/대기보다 우선한다', () => {
  const app = makeApp('IN_PROGRESS', [
    { name: '서류', status: 'FAILED' },
    { name: '면접', status: 'IN_PROGRESS' },
  ]);
  assert.equal(currentStageLabel(app), '서류 탈락');
});

test('STAGE_STATUS_LABEL 매핑', () => {
  assert.equal(STAGE_STATUS_LABEL.PASSED, '합격');
  assert.equal(STAGE_STATUS_LABEL.FAILED, '탈락');
});
