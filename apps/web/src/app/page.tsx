'use client';

import type {
  ApplicationDto,
  DashboardInsights,
  DashboardStats,
  StageDto,
  UserDto,
} from '@joblog/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import AddJobModal from '@/components/AddJobModal';
import LoginModal from '@/components/LoginModal';
import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import {
  clearPendingUrl,
  clearToken,
  getPendingUrl,
  getToken,
  setPendingUrl,
} from '@/lib/auth';
import { DEADLINE_TONE_CLASS, deadlineInfo } from '@/lib/date';
import {
  currentStageLabel,
  STAGE_STATUS_CLASS,
  STAGE_STATUS_LABEL,
} from '@/lib/stage';

export default function Home() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => {
    setHasToken(!!getToken());
  }, []);

  if (hasToken === null) return null; // SSR/하이드레이션 전
  return hasToken ? <Dashboard /> : <Landing />;
}

/* ───────────────── 로그아웃 랜딩: URL 입력 → 로그인 유도 ───────────────── */

function Landing() {
  const [url, setUrl] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const start = () => {
    const v = url.trim();
    if (!v) return;
    setPendingUrl(v); // 로그인 리다이렉트 너머로 URL 보존
    setShowLogin(true);
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-6">
      <div className="w-full text-center">
        <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
          J
        </div>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight">
          지원한 공고, <span className="text-primary">어디까지 왔는지</span>
          <br />한 곳에서 추적하세요
        </h1>
        <p className="mb-8 text-muted-foreground">
          공고 링크만 붙여넣으면 회사·직무·전형을 자동으로 정리해 드려요.
        </p>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                start();
              }
            }}
            placeholder="채용 공고 링크를 붙여넣으세요"
            className="flex-1 rounded-lg border border-input px-4 py-3"
          />
          <button
            onClick={start}
            className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            분석
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <button
            onClick={() => {
              setShowLogin(true);
            }}
            className="text-primary hover:underline"
          >
            로그인
          </button>
        </p>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => {
            setShowLogin(false);
          }}
        />
      )}
    </main>
  );
}

/* ───────────────── 로그인 후 대시보드 ───────────────── */

const COLUMNS = [
  { key: 'IN_PROGRESS', label: '진행중' },
  { key: 'OFFER', label: '최종합격' },
  { key: 'REJECTED', label: '불합격' },
  { key: 'CLOSED', label: '철회' },
] as const;

/** 지원의 전체 전형 단계를 이름+상태색 칩으로 나열 (1차/2차/인적성 등이 그대로 보임) */
function StageTrack({ stages }: { stages: StageDto[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {stages.map((s) => (
        <span
          key={s.id}
          title={`${s.name} · ${STAGE_STATUS_LABEL[s.status]}`}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STAGE_STATUS_CLASS[s.status]}`}
        >
          {s.name}
        </span>
      ))}
    </div>
  );
}

/** 마감일 D-day 라벨 (없으면 렌더 안 함) */
function Deadline({ iso }: { iso: string | null }) {
  const info = deadlineInfo(iso);
  if (!info) return null;
  return (
    <div
      className={`mt-2 text-xs font-medium ${DEADLINE_TONE_CLASS[info.tone]}`}
    >
      {info.text}
    </div>
  );
}

function pillClass(status: ApplicationDto['status']): string {
  switch (status) {
    case 'OFFER':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    case 'CLOSED':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
}

function Dashboard() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState<string | undefined>(undefined);

  // 로그인 유도 흐름에서 넘어온 URL이 있으면 분석 모달 자동 오픈
  useEffect(() => {
    const pending = getPendingUrl();
    if (pending) {
      clearPendingUrl();
      setAddUrl(pending);
      setShowAdd(true);
    }
  }, []);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserDto>('/auth/me'),
  });
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);
    return () => {
      clearTimeout(t);
    };
  }, [q]);

  const [showArchived, setShowArchived] = useState(false);

  const apps = useQuery({
    queryKey: ['apps', debouncedQ, showArchived],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
      if (showArchived) params.set('archived', 'true');
      const qs = params.toString();
      return apiFetch<ApplicationDto[]>(
        `/applications${qs ? `?${qs}` : ''}`,
      );
    },
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<DashboardStats>('/dashboard/stats'),
  });

  const insights = useQuery({
    queryKey: ['insights'],
    queryFn: () => apiFetch<DashboardInsights>('/dashboard/insights'),
  });

  const grouped = (status: string) =>
    (apps.data ?? []).filter((a) => a.status === status);

  const openAdd = () => {
    setAddUrl(undefined);
    setShowAdd(true);
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            J
          </span>
          <span className="text-lg font-bold tracking-tight">JobLog</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <ThemeToggle />
          <button
            onClick={() => {
              setShowArchived((v) => !v);
            }}
            className={
              showArchived
                ? 'font-semibold text-primary'
                : 'text-muted-foreground hover:text-primary'
            }
          >
            {showArchived ? '← 대시보드' : '보관함'}
          </button>
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-primary"
          >
            이력서
          </Link>
          <Link
            href="/calendar"
            className="text-muted-foreground hover:text-primary"
          >
            캘린더
          </Link>
          {me.data && (
            <span className="text-muted-foreground">{me.data.nickname}님</span>
          )}
          <button
            onClick={() => {
              clearToken();
              router.refresh();
              window.location.href = '/';
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <div
          className={`flex gap-3 ${stats.isLoading ? 'motion-safe:animate-pulse' : ''}`}
        >
          <Stat label="전체" value={stats.data?.total ?? 0} />
          <Stat label="진행중" value={stats.data?.inProgress ?? 0} />
          <Stat label="합격" value={stats.data?.offer ?? 0} tone="emerald" />
          <Stat label="불합격" value={stats.data?.rejected ?? 0} tone="red" />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
            placeholder="회사·직무·메모 검색"
            className="w-36 rounded-lg border border-input bg-background px-3 py-2 text-sm transition focus:w-52 focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
          />
          <button
            onClick={openAdd}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            + 공고 추가
          </button>
        </div>
      </div>

      {!debouncedQ &&
        !showArchived &&
        (apps.data?.length ?? 0) > 0 &&
        insights.data && <InsightsPanel data={insights.data} />}

      {apps.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key}>
              <Skeleton className="mb-3 h-4 w-14" />
              <div className="flex flex-col gap-3">
                {[0, 1].map((n) => (
                  <div
                    key={n}
                    className="rounded-xl border border-border bg-card p-3"
                  >
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-3 w-32" />
                    <Skeleton className="mt-3 h-5 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (apps.data?.length ?? 0) === 0 ? (
        showArchived ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <div className="text-5xl">🗄️</div>
            <p className="text-lg font-bold">보관된 공고가 없어요</p>
            <p className="mt-1 text-sm text-muted-foreground">
              상세 화면에서 ‘보관’하면 여기로 모여요.
            </p>
          </div>
        ) : debouncedQ ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <div className="text-5xl">🔍</div>
            <p className="text-lg font-bold">검색 결과가 없어요</p>
            <p className="mt-1 text-sm text-muted-foreground">
              ‘{debouncedQ}’에 맞는 공고를 찾지 못했어요.
            </p>
          </div>
        ) : (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <div className="text-5xl">📋</div>
            <div>
              <p className="text-lg font-bold">아직 등록한 공고가 없어요</p>
              <p className="mt-1 text-sm text-muted-foreground">
                채용 공고 링크를 붙여넣으면 전형까지 자동으로 정리해 드려요.
              </p>
            </div>
            <button
              onClick={openAdd}
              className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              + 첫 공고 추가하기
            </button>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = grouped(col.key);
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{col.label}</span>
                  <span className="text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="block rounded-xl border border-border bg-card p-3 transition duration-300 animate-in fade-in slide-in-from-bottom-1 hover:border-ring hover:shadow-sm"
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{app.companyName}</span>
                        {app.employeeCount ? (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                            {app.employeeCount.toLocaleString()}명
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {app.position}
                      </div>
                      <span
                        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${pillClass(app.status)}`}
                      >
                        {currentStageLabel(app)}
                      </span>
                      <StageTrack stages={app.stages} />
                      <Deadline iso={app.deadline} />
                      {app.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {app.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      비어 있음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddJobModal
          initialUrl={addUrl}
          onClose={() => {
            setShowAdd(false);
            setAddUrl(undefined);
          }}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'red';
}) {
  const color =
    tone === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'red'
        ? 'text-red-600 dark:text-red-400'
        : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function InsightsPanel({ data }: { data: DashboardInsights }) {
  const pct = (r: number | null) => (r === null ? null : Math.round(r * 100));
  const offer = pct(data.offerRate);
  // 합격·불합격이 기록된(결정분이 있는) 전형만, 등장 빈도순 상위 6개
  const stageRows = data.stages.filter((s) => s.passRate !== null).slice(0, 6);

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        인사이트
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col justify-center sm:border-r sm:border-border sm:pr-6">
          <div className="text-xs text-muted-foreground">합격률</div>
          {offer === null ? (
            <div className="mt-1 text-sm text-muted-foreground">
              아직 결론 난 지원이 없어요
            </div>
          ) : (
            <>
              <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {offer}%
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                결론 {data.decided}건 중 {data.offer}건 합격
              </div>
            </>
          )}
        </div>
        <div>
          <div className="mb-2 text-xs text-muted-foreground">전형별 통과율</div>
          {stageRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              합격·불합격이 기록된 전형이 아직 없어요
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {stageRows.map((s) => {
                const p = pct(s.passRate) ?? 0;
                return (
                  <div key={s.name} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate" title={s.name}>
                      {s.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${p}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
                      {p}% · {s.passed}/{s.passed + s.failed}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
