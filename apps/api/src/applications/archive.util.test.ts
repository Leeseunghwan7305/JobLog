import assert from 'node:assert/strict';
import { test } from 'node:test';

import { archiveWhere, resolveArchivedAt } from './archive.util';

test('archiveWhere(false)는 활성만(archivedAt null)', () => {
  assert.deepEqual(archiveWhere(false), { archivedAt: null });
});

test('archiveWhere(true)는 보관된 것만(archivedAt not null)', () => {
  assert.deepEqual(archiveWhere(true), { archivedAt: { not: null } });
});

test('resolveArchivedAt: undefined면 변경 없음(undefined)', () => {
  assert.equal(resolveArchivedAt(undefined, new Date()), undefined);
});

test('resolveArchivedAt: true면 주입된 now', () => {
  const now = new Date('2026-10-27T00:00:00.000Z');
  assert.equal(resolveArchivedAt(true, now), now);
});

test('resolveArchivedAt: false면 null(보관 해제)', () => {
  assert.equal(resolveArchivedAt(false, new Date()), null);
});
