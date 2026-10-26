import base from '@joblog/prettier-config';

/**
 * 저장소 전체 Prettier 설정. 공유 설정 + web의 Tailwind 클래스 정렬.
 * (api에는 tailwind 클래스가 없어 플러그인이 자연히 no-op)
 *
 * @type {import("prettier").Config}
 */
export default {
  ...base,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindConfig: './apps/web/tailwind.config.ts',
  tailwindFunctions: ['clsx', 'cn', 'cva'],
};
