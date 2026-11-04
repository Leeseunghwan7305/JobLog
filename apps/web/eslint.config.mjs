import config from '@joblog/eslint-config/next';

export default [
  // E2E(Playwright)는 앱 tsconfig 밖이라 타입 인지 린트에서 제외 (자체 esbuild로 실행)
  {
    ignores: [
      'e2e/**',
      'playwright.config.ts',
      'playwright-report/**',
      'test-results/**',
      'public/**', // 정적 자산(서비스워커 sw.js 등)은 앱 tsconfig 밖
    ],
  },
  ...config,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
