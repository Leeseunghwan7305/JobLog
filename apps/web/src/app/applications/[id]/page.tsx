'use client';

import type {
  ApplicationDto,
  CompanyReviewDto,
  StageStatus,
} from '@joblog/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { DEADLINE_TONE_CLASS, deadlineInfo } from '@/lib/date';
import { STAGE_STATUS_CLASS, STAGE_STATUS_LABEL } from '@/lib/stage';

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
        `/companies/reviews?name=${encodeURIComponent(app.data?.companyName ?? '')}`,
      ),
    enabled: !!app.data?.companyName,
  });

  const setStage = useMutation({
    mutationFn: ({
      stageId,
      status,
    }: {
      stageId: string;
      status: StageStatus;
    }) =>
      apiFetch(`/applications/${id}/stages/${stageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const setSchedule = useMutation({
    mutationFn: ({
      stageId,
      scheduledAt,
    }: {
      stageId: string;
      scheduledAt: string;
    }) =>
      apiFetch(`/applications/${id}/stages/${stageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt: scheduledAt || null }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
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
          {(() => {
            const info = deadlineInfo(a.deadline);
            return info ? (
              <p
                className={`mt-1 text-sm font-medium ${DEADLINE_TONE_CLASS[info.tone]}`}
              >
                {info.text}
              </p>
            ) : null;
          })()}
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
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{s.name}</span>
                <div className="flex gap-1.5">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStage.mutate({ stageId: s.id, status: st });
                      }}
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
              <label className="flex items-center gap-2 text-xs text-slate-500">
                예정일
                <input
                  type="datetime-local"
                  defaultValue={s.scheduledAt ? s.scheduledAt.slice(0, 16) : ''}
                  onChange={(e) => {
                    setSchedule.mutate({
                      stageId: s.id,
                      scheduledAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : '',
                    });
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-slate-700"
                />
              </label>
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
