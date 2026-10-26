import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * JobLog 공유 ESLint 베이스 (빡세게).
 * - typescript-eslint strict + stylistic (타입 인지 규칙 포함)
 * - import/export 자동 정렬 (simple-import-sort)
 * - type-only import 강제
 * - prettier 포맷과 충돌하는 규칙은 마지막에 전부 끔
 *
 * 타입 인지 규칙을 쓰려면 lint 대상이 각 앱 tsconfig에 포함돼야 한다(projectService).
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
      globals: { ...globals.node },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // no-unsafe-* 는 error — 외부 경계(Express req 등)는 타입으로 좁혀서 통과시킨다.
      // no-unnecessary-condition 만 warn 유지(외부/DB 데이터 방어 코드가 흔해서).
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  // 설정·스크립트성 JS 파일은 타입 인지 파싱에서 제외
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  // 테스트 파일: node:test의 test()는 반환 Promise를 러너가 관리한다
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  eslintConfigPrettier,
);
