import assert from 'node:assert/strict';
import { test } from 'node:test';

import { type ParsedPosting } from '../types';
import { aggregate,scoreParsed } from './score';

const base: ParsedPosting = {
  companyName: '네이버',
  position: '프론트엔드 개발자',
  location: '분당',
  employmentType: '정규직',
  deadline: '2026-11-30',
  stages: [
    { name: '서류', order: 0 },
    { name: '코딩테스트', order: 1 },
    { name: '1차 면접', order: 2 },
    { name: '최종', order: 3 },
  ],
  confidence: 'high',
};

test('완전 일치면 모든 필드 1점, overall 1', () => {
  const s = scoreParsed(base, structuredClone(base));
  assert.equal(s.overall, 1);
  assert.equal(s.failedFields.length, 0);
  assert.equal(s.fields.stages, 1);
  assert.equal(s.fields.stageOrderExact, 1);
});

test('문자열 정규화: 공백/대소문자/전각 차이는 일치로 본다', () => {
  const actual = structuredClone(base);
  actual.companyName = '  네이버 ';
  actual.position = '프론트엔드  개발자';
  const s = scoreParsed(base, actual);
  assert.equal(s.fields.companyName, 1);
  assert.equal(s.fields.position, 1);
});

test('전형 단계 일부 누락 → stages < 1, order도 깨짐', () => {
  const actual = structuredClone(base);
  actual.stages = [
    { name: '서류', order: 0 },
    { name: '최종', order: 1 },
  ];
  const s = scoreParsed(base, actual);
  assert.ok(s.fields.stages < 1, 'Jaccard가 1 미만이어야');
  assert.equal(s.fields.stageOrderExact, 0);
  assert.ok(s.failedFields.includes('stages'));
});

test('단계 이름은 같지만 순서가 다르면 set=1, orderExact=0', () => {
  const actual = structuredClone(base);
  actual.stages = [
    { name: '코딩테스트', order: 0 },
    { name: '서류', order: 1 },
    { name: '1차 면접', order: 2 },
    { name: '최종', order: 3 },
  ];
  const s = scoreParsed(base, actual);
  assert.equal(s.fields.stages, 1);
  assert.equal(s.fields.stageOrderExact, 0);
});

test('널 필드: expected null && actual null 이면 일치', () => {
  const exp = structuredClone(base);
  exp.location = null;
  const act = structuredClone(base);
  act.location = null;
  const s = scoreParsed(exp, act);
  assert.equal(s.fields.location, 1);
});

test('stages 가중치가 커서 전형을 다 틀리면 overall이 크게 떨어진다', () => {
  const actual = structuredClone(base);
  actual.stages = [{ name: '전혀다른단계', order: 0 }];
  const s = scoreParsed(base, actual);
  // stages(3) + stageOrderExact(1) = 가중치 4/8 이 날아감 → overall 0.5 근처 이하
  assert.ok(s.overall <= 0.55, `overall=${s.overall}`);
});

test('aggregate: 빈 배열은 0, 정상 배열은 평균', () => {
  assert.equal(aggregate([]).meanOverall, 0);
  const a = scoreParsed(base, structuredClone(base)); // 1
  const bad = structuredClone(base);
  bad.companyName = '다른회사';
  const b = scoreParsed(base, bad); // < 1
  const agg = aggregate([a, b]);
  assert.ok(agg.meanOverall > 0 && agg.meanOverall < 1);
  assert.equal(agg.fieldMeans.companyName, 0.5);
});
