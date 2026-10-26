import globals from 'globals';
import tseslint from 'typescript-eslint';

import base from './base.js';

/**
 * NestJS(api)용 ESLint. 베이스 + Nest 관용구에 맞춘 완화.
 */
export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    // Nest는 데코레이터로 DI/메타데이터를 다룬다
    '@typescript-eslint/no-extraneous-class': 'off',
    // 생성자 주입(parameter properties) 허용
    '@typescript-eslint/parameter-properties': 'off',
    // 데코레이터가 붙은 빈 메서드/클래스가 흔함
    '@typescript-eslint/no-empty-function': 'off',
    // 비동기 인터페이스·스텁 메서드(await 없는 async)가 흔함 — 보이되 막지 않음
    '@typescript-eslint/require-await': 'warn',
  },
});
