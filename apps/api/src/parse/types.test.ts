import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeParsed } from './types';

test('deadline: 날짜가 아닌 문장은 null로 떨군다 (저장 시 Invalid Date 방지)', () => {
  const r = normalizeParsed({
    companyName: '미리캔버스',
    position: 'Product Engineer',
    deadline: '마감일 정보가 제공되지 않았습니다.',
    stages: [{ name: '서류', order: 0 }],
    confidence: 'high',
  });
  assert.equal(r.deadline, null);
});

test('deadline: 상시/수시채용 같은 비(非)날짜 표현도 null', () => {
  assert.equal(normalizeParsed({ deadline: '상시채용' }).deadline, null);
  assert.equal(normalizeParsed({ deadline: '채용시 마감' }).deadline, null);
});

test('deadline: 다양한 날짜 표기를 YYYY-MM-DD로 정규화', () => {
  assert.equal(
    normalizeParsed({ deadline: '2024-12-30' }).deadline,
    '2024-12-30',
  );
  assert.equal(
    normalizeParsed({ deadline: '2024.12.30' }).deadline,
    '2024-12-30',
  );
  assert.equal(
    normalizeParsed({ deadline: '2024/12/30' }).deadline,
    '2024-12-30',
  );
  assert.equal(
    normalizeParsed({ deadline: '2024년 12월 30일' }).deadline,
    '2024-12-30',
  );
  // 한 자리 월/일도 0 패딩
  assert.equal(
    normalizeParsed({ deadline: '2024.1.5' }).deadline,
    '2024-01-05',
  );
});

test('deadline: null/빈 문자열은 null 유지', () => {
  assert.equal(normalizeParsed({ deadline: null }).deadline, null);
  assert.equal(normalizeParsed({ deadline: '' }).deadline, null);
  assert.equal(normalizeParsed({}).deadline, null);
});

test('stages: 단계명의 대괄호·꺾쇠 괄호를 벗기고 trim 한다', () => {
  const r = normalizeParsed({
    stages: [
      { name: '[1차 인터뷰]', order: 0 },
      { name: '「2차 인터뷰」', order: 1 },
      { name: '  처우 협의  ', order: 2 },
    ],
  });
  assert.deepEqual(
    r.stages.map((s) => s.name),
    ['1차 인터뷰', '2차 인터뷰', '처우 협의'],
  );
});

test('stages: 기존 동작 유지 — order로 정렬 후 0-based 재매김', () => {
  const r = normalizeParsed({
    stages: [
      { name: '최종', order: 5 },
      { name: '서류', order: 1 },
    ],
  });
  assert.deepEqual(r.stages, [
    { name: '서류', order: 0 },
    { name: '최종', order: 1 },
  ]);
});
