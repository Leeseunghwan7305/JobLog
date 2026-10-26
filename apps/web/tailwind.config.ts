import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#3858e9',
          ink: '#2740c2',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
