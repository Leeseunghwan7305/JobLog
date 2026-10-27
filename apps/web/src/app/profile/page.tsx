'use client';

import type { ProfileStatus } from '@joblog/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import ThemeToggle from '@/components/ThemeToggle';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export default function ProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<ProfileStatus>('/profile'),
    enabled: ready,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/profile/resume`, {
        method: 'POST',
        headers: { authorization: `Bearer ${getToken() ?? ''}` },
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? '업로드에 실패했어요.');
      }
      return (await res.json()) as ProfileStatus;
    },
    onSuccess: (data) => {
      setError(null);
      qc.setQueryData(['profile'], data);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : '업로드에 실패했어요.');
    },
  });

  const remove = useMutation({
    mutationFn: () =>
      apiFetch<ProfileStatus>('/profile/resume', { method: 'DELETE' }),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data);
    },
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

      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">이력서</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        이력서(PDF)를 올려두면, 각 공고에서 “핏 분석”으로 내 기술스택·경험이
        얼마나 맞는지, 무엇을 준비하면 좋을지 추천받을 수 있어요. 텍스트만
        추출해 저장하며 파일 원본은 보관하지 않아요.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        {data?.hasResume ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="font-semibold">{data.resumeFilename}</div>
              {data.resumeUpdatedAt && (
                <div className="text-xs text-muted-foreground">
                  업데이트 {data.resumeUpdatedAt.slice(0, 10)}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                disabled={upload.isPending}
                onClick={() => {
                  fileRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {upload.isPending && <Spinner className="h-3.5 w-3.5" />}
                다른 파일로 교체
              </button>
              <button
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate();
                }}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground transition hover:text-red-500 disabled:opacity-60"
              >
                삭제
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              아직 올린 이력서가 없어요.
            </p>
            <button
              disabled={upload.isPending}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {upload.isPending && <Spinner className="h-3.5 w-3.5" />}
              PDF 이력서 올리기
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = '';
          }}
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      <h1 className="mt-10 text-2xl font-extrabold tracking-tight">집 위치</h1>
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
