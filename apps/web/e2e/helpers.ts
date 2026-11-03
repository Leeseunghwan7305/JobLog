import type { Page, Route } from '@playwright/test';

/**
 * 특정 메서드+경로(URL predicate) 요청을 JSON으로 모킹한다.
 * 메서드가 다르면 fallback 시켜 다른 핸들러/네트워크로 흘려보낸다.
 */
export async function route(
  page: Page,
  match: (url: URL) => boolean,
  method: string,
  body: unknown,
  status = 200,
): Promise<void> {
  await page.route(
    (url) => match(url),
    async (r: Route) => {
      if (r.request().method() !== method) {
        await r.fallback();
        return;
      }
      await r.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    },
  );
}

/** 로그인 상태로 만든다: 토큰을 미리 심어 getToken()이 truthy가 되게. */
export async function login(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('joblog_token', 'e2e-token');
  });
}
