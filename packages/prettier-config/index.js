/**
 * JobLog 공유 Prettier 설정 (빡세게·일관되게).
 * web은 이 설정을 확장해 tailwind 클래스 정렬 플러그인을 더한다.
 *
 * @type {import("prettier").Config}
 */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  bracketSpacing: true,
  endOfLine: 'lf',
  quoteProps: 'as-needed',
};
