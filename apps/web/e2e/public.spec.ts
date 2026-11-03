import { expect, test } from '@playwright/test';

import { route } from './helpers';

test.describe('공개 플로우 (로그아웃)', () => {
  test('랜딩은 로그인창이 아니라 체험 분석 화면을 보여준다', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: /어디까지 왔는지/ }),
    ).toBeVisible();
    await expect(
      page.getByText('로그인 없이 먼저 분석해 볼 수 있어요'),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder('채용 공고 링크를 붙여넣으세요'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: '분석', exact: true })).toBeVisible();
  });

  test('공고 링크 분석 → 로그인 전에 AI 미리보기 카드가 뜬다', async ({
    page,
  }) => {
    await route(page, (u) => u.pathname === '/parse/preview', 'POST', {
      draft: {
        companyName: '당근마켓',
        position: '프론트엔드 개발자',
        location: '서울 강남구',
        employmentType: '정규직',
        deadline: null,
        stages: [
          { name: '서류', order: 0 },
          { name: '면접', order: 1 },
          { name: '최종', order: 2 },
        ],
        confidence: 'high',
      },
      needsManualInput: false,
    });
    await page.goto('/');
    await page
      .getByPlaceholder('채용 공고 링크를 붙여넣으세요')
      .fill('https://example.com/job/1');
    await page.getByRole('button', { name: '분석', exact: true }).click();

    await expect(page.getByText('AI가 이렇게 정리했어요')).toBeVisible();
    await expect(page.getByText('당근마켓', { exact: true })).toBeVisible();
    await expect(page.getByText('프론트엔드 개발자')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /카카오로 로그인하고 저장/ }),
    ).toBeVisible();
  });

  test('비로그인으로 보호 페이지 접근 → 로그인창이 아니라 랜딩으로 보낸다', async ({
    page,
  }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByPlaceholder('채용 공고 링크를 붙여넣으세요'),
    ).toBeVisible();
  });

  test('개발자에게 문의하기 → 전송 성공 피드백', async ({ page }) => {
    await route(
      page,
      (u) => u.pathname === '/support',
      'POST',
      { ok: true },
      201,
    );
    await page.goto('/');
    await page.getByRole('button', { name: '개발자에게 문의하기' }).click();
    await page
      .getByPlaceholder('어떤 점이 불편하거나 궁금하신가요?')
      .fill('E2E 테스트 문의입니다');
    await page.getByRole('button', { name: '문의 보내기' }).click();

    await expect(page.getByText('문의가 전송됐어요')).toBeVisible();
  });
});
