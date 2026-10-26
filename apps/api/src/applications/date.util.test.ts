import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseDateStrict } from './date.util';

test('유효한 날짜 문자열은 Date로 변환한다', () => {
  const d = parseDateStrict('2024-12-30', '마감일');
  assert.equal(d.toISOString().slice(0, 10), '2024-12-30');
});

test('날짜로 해석할 수 없는 문자열은 BadRequest(400)을 던진다', () => {
  assert.throws(
    () => parseDateStrict('마감일 정보가 제공되지 않았습니다.', '마감일'),
    (e: unknown) => e instanceof BadRequestException,
  );
});

test('에러 메시지에 필드명을 포함한다 (어떤 값이 문제인지 안내)', () => {
  try {
    parseDateStrict('상시채용', '마감일');
    assert.fail('던졌어야 한다');
  } catch (e) {
    assert.ok(e instanceof BadRequestException);
    assert.match((e as BadRequestException).message, /마감일/);
  }
});
