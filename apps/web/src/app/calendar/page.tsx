'use client';

import type { CalendarEvent } from '@joblog/types';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import ThemeToggle from '@/components/ThemeToggle';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { STAGE_STATUS_CLASS } from '@/lib/stage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function badgeClass(e: CalendarEvent): string {
  if (e.type === 'deadline')
    return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  if (e.status) return STAGE_STATUS_CLASS[e.status];
  return 'bg-primary/10 text-primary';
}

export default function CalendarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  const monthStart = new Date(cursor.y, cursor.m, 1);
  const monthEnd = new Date(cursor.y, cursor.m + 1, 0);
  const from = new Date(cursor.y, cursor.m, 1, 0, 0, 0).toISOString();
  const to = new Date(cursor.y, cursor.m + 1, 0, 23, 59, 59).toISOString();

  const events = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () =>
      apiFetch<CalendarEvent[]>(
        `/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
    enabled: ready,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events.data ?? []) {
      const key = ymd(new Date(e.date));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events.data]);

  if (!ready) return null;

  const leadingBlanks = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayKey = ymd(new Date());

  const move = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 대시보드
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              move(-1);
            }}
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
            aria-label="이전 달"
          >
            ‹
          </button>
          <h1 className="text-lg font-bold tabular-nums">
            {cursor.y}년 {cursor.m + 1}월
          </h1>
          <button
            onClick={() => {
              move(1);
            }}
            className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`bg-muted py-2 text-center text-xs font-semibold ${
              i === 0
                ? 'text-red-500 dark:text-red-400'
                : i === 6
                  ? 'text-blue-500 dark:text-blue-400'
                  : 'text-muted-foreground'
            }`}
          >
            {w}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null)
            return <div key={`b${i}`} className="min-h-24 bg-muted/50" />;
          const key = ymd(new Date(cursor.y, cursor.m, day));
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={key} className="min-h-24 bg-card p-1.5">
              <div
                className={`mb-1 text-xs font-medium ${
                  isToday
                    ? 'inline-grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {day}
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((e, j) => (
                  <Link
                    key={`${e.applicationId}-${e.type}-${j}`}
                    href={`/applications/${e.applicationId}`}
                    title={`${e.companyName} · ${e.label}`}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${badgeClass(e)}`}
                  >
                    {e.companyName} · {e.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {events.isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">불러오는 중…</p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        <span className="mr-3">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-400" />
          마감
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
          전형 일정
        </span>
      </p>
    </main>
  );
}
