'use client';

import type { ProfileStatus } from '@joblog/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import ThemeToggle from '@/components/ThemeToggle';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function ProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/');
    else setReady(true);
  }, [router]);

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<ProfileStatus>('/profile'),
    enabled: ready,
  });

  const [homeInput, setHomeInput] = useState('');
  const [homeError, setHomeError] = useState<string | null>(null);
  const saveHome = useMutation({
    mutationFn: (address: string) =>
      apiFetch<ProfileStatus>('/profile/home', {
        method: 'PATCH',
        body: JSON.stringify({ address }),
      }),
    onSuccess: (data) => {
      setHomeError(null);
      setHomeInput('');
      qc.setQueryData(['profile'], data);
      void qc.invalidateQueries({ queryKey: ['commute'] });
    },
    onError: (e: unknown) => {
      setHomeError(e instanceof Error ? e.message : '주소를 저장하지 못했어요.');
    },
  });

  if (!ready) return null;

  const data = profile.data;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 대시보드
        </Link>
        <ThemeToggle />
      </div>

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">집 위치</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        집 주소를 저장해두면, 각 공고에서 “집→회사 네이버 길찾기”로 대중교통
        소요시간을 바로 확인할 수 있어요.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        {data?.home ? (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground">현재 집 위치</div>
            <div className="font-semibold">{data.home.address}</div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            아직 저장된 집 위치가 없어요.
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={homeInput}
            onChange={(e) => {
              setHomeInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && homeInput.trim()) {
                saveHome.mutate(homeInput.trim());
              }
            }}
            placeholder="예: 서울 강남구 테헤란로 152"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            disabled={saveHome.isPending || !homeInput.trim()}
            onClick={() => {
              saveHome.mutate(homeInput.trim());
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {saveHome.isPending && <Spinner className="h-3.5 w-3.5" />}
            {data?.home ? '변경' : '저장'}
          </button>
          {data?.home && (
            <button
              disabled={saveHome.isPending}
              onClick={() => {
                saveHome.mutate('');
              }}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-red-500 disabled:opacity-60"
            >
              해제
            </button>
          )}
        </div>
        {homeError && <p className="mt-3 text-sm text-red-500">{homeError}</p>}
      </div>
    </main>
  );
}
