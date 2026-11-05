import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  activationRate,
  avgUpdatesPerApp,
  parseSuccessBySite,
  retentionRate,
} from './growth.util';

test('activationRate: 활성/전체, 0명이면 null', () => {
  assert.equal(activationRate(10, 4), 0.4);
  assert.equal(activationRate(0, 0), null);
});

test('avgUpdatesPerApp: 로그/지원, 지원 0이면 null', () => {
  assert.equal(avgUpdatesPerApp(15, 5), 3);
  assert.equal(avgUpdatesPerApp(0, 0), null);
});

test('retentionRate D1: 가입 다음날 활동한 비율(그 날 지난 가입자만 분모)', () => {
  const signups = [
    { userId: 'a', signupDay: '2026-11-01' }, // +1일=11-02 (지남)
    { userId: 'b', signupDay: '2026-11-01' }, // 지남, 미방문
    { userId: 'c', signupDay: '2026-11-04' }, // +1일=11-05 (오늘=아직 미도래 아님? today=11-05 이므로 도래)
  ];
  const active = [
    { userId: 'a', day: '2026-11-02' }, // D1 방문 O
    { userId: 'c', day: '2026-11-05' }, // D1 방문 O
  ];
  // today=11-05. a,b,c 모두 +1일이 today 이하 → 분모 3, 유지 a·c = 2 → 2/3
  assert.equal(retentionRate(signups, active, '2026-11-05', 1), 2 / 3);
});

test('retentionRate: 아직 그 날이 안 온 가입자는 분모 제외, 분모 0이면 null', () => {
  const signups = [{ userId: 'a', signupDay: '2026-11-05' }]; // +1일=11-06 (미래)
  assert.equal(retentionRate(signups, [], '2026-11-05', 1), null);
});

test('parseSuccessBySite: 호스트별 집계, total 내림차순', () => {
  const logs = [
    { host: 'wanted.co.kr', ok: true },
    { host: 'wanted.co.kr', ok: false },
    { host: 'wanted.co.kr', ok: true },
    { host: 'saramin.co.kr', ok: true },
    { host: 'paste', ok: true },
  ];
  const r = parseSuccessBySite(logs);
  assert.equal(r[0].host, 'wanted.co.kr');
  assert.equal(r[0].total, 3);
  assert.equal(r[0].ok, 2);
  assert.equal(Math.round(r[0].successRate * 100), 67);
  // 동률(total=1)이면 host 오름차순 → 'paste' < 'saramin.co.kr'
  assert.deepEqual(
    r.slice(1).map((s) => s.host),
    ['paste', 'saramin.co.kr'],
  );
});
