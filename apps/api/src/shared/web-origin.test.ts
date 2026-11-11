import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { primaryWebOrigin, webOrigins } from './web-origin';

const real = process.env.WEB_ORIGIN;
afterEach(() => {
  if (real === undefined) delete process.env.WEB_ORIGIN;
  else process.env.WEB_ORIGIN = real;
});

test('콤마로 여러 출처를 파싱(공백 제거)', () => {
  process.env.WEB_ORIGIN = 'https://joblog.store, https://joblog-web.vercel.app';
  assert.deepEqual(webOrigins(), [
    'https://joblog.store',
    'https://joblog-web.vercel.app',
  ]);
});

test('primaryWebOrigin은 첫 번째(정규 리다이렉트 대상)', () => {
  process.env.WEB_ORIGIN = 'https://joblog.store,https://joblog-web.vercel.app';
  assert.equal(primaryWebOrigin(), 'https://joblog.store');
});

test('단일 값도 정상', () => {
  process.env.WEB_ORIGIN = 'https://joblog.store';
  assert.deepEqual(webOrigins(), ['https://joblog.store']);
  assert.equal(primaryWebOrigin(), 'https://joblog.store');
});

test('미설정이면 localhost 폴백', () => {
  delete process.env.WEB_ORIGIN;
  assert.deepEqual(webOrigins(), ['http://localhost:3000']);
  assert.equal(primaryWebOrigin(), 'http://localhost:3000');
});
