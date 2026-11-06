import type { Metadata } from 'next';
import Link from 'next/link';

import { POPULAR_COMPANIES } from '@/lib/companies';

export const metadata: Metadata = {
  title: '회사 정보 — 직원수·추정연봉·전형',
  description:
    '국민연금 공개데이터 기반 회사별 직원수·추정연봉·업종 정보. JobLog에서 지원 전형을 추적하세요.',
  robots: { index: true, follow: true },
};

// 공개 디렉토리 — 회사 페이지로 가는 내부 링크(크롤 가능) 제공.
export default function CompanyDirectory() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-14">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← JobLog
      </Link>
      <header className="mt-6">
        <h1 className="text-3xl font-extrabold tracking-tight">회사 정보</h1>
        <p className="mt-2 text-muted-foreground">
          국민연금 공개데이터 기반 직원수·추정연봉·업종. 회사를 눌러 자세히 보고,
          지원했다면 전형을 추적하세요.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {POPULAR_COMPANIES.map((name) => (
          <Link
            key={name}
            href={`/company/${encodeURIComponent(name)}`}
            className="rounded-xl border border-border bg-card px-4 py-3 font-semibold transition hover:border-ring hover:shadow-sm"
          >
            {name}
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-indigo-400/5 p-7 text-center">
        <h2 className="text-xl font-extrabold tracking-tight">
          지원한 공고, 한곳에서 추적하세요
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          공고 링크만 붙여넣으면 AI가 회사·직무·전형을 정리해요.
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          무료로 시작하기
        </Link>
      </section>
    </main>
  );
}
