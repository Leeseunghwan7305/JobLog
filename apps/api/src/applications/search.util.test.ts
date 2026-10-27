import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applicationSearchWhere } from './search.util';

test('검색어 없음(undefined)이면 필터 없음 {}', () => {
  assert.deepEqual(applicationSearchWhere(undefined), {});
});

test('빈 문자열·공백만 있으면 필터 없음 {} (전체 매칭 방지)', () => {
  assert.deepEqual(applicationSearchWhere(''), {});
  assert.deepEqual(applicationSearchWhere('   '), {});
});

test('검색어가 있으면 회사명·직무·메모를 대소문자 무시 부분일치 OR', () => {
  assert.deepEqual(applicationSearchWhere('네이버'), {
    OR: [
      { companyName: { contains: '네이버', mode: 'insensitive' } },
      { position: { contains: '네이버', mode: 'insensitive' } },
      { memo: { contains: '네이버', mode: 'insensitive' } },
    ],
  });
});

test('앞뒤 공백은 trim해서 검색어로 쓴다', () => {
  assert.deepEqual(applicationSearchWhere('  프론트  '), {
    OR: [
      { companyName: { contains: '프론트', mode: 'insensitive' } },
      { position: { contains: '프론트', mode: 'insensitive' } },
      { memo: { contains: '프론트', mode: 'insensitive' } },
    ],
  });
});
