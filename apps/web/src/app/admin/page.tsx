'use client';

import type {
  AdminActivityMetrics,
  AdminApplicationRow,
  AdminDailyPoint,
  AdminOverview,
  AdminPage,
  AdminUserRow,
  AppStatus,
  UserDto,
} from '@joblog/types';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';

import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

const STATUS_LABEL: Record<AppStatus, string> = {
  IN_PROGRESS: '진행중',
  OFFER: '최종합격',
  REJECTED: '불합격',
  CLOSED: '철회',
};
const STATUS_CLASS: Record<AppStatus, string> = {
  IN_PROGRESS: 'text-blue-600 dark:text-blue-400',
  OFFER: 'text-emerald-600 dark:text-emerald-400',
  REJECTED: 'text-red-600 dark:text-red-400',
  CLOSED: 'text-muted-foreground',
};

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');
const PAGE_SIZE = 50;

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const hasToken = ready && !!getToken();

  const [userPage, setUserPage] = useState(1);
  const [appPage, setAppPage] = useState(1);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserDto>('/auth/me'),
    enabled: hasToken,
  });
  const isAdmin = me.data?.isAdmin === true;

  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiFetch<AdminOverview>('/admin/overview'),
    enabled: isAdmin,
  });
  const metrics = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => apiFetch<AdminActivityMetrics>('/admin/metrics'),
    enabled: isAdmin,
  });
  const users = useQuery({
    queryKey: ['admin', 'users', userPage],
    queryFn: () =>
      apiFetch<AdminPage<AdminUserRow>>(
        `/admin/users?page=${userPage}&pageSize=${PAGE_SIZE}`,
      ),
    enabled: isAdmin,
  });
  const applications = useQuery({
    queryKey: ['admin', 'applications', appPage],
    queryFn: () =>
      apiFetch<AdminPage<AdminApplicationRow>>(
        `/admin/applications?page=${appPage}&pageSize=${PAGE_SIZE}`,
      ),
    enabled: isAdmin,
  });

  if (!ready || (hasToken && me.isLoading)) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Skeleton className="h-8 w-40" />
      </main>
    );
  }

  if (!hasToken || (me.data && !isAdmin)) {
    return (
      <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-bold">접근 권한이 없어요</h1>
          <p className="mb-6 text-muted-foreground">
            이 페이지는 관리자만 볼 수 있어요.
          </p>
          <Link href="/" className="text-primary hover:underline">
            ← 대시보드로
          </Link>
        </div>
      </main>
    );
  }

  const ov = overview.data;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary font-bold text-primary-foreground">
            J
          </span>
          <span className="text-lg font-bold tracking-tight">
            JobLog <span className="text-muted-foreground">어드민</span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <ThemeToggle />
          <Link href="/" className="text-muted-foreground hover:text-primary">
            ← 대시보드
          </Link>
        </div>
      </header>

      {/* 전역 통계 */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          전역 통계
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <StatCard label="사용자" value={ov?.users} />
          <StatCard label="지원" value={ov?.applications} />
          <StatCard label="전형 단계" value={ov?.stages} />
          <StatCard label="후기 캐시" value={ov?.reviews} />
          <StatCard label="회사 프로필" value={ov?.profiles} />
        </div>
        {ov && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <StatusPill status="IN_PROGRESS" n={ov.byStatus.inProgress} />
            <StatusPill status="OFFER" n={ov.byStatus.offer} />
            <StatusPill status="REJECTED" n={ov.byStatus.rejected} />
            <StatusPill status="CLOSED" n={ov.byStatus.closed} />
          </div>
        )}
      </section>

      {/* 활동 (DAU/MAU) */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          활동 (최근 30일)
        </h2>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-4 flex gap-8">
            <div>
              <div className="text-3xl font-bold tabular-nums">
                {metrics.data?.dau ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                DAU (오늘 활동 사용자)
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums">
                {metrics.data?.mau ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                MAU (최근 30일 활동 사용자)
              </div>
            </div>
          </div>
          {metrics.data ? (
            <DauChart daily={metrics.data.daily} />
          ) : (
            <Skeleton className="h-28 w-full" />
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            활동 = 접속(인증 요청) 또는 지원 등록·수정·전형 변경. 과거는 기존
            기록으로 추정, 이후는 접속 기준으로 집계돼요.
          </p>
        </div>
      </section>

      {/* 전체 사용자 */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          전체 사용자 {users.data ? `(${users.data.total})` : ''}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <Th>닉네임</Th>
                <Th>kakaoId</Th>
                <Th>이메일</Th>
                <Th>지원</Th>
                <Th>집주소(지역)</Th>
                <Th>가입</Th>
              </tr>
            </thead>
            <tbody>
              {(users.data?.rows ?? []).map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <Td className="font-medium">{u.nickname}</Td>
                  <Td className="font-mono text-xs">{u.kakaoId}</Td>
                  <Td className="text-muted-foreground">{u.email ?? '—'}</Td>
                  <Td className="tabular-nums">{u.applicationCount}</Td>
                  <Td className="text-muted-foreground">
                    {u.homeAddress ?? '—'}
                  </Td>
                  <Td className="font-mono text-xs text-muted-foreground">
                    {fmtDate(u.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={userPage}
          pageSize={PAGE_SIZE}
          total={users.data?.total}
          onPage={setUserPage}
        />
      </section>

      {/* 전체 지원 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          전체 지원 {applications.data ? `(${applications.data.total})` : ''}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <Th>회사</Th>
                <Th>직무</Th>
                <Th>상태</Th>
                <Th>마감</Th>
                <Th>전형</Th>
                <Th>소유자</Th>
                <Th>등록</Th>
              </tr>
            </thead>
            <tbody>
              {(applications.data?.rows ?? []).map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <Td className="font-medium">{a.companyName}</Td>
                  <Td className="text-muted-foreground">{a.position}</Td>
                  <Td>
                    <span className={`font-medium ${STATUS_CLASS[a.status]}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs text-muted-foreground">
                    {fmtDate(a.deadline)}
                  </Td>
                  <Td className="tabular-nums">{a.stageCount}</Td>
                  <Td className="text-muted-foreground">{a.ownerNickname}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">
                    {fmtDate(a.createdAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={appPage}
          pageSize={PAGE_SIZE}
          total={applications.data?.total}
          onPage={setAppPage}
        />
      </section>
    </main>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total?: number;
  onPage: (p: number) => void;
}) {
  const last = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  if (last <= 1) return null;
  const btn =
    'rounded-lg border border-border px-3 py-1.5 text-sm transition hover:border-ring disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-3 flex items-center justify-end gap-3">
      <button
        className={btn}
        disabled={page <= 1}
        onClick={() => {
          onPage(page - 1);
        }}
      >
        이전
      </button>
      <span className="text-sm tabular-nums text-muted-foreground">
        {page} / {last}
      </span>
      <button
        className={btn}
        disabled={page >= last}
        onClick={() => {
          onPage(page + 1);
        }}
      >
        다음
      </button>
    </div>
  );
}

/** 최근 N일 일별 활동 사용자 막대 차트 (직접 SVG, 차트 라이브러리 없음). */
function DauChart({ daily }: { daily: AdminDailyPoint[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  const W = 100;
  const H = 32;
  const n = daily.length;
  const gap = 0.35;
  const bw = n > 0 ? (W - gap * (n - 1)) / n : W;
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-28 w-full"
        role="img"
        aria-label="최근 30일 일별 활동 사용자 수"
      >
        {daily.map((d, i) => {
          const h = (d.count / max) * (H - 1);
          const drawn = d.count > 0 ? Math.max(h, 0.6) : 0;
          return (
            <rect
              key={d.day}
              x={i * (bw + gap)}
              y={H - drawn}
              width={bw}
              height={drawn}
              className={i === n - 1 ? 'fill-primary' : 'fill-primary/40'}
            >
              <title>{`${d.day}: ${d.count}명`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>{daily[daily.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusPill({ status, n }: { status: AppStatus; n: number }) {
  return (
    <span className="rounded-full border border-border bg-card px-3 py-1">
      <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>{' '}
      <span className="font-semibold tabular-nums">{n}</span>
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-2 font-medium">{children}</th>;
}
function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-4 py-2.5 ${className}`}>{children}</td>
  );
}
