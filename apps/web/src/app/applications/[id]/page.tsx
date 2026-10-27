'use client';

import type {
  ApplicationDto,
  CompanyProfileDto,
  CompanySearchResult,
  StageStatus,
} from '@joblog/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';

import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { DEADLINE_TONE_CLASS, deadlineInfo } from '@/lib/date';
import { STAGE_STATUS_CLASS, STAGE_STATUS_LABEL } from '@/lib/stage';
import { externalHref } from '@/lib/url';

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

  const [showCompany, setShowCompany] = useState(true);
  const [companyQuery, setCompanyQuery] = useState('');
  const [selectedSeq, setSelectedSeq] = useState<string | null>(null);

  useEffect(() => {
    if (app.data?.companyName) setCompanyQuery(app.data.companyName);
  }, [app.data?.companyName]);

  const candidates = useQuery({
    queryKey: ['company-search', companyQuery],
    queryFn: () =>
      apiFetch<CompanySearchResult[]>(
        `/companies/search?name=${encodeURIComponent(companyQuery)}`,
      ),
    enabled: showCompany && companyQuery.length > 0 && !selectedSeq,
  });

  const profile = useQuery({
    queryKey: ['company-profile', app.data?.companyName, selectedSeq],
    queryFn: () =>
      apiFetch<CompanyProfileDto>(
        `/companies/profile?name=${encodeURIComponent(app.data?.companyName ?? '')}${selectedSeq ? `&seq=${encodeURIComponent(selectedSeq)}` : ''}`,
      ),
    // 상단 규모 뱃지를 위해 회사명이 있으면 패널을 열지 않아도 미리 조회한다.
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

  const archive = useMutation({
    mutationFn: (archived: boolean) =>
      apiFetch(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['apps'] });
    },
  });

  const setTags = useMutation({
    mutationFn: (tags: string[]) =>
      apiFetch(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tags }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['apps'] });
    },
  });

  // 조회된 회사규모(NPS 가입자수)를 지원에 스냅샷 저장 → 목록·다른 기기에서도 일관.
  const saveSize = useMutation({
    mutationFn: (employeeCount: number) =>
      apiFetch(`/applications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ employeeCount }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['apps'] });
    },
  });
  const npsSize = profile.data?.nps?.memberCount ?? null;
  useEffect(() => {
    if (
      npsSize &&
      app.data &&
      app.data.employeeCount !== npsSize &&
      !saveSize.isPending
    ) {
      saveSize.mutate(npsSize);
    }
  }, [npsSize, app.data, saveSize]);

  if (!ready) return null;
  if (app.isLoading)
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-6 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
        <div className="mt-8 flex flex-col gap-2">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  if (!app.data)
    return <main className="p-8 text-muted-foreground">찾을 수 없어요.</main>;

  const a = app.data;
  // 회사규모 ≈ 국민연금 가입자수(직원수 근사). 저장된 스냅샷 우선, 없으면 방금 조회한 값.
  const companySize = a.employeeCount ?? npsSize;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <ThemeToggle />
      </div>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {a.companyName}
          </h1>
          <p className="text-muted-foreground">{a.position}</p>
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {a.archivedAt ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                보관됨
              </span>
            ) : null}
            {companySize ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                규모 {companySize.toLocaleString()}명
              </span>
            ) : null}
            {a.appliedAt ? (
              <span className="text-xs text-muted-foreground">
                지원일 {a.appliedAt.slice(0, 10)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            disabled={archive.isPending}
            onClick={() => {
              archive.mutate(!a.archivedAt);
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {archive.isPending && <Spinner className="h-3 w-3" />}
            {a.archivedAt ? '보관 해제' : '보관'}
          </button>
          <button
            disabled={remove.isPending}
            onClick={() => {
              if (confirm('이 지원을 삭제할까요?')) remove.mutate();
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-500 disabled:opacity-60 dark:hover:text-red-400"
          >
            {remove.isPending && <Spinner className="h-3 w-3" />}
            삭제
          </button>
        </div>
      </div>

      {a.jobUrl && (
        <a
          href={externalHref(a.jobUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          공고 링크 열기 ↗
        </a>
      )}

      <TagEditor
        tags={a.tags}
        pending={setTags.isPending}
        onChange={(next) => {
          setTags.mutate(next);
        }}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          전형 단계
        </h2>
        <div className="flex flex-col gap-2">
          {a.stages.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
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
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {STAGE_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  className="rounded-md border border-border px-2 py-1 text-foreground"
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <button
          type="button"
          onClick={() => { setShowCompany((v) => !v); }}
          className="mb-3 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
        >
          {a.companyName} 회사 정보 {showCompany ? '▲' : '▼'}
        </button>

        {showCompany && (
          <div className="space-y-4 rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <div>
              <input
                value={companyQuery}
                onChange={(e) => {
                  setCompanyQuery(e.target.value);
                  setSelectedSeq(null);
                }}
                placeholder="회사명으로 검색"
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-foreground"
              />
              {!selectedSeq && candidates.isFetching && (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="h-3 w-3" /> 검색 중…
                </p>
              )}
              {!selectedSeq && candidates.data && candidates.data.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {candidates.data.slice(0, 8).map((c) => (
                    <li key={c.seq}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeq(c.seq);
                        }}
                        className="w-full rounded-md border border-border px-2 py-1 text-left hover:bg-muted"
                      >
                        <span className="font-medium text-foreground">
                          {c.name}
                        </span>
                        {c.region && (
                          <span className="text-muted-foreground">
                            {' '}
                            · {c.region}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {profile.isLoading && <Skeleton className="h-16 w-full" />}

            {profile.data?.nps &&
              (() => {
                const nps = profile.data.nps;
                const maxMembers = Math.max(
                  ...nps.trend.map((m) => m.memberCount),
                  1,
                );
                return (
                  <div>
                    <h3 className="font-semibold text-foreground">
                      국민연금 공개데이터
                    </h3>
                    <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                      <li>직원 수: {nps.memberCount}명</li>
                      {nps.estimatedAnnualSalaryManwon != null && (
                        <li>
                          추정 평균연봉: {nps.estimatedAnnualSalaryManwon}만원
                        </li>
                      )}
                      {nps.newThisMonth != null && (
                        <li>당월 입사: {nps.newThisMonth}명</li>
                      )}
                      {nps.lostThisMonth != null && (
                        <li>당월 퇴사: {nps.lostThisMonth}명</li>
                      )}
                      {nps.turnoverRatePct != null && (
                        <li>월 회전율: {nps.turnoverRatePct}%</li>
                      )}
                      {nps.estTenureMonths != null && (
                        <li>
                          추정 평균근속: 약{' '}
                          {nps.estTenureMonths >= 12
                            ? `${(nps.estTenureMonths / 12).toFixed(1)}년`
                            : `${nps.estTenureMonths}개월`}{' '}
                          <span className="text-[10px]">(추정)</span>
                        </li>
                      )}
                      {nps.npsJoinedYear != null && (
                        <li>
                          업력: 가입 {nps.npsJoinedYear}년 (약{' '}
                          {new Date().getFullYear() - nps.npsJoinedYear}년차)
                        </li>
                      )}
                      {nps.industry && <li>업종: {nps.industry}</li>}
                      {nps.region && (
                        <li className="col-span-2">
                          위치: {nps.region}{' '}
                          <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(nps.region)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            지도 ↗
                          </a>
                        </li>
                      )}
                    </ul>

                    {nps.trend.length > 1 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">
                          직원 수 추이
                        </p>
                        <div className="mt-1 flex h-14 items-end gap-1">
                          {nps.trend.map((m) => (
                            <div
                              key={m.ym}
                              className="flex flex-col items-center gap-0.5"
                              title={`${m.ym}: ${m.memberCount}명`}
                            >
                              <div
                                className="w-4 rounded-sm bg-primary/60"
                                style={{
                                  height: `${(m.memberCount / maxMembers) * 40 + 4}px`,
                                }}
                              />
                              <span className="text-[9px] text-muted-foreground">
                                {m.ym.slice(4)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="mt-1 text-xs text-muted-foreground">
                      국민연금 가입사업장 공개데이터 기반 추정
                      {nps.dataYm ? ` · ${nps.dataYm}` : ''}
                    </p>
                  </div>
                );
              })()}

            {!profile.isLoading && !profile.data?.nps && (
              <p className="text-xs text-muted-foreground">
                이 회사의 국민연금 지표를 찾지 못했어요. 위에서 검색해 사업장을
                선택하거나 아래 링크로 확인하세요.
              </p>
            )}

            {profile.data?.review && (
              <div>
                <h3 className="font-semibold text-foreground">기업 후기</h3>
                <div className="mt-1 flex items-center gap-2">
                  {profile.data.review.rating != null ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      ★ {profile.data.review.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      평점 정보를 바로 가져올 수 없어요.
                    </span>
                  )}
                  <a
                    href={profile.data.review.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    잡플래닛에서 보기 ↗
                  </a>
                </div>
                {profile.data.review.summary && (
                  <p className="mt-1 text-muted-foreground">
                    “{profile.data.review.summary}”
                  </p>
                )}
              </div>
            )}

            <div>
              <h3 className="font-semibold text-foreground">바로가기</h3>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {(profile.data?.links ?? []).map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function TagEditor({
  tags,
  pending,
  onChange,
}: {
  tags: string[];
  pending: boolean;
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    setInput('');
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
  };
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        태그
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {t}
            <button
              aria-label={`${t} 태그 삭제`}
              disabled={pending}
              onClick={() => {
                onChange(tags.filter((x) => x !== t));
              }}
              className="text-muted-foreground hover:text-red-500 disabled:opacity-60"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="+ 태그"
          disabled={pending}
          className="w-20 rounded-full border border-dashed border-input bg-background px-2.5 py-1 text-xs transition focus:w-28 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}
