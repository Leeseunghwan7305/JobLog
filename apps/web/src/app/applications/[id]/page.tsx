'use client';

import type {
  ApplicationDto,
  CommuteInfo,
  CompanyProfileDto,
  CompanyReviewDto,
  CompanySearchResult,
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
    if (!getToken()) router.replace('/');
    else setReady(true);
  }, [router]);

  const app = useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<ApplicationDto>(`/applications/${id}`),
    enabled: ready,
  });

  // 집→회사 네이버 길찾기 (집 미설정/지오코딩 실패 시 null)
  const commute = useQuery({
    queryKey: ['commute', id],
    queryFn: () => apiFetch<CommuteInfo | null>(`/applications/${id}/commute`),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });

  const [showCompany, setShowCompany] = useState(true);
  const [companyQuery, setCompanyQuery] = useState('');
  // 입력은 즉시 반영하되 NPS 검색 호출은 250ms 디바운스 (대시보드 검색과 동일 패턴)
  const [debouncedCompanyQuery, setDebouncedCompanyQuery] = useState('');
  const [selectedSeq, setSelectedSeq] = useState<string | null>(null);

  useEffect(() => {
    if (app.data?.companyName) setCompanyQuery(app.data.companyName);
  }, [app.data?.companyName]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedCompanyQuery(companyQuery.trim());
    }, 250);
    return () => {
      clearTimeout(t);
    };
  }, [companyQuery]);

  const candidates = useQuery({
    queryKey: ['company-search', debouncedCompanyQuery],
    queryFn: () =>
      apiFetch<CompanySearchResult[]>(
        `/companies/search?name=${encodeURIComponent(debouncedCompanyQuery)}`,
      ),
    enabled: showCompany && debouncedCompanyQuery.length > 0 && !selectedSeq,
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

  // 기업 후기(잡플래닛)는 Firecrawl 스크랩이 느려 프로필과 분리해 지연 로딩한다.
  // 패널이 열렸을 때만 조회해 불필요한 스크랩을 막는다.
  const review = useQuery({
    queryKey: ['company-review', app.data?.companyName],
    queryFn: () =>
      apiFetch<CompanyReviewDto>(
        `/companies/reviews?name=${encodeURIComponent(app.data?.companyName ?? '')}`,
      ),
    enabled: showCompany && !!app.data?.companyName,
    staleTime: 1000 * 60 * 60, // 1시간 (백엔드 캐시 7일)
  });

  // 전형 진행 단일 액션: current(나 여기)/passed(합격·다음으로)/failed(탈락)
  const progress = useMutation({
    mutationFn: ({
      stageId,
      mode,
    }: {
      stageId: string;
      mode: 'current' | 'passed' | 'failed';
    }) =>
      apiFetch(`/applications/${id}/stages/${stageId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ mode }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['app', id] });
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['insights'] });
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
    <main className="mx-auto max-w-5xl px-6 py-8">
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

      <div className="mt-4">
        {commute.data ? (
          <a
            href={commute.data.naverUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-card transition hover:bg-primary/90"
          >
            🧭 집 → {commute.data.goalName} 대중교통 길찾기 ↗
          </a>
        ) : !commute.isLoading ? (
          <Link
            href="/profile"
            className="inline-block text-sm text-muted-foreground hover:text-primary"
          >
            🏠 마이페이지에서 집 주소를 설정하면 통근 길찾기를 볼 수 있어요 →
          </Link>
        ) : null}
      </div>

      {/* 전형 단계 | 회사 정보 — 넓은 화면에서 나란히 */}
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            전형 단계
          </h2>
          <span className="text-xs text-muted-foreground">
            전형을 누르면 ‘현재 단계’로 설정돼요 (이전은 합격 처리)
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {a.stages.map((s) => {
            const isCurrent = s.status === 'IN_PROGRESS';
            return (
              <div
                key={s.id}
                className={`flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 transition ${
                  isCurrent ? 'border-ring ring-1 ring-ring' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* 전형 칩: 누르면 현재 단계로 설정 */}
                  <button
                    type="button"
                    onClick={() => {
                      progress.mutate({ stageId: s.id, mode: 'current' });
                    }}
                    className="flex items-center gap-2 text-left"
                  >
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STATUS_CLASS[s.status]}`}
                    >
                      {STAGE_STATUS_LABEL[s.status]}
                    </span>
                    <span className="font-semibold">{s.name}</span>
                  </button>
                  {/* 현재 단계에만 합격/탈락 */}
                  {isCurrent && (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          progress.mutate({ stageId: s.id, mode: 'passed' });
                        }}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        합격 ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          progress.mutate({ stageId: s.id, mode: 'failed' });
                        }}
                        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                      >
                        탈락 ✗
                      </button>
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  예정일
                  <input
                    type="datetime-local"
                    defaultValue={
                      s.scheduledAt ? s.scheduledAt.slice(0, 16) : ''
                    }
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
            );
          })}
        </div>
      </section>

      <section>
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
                // 직원 수 추이 막대: 값 범위가 좁을 때(예: 44·44·43) 0~max
                // 절대 스케일은 모든 막대가 꼭대기에 몰려 변화가 안 보인다.
                // 보이는 높이를 [min, max] 구간에 매핑해 추세를 드러낸다.
                const counts = nps.trend.map((m) => m.memberCount);
                const maxMembers = Math.max(...counts);
                const minMembers = Math.min(...counts);
                const range = maxMembers - minMembers;
                const BAR_MIN = 6; // 최소 막대 높이(px) — 가장 작은 값도 보이게
                const BAR_MAX = 48; // h-14(56px) 안에서 라벨 공간 남김
                const barHeight = (count: number) =>
                  range > 0
                    ? ((count - minMembers) / range) * (BAR_MAX - BAR_MIN) +
                      BAR_MIN
                    : (BAR_MIN + BAR_MAX) / 2; // 전부 동일 → 평평한 중간 높이
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
                                  height: `${barHeight(m.memberCount)}px`,
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

            {/* 후기는 느린 잡플래닛 스크랩이라 NPS와 별도로 로딩된다 */}
            <div>
              <h3 className="font-semibold text-foreground">기업 후기</h3>
              {review.isLoading ? (
                <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <Spinner className="h-3 w-3" /> 잡플래닛 평점 불러오는 중…
                </p>
              ) : review.data ? (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    {review.data.rating != null ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        ★ {review.data.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        평점 정보를 바로 가져올 수 없어요.
                      </span>
                    )}
                    <a
                      href={review.data.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      잡플래닛에서 보기 ↗
                    </a>
                  </div>
                  {review.data.summary && (
                    <p className="mt-1 text-muted-foreground">
                      “{review.data.summary}”
                    </p>
                  )}
                </>
              ) : null}
            </div>

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
      </div>
    </main>
  );
}

