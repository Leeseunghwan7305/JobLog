import type { Metadata } from 'next';

import BenchmarkView from './BenchmarkView';

export const metadata: Metadata = {
  title: '취준 벤치마크 — 평균 서류·면접 통과율',
  description:
    'JobLog 사용자들의 익명 집계. 전형별 평균 통과율과 합격률을 확인하고 내 지원과 비교해 보세요.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/benchmark' },
  openGraph: {
    title: '취준 벤치마크 — 다들 어디서 떨어질까?',
    description: 'JobLog 사용자들의 익명 집계. 전형별 평균 통과율과 합격률.',
    url: '/benchmark',
    type: 'website',
  },
};

export default function BenchmarkPage() {
  return <BenchmarkView />;
}
