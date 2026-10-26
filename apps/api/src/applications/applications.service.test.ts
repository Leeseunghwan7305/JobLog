import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

import { ApplicationsService } from './applications.service';
import type { PrismaService } from '../prisma/prisma.service';

function createPrismaMock(stage: {
  id: string;
  name: string;
  status: string;
  scheduledAt: Date | null;
  completedAt: Date | null;
}) {
  const app = {
    id: 'app1',
    userId: 'user1',
    status: 'IN_PROGRESS',
    stages: [stage],
  };

  const prisma = {
    application: {
      findUnique: mock.fn(async (_args: unknown) => app),
      update: mock.fn(async (_args: unknown) => app),
    },
    stage: {
      update: mock.fn(
        async (_args: { data: { scheduledAt?: Date | null } }) => stage,
      ),
      findMany: mock.fn(async (_args: unknown) => [stage]),
    },
    statusLog: {
      create: mock.fn(async (_args: unknown) => ({})),
    },
  };
  return prisma as unknown as PrismaService & typeof prisma;
}

test('updateStage: scheduledAt: null 전달 시 stage.update가 scheduledAt: null로 호출된다(명시적 clear)', async () => {
  const stage = {
    id: 'stage1',
    name: '1차 면접',
    status: 'PENDING',
    scheduledAt: new Date('2026-11-05T05:00:00Z'),
    completedAt: null,
  };
  const prisma = createPrismaMock(stage);
  const svc = new ApplicationsService(prisma);

  await svc.updateStage('user1', 'app1', 'stage1', { scheduledAt: null });

  assert.equal(prisma.stage.update.mock.calls.length, 1);
  const call = prisma.stage.update.mock.calls[0];
  assert.equal(call.arguments[0].data.scheduledAt, null);
});

test('updateStage: scheduledAt 미전달(undefined)이면 stage.update의 data.scheduledAt도 undefined (변경 안 함)', async () => {
  const stage = {
    id: 'stage1',
    name: '1차 면접',
    status: 'PENDING',
    scheduledAt: new Date('2026-11-05T05:00:00Z'),
    completedAt: null,
  };
  const prisma = createPrismaMock(stage);
  const svc = new ApplicationsService(prisma);

  await svc.updateStage('user1', 'app1', 'stage1', {});

  assert.equal(prisma.stage.update.mock.calls.length, 1);
  const call = prisma.stage.update.mock.calls[0];
  assert.equal(call.arguments[0].data.scheduledAt, undefined);
});
