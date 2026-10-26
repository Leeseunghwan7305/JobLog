import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toCalendarEvents } from './calendar.util';

test('deadline과 scheduledAt을 이벤트로 투영한다', () => {
  const events = toCalendarEvents([
    {
      id: 'a1',
      companyName: '카카오',
      deadline: new Date('2026-11-01T00:00:00Z'),
      stages: [
        {
          name: '1차 면접',
          status: 'IN_PROGRESS',
          scheduledAt: new Date('2026-11-05T05:00:00Z'),
        },
        { name: '서류', status: 'PASSED', scheduledAt: null },
      ],
    },
  ]);
  assert.equal(events.length, 2);
  const deadline = events.find((e) => e.type === 'deadline');
  assert.ok(deadline);
  assert.equal(deadline.applicationId, 'a1');
  assert.equal(deadline.label, '서류 마감');
  assert.equal(deadline.status, null);
  const stage = events.find((e) => e.type === 'stage');
  assert.ok(stage);
  assert.equal(stage.label, '1차 면접');
  assert.equal(stage.status, 'IN_PROGRESS');
});

test('deadline이 없고 scheduledAt도 없으면 이벤트를 만들지 않는다', () => {
  const events = toCalendarEvents([
    {
      id: 'a2',
      companyName: '네이버',
      deadline: null,
      stages: [{ name: '서류', status: 'PENDING', scheduledAt: null }],
    },
  ]);
  assert.equal(events.length, 0);
});

test('날짜 오름차순으로 정렬한다', () => {
  const events = toCalendarEvents([
    {
      id: 'a3',
      companyName: 'A',
      deadline: new Date('2026-12-10T00:00:00Z'),
      stages: [
        {
          name: '면접',
          status: 'PENDING',
          scheduledAt: new Date('2026-12-01T00:00:00Z'),
        },
      ],
    },
  ]);
  assert.deepEqual(
    events.map((e) => e.type),
    ['stage', 'deadline'],
  );
});
