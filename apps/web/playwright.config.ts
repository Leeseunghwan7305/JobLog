import { defineConfig, devices } from '@playwright/test';

/**
 * JobLog 웹 E2E. 카카오 OAuth·외부 API(Firecrawl/Discord)는 자동화가 어려워
 * 각 테스트에서 API(NEXT_PUBLIC_API_BASE_URL)를 page.route로 모킹해 결정적으로 돌린다.
 * webServer로 next dev를 띄우고(이미 떠 있으면 재사용), chromium으로 실행.
 */
// 개발용 3000 포트는 다른 프로젝트가 점유할 수 있어, E2E는 전용 포트에서 자체 서버를 띄운다.
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: BASE,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
