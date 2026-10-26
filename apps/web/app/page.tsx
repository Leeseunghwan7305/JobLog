'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';
import { currentStageLabel } from '@/lib/stage';
import type { ApplicationDto, DashboardStats, UserDto } from '@joblog/types';
import AddJobModal from '@/components/AddJobModal';

const COLUMNS = [
  { key: 'IN_PROGRESS', label: '진행중' },
  { key: 'OFFER', label: '최종합격' },
  { key: 'REJECTED', label: '불합격' },
  { key: 'CLOSED', label: '철회' },
] as const;

function pillClass(status: ApplicationDto['status']): string {
  switch (status) {
    case 'OFFER':
      return 'bg-emerald-100 text-emerald-700';
    case 'REJECTED':
      return 'bg-red-100 text-red-700';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-500';
    default:
      return 'bg-amber-100 text-amber-700';
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserDto>('/auth/me'),
    enabled: ready,
  });
  const apps = useQuery({
    queryKey: ['apps'],
    queryFn: () => apiFetch<ApplicationDto[]>('/applications'),
    enabled: ready,
  });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<DashboardStats>('/dashboard/stats'),
    enabled: ready,
  });

  if (!ready) return null;

  const grouped = (status: string) =>
    (apps.data ?? []).filter((a) => a.status === status);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand font-bold text-white">
            J
          </span>
          <span className="text-lg font-bold tracking-tight">JobLog</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {me.data && (
            <span className="text-slate-500">{me.data.nickname}님</span>
          )}
          <button
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
            className="text-slate-400 hover:text-slate-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-3">
          <Stat label="전체" value={stats.data?.total ?? 0} />
          <Stat label="진행중" value={stats.data?.inProgress ?? 0} />
          <Stat label="합격" value={stats.data?.offer ?? 0} tone="emerald" />
          <Stat label="불합격" value={stats.data?.rejected ?? 0} tone="red" />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand-ink"
        >
          + 공고 추가
        </button>
      </div>

      {apps.isLoading ? (
        <p className="text-slate-400">불러오는 중…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = grouped(col.key);
            return (
              <div key={col.key}>
                <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>{col.label}</span>
                  <span className="text-slate-400">{items.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-3 transition hover:border-brand"
                    >
                      <div className="font-bold">{app.companyName}</div>
                      <div className="mb-2 text-sm text-slate-500">
                        {app.position}
                      </div>
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${pillClass(app.status)}`}
                      >
                        {currentStageLabel(app)}
                      </span>
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                      비어 있음
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} />}
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
      ? 'text-emerald-600'
      : tone === 'red'
        ? 'text-red-600'
        : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
