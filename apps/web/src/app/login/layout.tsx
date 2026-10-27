import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// /login 은 유일한 공개 진입점 — 루트의 기본 noindex를 색인 허용으로 덮어쓴다.
export const metadata: Metadata = {
  title: '로그인',
  description: '카카오로 로그인하고 지원한 공고의 전형 현황을 한 곳에서 추적하세요.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/login' },
  openGraph: {
    title: 'JobLog — 로그인',
    description: '카카오로 로그인하고 구직 현황을 추적하세요.',
    url: '/login',
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
