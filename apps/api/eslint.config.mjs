import config from '@joblog/eslint-config/nest';

export default [
  ...config,
  {
    languageOptions: {
      parserOptions: {
        // 빌드 tsconfig는 테스트를 제외하므로, lint는 테스트까지 포함한 tsconfig를 쓴다.
        projectService: false,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
