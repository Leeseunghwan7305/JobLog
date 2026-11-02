import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isAdminKakaoId,
  maskEmail,
  maskRegion,
  parseAdminIds,
  parsePaging,
} from './admin.util';

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

test('maskEmail: 로컬파트 앞 2자만 남기고 가림', () => {
  assert.equal(maskEmail('seunghwan@gmail.com'), 'se***@gmail.com');
});

test('maskEmail: 로컬파트 2자 이하면 1자만', () => {
  assert.equal(maskEmail('ab@x.com'), 'a***@x.com');
  assert.equal(maskEmail('a@x.com'), 'a***@x.com');
});

test('maskEmail: null은 그대로, @ 없으면 통째 가림', () => {
  assert.equal(maskEmail(null), null);
  assert.equal(maskEmail('notanemail'), '***');
});

test('maskRegion: 앞 2토큰(지역)까지만', () => {
  assert.equal(maskRegion('서울 강남구 테헤란로 152'), '서울 강남구');
});

test('maskRegion: 2토큰 이하면 그대로, null은 null', () => {
  assert.equal(maskRegion('서울특별시'), '서울특별시');
  assert.equal(maskRegion('부산 해운대구'), '부산 해운대구');
  assert.equal(maskRegion(null), null);
});

test('parsePaging: 기본값 page=1 pageSize=50, skip/take 계산', () => {
  assert.deepEqual(parsePaging(undefined, undefined), {
    page: 1,
    pageSize: 50,
    skip: 0,
    take: 50,
  });
});

test('parsePaging: 문자열 쿼리 파싱 + skip 계산', () => {
  assert.deepEqual(parsePaging('3', '20'), {
    page: 3,
    pageSize: 20,
    skip: 40,
    take: 20,
  });
});

test('parsePaging: 범위를 벗어나면 클램프(page≥1, pageSize 1..200)', () => {
  assert.equal(parsePaging('0', '0').page, 1);
  assert.equal(parsePaging('-5', '-5').pageSize, 1);
  assert.equal(parsePaging('1', '9999').pageSize, 200);
  assert.equal(parsePaging('x', 'y').pageSize, 50); // 파싱 불가 → 기본
});
