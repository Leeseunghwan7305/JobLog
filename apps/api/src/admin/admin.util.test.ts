import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isAdminKakaoId, parseAdminIds } from './admin.util';

test('parseAdminIds: 쉼표 분리 + 공백·빈 항목 제거', () => {
  assert.deepEqual(parseAdminIds('123, 456 , ,789'), ['123', '456', '789']);
});

test('parseAdminIds: 미설정/빈 문자열은 빈 배열', () => {
  assert.deepEqual(parseAdminIds(undefined), []);
  assert.deepEqual(parseAdminIds(null), []);
  assert.deepEqual(parseAdminIds('   '), []);
});

test('isAdminKakaoId: 허용목록에 있으면 true', () => {
  assert.equal(isAdminKakaoId('456', '123,456,789'), true);
});

test('isAdminKakaoId: 허용목록에 없으면 false', () => {
  assert.equal(isAdminKakaoId('999', '123,456'), false);
});

test('isAdminKakaoId: 목록이 비면(기본) 누구도 어드민 아님', () => {
  assert.equal(isAdminKakaoId('123', undefined), false);
  assert.equal(isAdminKakaoId('123', ''), false);
});

test('isAdminKakaoId: kakaoId 없으면 false', () => {
  assert.equal(isAdminKakaoId(null, '123'), false);
  assert.equal(isAdminKakaoId(undefined, '123'), false);
});

test('isAdminKakaoId: 부분 일치는 안 됨(정확히 일치만)', () => {
  assert.equal(isAdminKakaoId('12', '123'), false);
});
