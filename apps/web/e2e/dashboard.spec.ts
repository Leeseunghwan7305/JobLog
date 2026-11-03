import { expect, test, type Page } from '@playwright/test';

import { login, route } from './helpers';

const APP = {
  id: 'app1',
  companyName: '네이버',
  position: '백엔드 개발자',
  jobUrl: null,
  location: '성남',
  employmentType: '정규직',
  deadline: null,
  appliedAt: null,
  employeeCount: null,
  memo: null,
  status: 'IN_PROGRESS',
  stages: [
    {
      id: 's1',
      name: '서류',
      order: 0,
      status: 'IN_PROGRESS',
      scheduledAt: null,
      completedAt: null,
    },
    {
      id: 's2',
      name: '면접',
      order: 1,
      status: 'PENDING',
      scheduledAt: null,
      completedAt: null,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function mockDashboard(page: Page): Promise<void> {
  await route(page, (u) => u.pathname === '/auth/me', 'GET', {
    id: 'u1',
    nickname: '승환',
    email: null,
    profileImage: null,
  });
  await route(page, (u) => u.pathname === '/applications', 'GET', [APP]);
  await route(page, (u) => u.pathname === '/dashboard/stats', 'GET', {
    total: 1,
    inProgress: 1,
    offer: 0,
    rejected: 0,
  });
  await route(page, (u) => u.pathname === '/dashboard/insights', 'GET', {
    decided: 0,
    offer: 0,
    offerRate: null,
    stages: [],
  });
}

test.describe('대시보드 (로그인, API 모킹)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('칸반 컬럼과 공고 카드·퀵액션이 렌더된다', async ({ page }) => {
    await mockDashboard(page);
    await page.goto('/');

    await expect(page.getByText('최종합격', { exact: true })).toBeVisible();
    await expect(page.getByText('네이버', { exact: true })).toBeVisible();
    await expect(page.getByText('백엔드 개발자')).toBeVisible();
    await expect(page.getByRole('button', { name: '합격' })).toBeVisible();
    await expect(page.getByRole('button', { name: '탈락' })).toBeVisible();
  });

  test('카드에서 합격 처리 → 토스트 피드백', async ({ page }) => {
    await mockDashboard(page);
    await route(
      page,
      (u) => /\/applications\/app1\/stages\/s1\/progress$/.test(u.pathname),
      'PATCH',
      { ok: true },
    );
    await page.goto('/');
    await page.getByRole('button', { name: '합격' }).click();

    await expect(page.getByText(/합격 처리했어요/)).toBeVisible();
  });
});
