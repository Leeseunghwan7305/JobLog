import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stripRecommended } from './types';

test('추천/광고 섹션(마커 이후)을 잘라낸다', () => {
  const body = 'A'.repeat(500) + ' 진짜 공고 본문 ';
  const text = body + 'HOT100 (주)농심 2026 신입사원 채용 ...';
  const out = stripRecommended(text);
  assert.ok(out.includes('진짜 공고 본문'));
  assert.ok(!out.includes('농심'), '추천 섹션의 다른 회사가 제거돼야');
  assert.ok(!out.includes('HOT100'));
});

test('가장 먼저 나오는 마커에서 자른다', () => {
  const pre = 'X'.repeat(600);
  const out = stripRecommended(pre + '함께 본 공고 ... 추천 공고 ...');
  assert.equal(out, pre);
});

test('마커가 400자 이전이면 자르지 않는다 (실제 공고 보호)', () => {
  const text = '추천 공고 ' + 'B'.repeat(50);
  assert.equal(stripRecommended(text), text.trim());
});

test('마커가 없으면 원문을 그대로 둔다', () => {
  const text = 'C'.repeat(1000);
  assert.equal(stripRecommended(text), text);
});
