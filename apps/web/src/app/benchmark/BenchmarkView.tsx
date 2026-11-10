'use client';

import type { Benchmark } from '@joblog/types';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Spinner } from '@/components/ui/spinner';
import { apiFetch } from '@/lib/api';

const pct = (r: number) => Math.round(r * 100);

export default function BenchmarkView() {
  const q = useQuery({
    queryKey: ['benchmark'],
    queryFn: () => apiFetch<Benchmark>('/benchmark'),
  });
  const b = q.data;
  const hasData = !!b && (b.offerRate !== null || b.stages.length > 0);

  const share = () => {
    const nav = navigator as Navigator & {
      share?: (d: { title: string; text: string; url: string }) => Promise<void>;
    };
    const payload = {
      title: 'JobLog 취준 벤치마크',
      text: '취준생 평균 서류·면접 통과율 — JobLog',
      url: window.location.href,
    };
    if (nav.share) void nav.share(payload).catch(() => undefined);
    else void navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          JobLog 취준 벤치마크
        </span>
        <h1 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          다들 어디서 떨어질까?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-balance text-muted-foreground">
          JobLog 사용자들의 익명 집계입니다. 개인 정보 없이 전형별 평균 통과율만 모았어요.
        </p>
      </div>

      {q.isPending ? (
        <div className="mt-12 flex justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      ) : !b ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          벤치마크를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : (
        <>
          <div className="mt-8 flex justify-center">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
              집계 {b.users.toLocaleString()}명 · 지원 {b.applications.toLocaleString()}건
            </span>
          </div>

          {!hasData ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <div className="text-base font-semibold">아직 데이터가 모이는 중이에요</div>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                더 많은 지원 결과가 쌓이면 전형별 평균 통과율이 공개돼요. 첫 주자가 되어 보세요.
              </p>
            </div>
          ) : (
            <>
              {b.offerRate !== null && (
                <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-card">
                  <div className="text-sm text-muted-foreground">전체 평균 합격률</div>
                  <div className="mt-1 text-5xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {pct(b.offerRate)}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    결론 난 지원 {b.decided.toLocaleString()}건 기준
                  </div>
                </div>
              )}

              {b.stages.length > 0 && (
                <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
                  <div className="mb-4 text-sm font-semibold">전형별 평균 통과율</div>
                  <div className="space-y-3.5">
                    {b.stages.map((s) => (
                      <div key={s.name}>
                        <div className="mb-1 flex items-baseline justify-between text-sm">
                          <span className="font-medium">{s.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {pct(s.passRate)}%{' '}
                            <span className="text-xs">({s.decided.toLocaleString()}건)</span>
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct(s.passRate)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              내 지원 통과율은? 지금 시작하기
            </Link>
            <button
              onClick={share}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              벤치마크 공유하기
            </button>
          </div>
        </>
      )}
    </main>
  );
}
