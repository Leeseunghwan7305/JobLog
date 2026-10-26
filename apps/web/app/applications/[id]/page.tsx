'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { STAGE_STATUS_CLASS, STAGE_STATUS_LABEL } from '@/lib/stage';
import type {
  ApplicationDto,
  CompanyReviewDto,
  StageStatus,
} from '@joblog/types';

const STATUSES: StageStatus[] = ['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED'];

export default function ApplicationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<ApplicationDto>(`/applications/${id}`),
    enabled: ready,
  });

  const reviews = useQuery({
    queryKey: ['reviews', app.data?.companyName],
    queryFn: () =>
      apiFetch<CompanyReviewDto>(
        `/companies/reviews?name=${encodeURIComponent(app.data!.companyName)}`,
      ),
    enabled: !!app.data?.companyName,
  });

  const setStage = useMutation({
    mutationFn: ({ stageId, status }: { stageId: string; status: StageStatus }) =>
      apiFetch(`/applications/${id}/stages/${stageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app', id] });
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      router.replace('/');
    },
  });

  if (!ready) return null;
  if (app.isLoading)
    return <main className="p-8 text-slate-400">불러오는 중…</main>;
  if (!app.data)
    return <main className="p-8 text-slate-400">찾을 수 없어요.</main>;

  const a = app.data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/" className="text-sm text-slate-400 hover:text-slate-700">
        ← 대시보드
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {a.companyName}
          </h1>
          <p className="text-slate-500">{a.position}</p>
        </div>
        <button
          onClick={() => {
            if (confirm('이 지원을 삭제할까요?')) remove.mutate();
          }}
          className="text-sm text-slate-400 hover:text-red-500"
        >
          삭제
        </button>
      </div>

      {a.jobUrl && (
        <a
          href={a.jobUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-brand hover:underline"
        >
          공고 링크 열기 ↗
        </a>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          전형 단계
        </h2>
        <div className="flex flex-col gap-2">
          {a.stages.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <span className="font-semibold">{s.name}</span>
              <div className="flex gap-1.5">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => setStage.mutate({ stageId: s.id, status: st })}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      s.status === st
                        ? STAGE_STATUS_CLASS[st]
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {STAGE_STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          기업 후기
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {reviews.data?.rating != null ? (
            <span className="font-semibold">★ {reviews.data.rating}</span>
          ) : (
            <span className="text-slate-500">
              평점 정보를 바로 가져올 수 없어요.
            </span>
          )}
          {reviews.data?.sourceUrl && (
            <a
              href={reviews.data.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-brand hover:underline"
            >
              잡플래닛에서 보기 ↗
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
