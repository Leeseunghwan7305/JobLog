'use client';

import type {
  GmailScanResult,
  GmailStatus,
  GmailSuggestion,
  ProfileStatus,
} from '@joblog/types';
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

      {ready && <GmailCard />}
    </main>
  );
}

/* ───────────── Gmail 자동 상태감지 ───────────── */

function GmailCard() {
  const qc = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [result, setResult] = useState<GmailScanResult | null>(null);
  // 사용자가 이미 반영/무시한 제안은 목록에서 지운다.
  const [handled, setHandled] = useState<Set<string>>(new Set());

  // 구글 콜백 복귀(?gmail=connected|error) 처리.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('gmail');
    if (p === 'connected') setBanner('Gmail이 연결됐어요. 메일을 스캔해 보세요.');
    else if (p === 'error') setBanner('Gmail 연결에 실패했어요. 다시 시도해 주세요.');
    if (p) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const status = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => apiFetch<GmailStatus>('/integrations/gmail/status'),
  });

  const connect = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>('/integrations/gmail/connect'),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const scan = useMutation({
    mutationFn: () =>
      apiFetch<GmailScanResult>('/integrations/gmail/scan', { method: 'POST' }),
    onSuccess: (res) => {
      setHandled(new Set());
      setResult(res);
    },
  });

  const disconnect = useMutation({
    mutationFn: () =>
      apiFetch('/integrations/gmail/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      setResult(null);
      void qc.invalidateQueries({ queryKey: ['gmail-status'] });
    },
  });

  // 제안을 실제 전형 상태에 반영(기존 progress 엔드포인트 재사용).
  const apply = useMutation({
    mutationFn: (s: GmailSuggestion) =>
      apiFetch(
        `/applications/${s.applicationId}/stages/${s.stageId ?? ''}/progress`,
        { method: 'PATCH', body: JSON.stringify({ mode: s.detected }) },
      ),
    onSuccess: (_d, s) => {
      setHandled((prev) => new Set(prev).add(s.applicationId));
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const connected = status.data?.connected;
  const visible = (result?.suggestions ?? []).filter(
    (s) => !handled.has(s.applicationId),
  );

  return (
    <section className="mt-8">
      <h2 className="text-2xl font-extrabold tracking-tight">Gmail 자동 감지</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        지메일을 연결하면 최근 메일에서 지원한 회사의 <b>합격·불합격</b>을 찾아
        전형 상태 변경을 제안해요. 제목·발신자만 읽고(읽기 전용), 반영 여부는
        직접 고릅니다.
      </p>

      {banner && (
        <div className="mt-4 rounded-lg border border-border bg-primary/5 p-3 text-sm">
          {banner}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-border bg-card p-5">
        {status.isPending ? (
          <Spinner className="h-4 w-4" />
        ) : connected ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">연결된 계정</div>
                <div className="font-semibold">
                  {status.data?.email ?? 'Gmail'}
                </div>
              </div>
              <button
                disabled={scan.isPending}
                onClick={() => {
                  scan.mutate();
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                {scan.isPending && <Spinner className="h-3.5 w-3.5" />}
                메일 스캔
              </button>
              <button
                disabled={disconnect.isPending}
                onClick={() => {
                  disconnect.mutate();
                }}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-red-500 disabled:opacity-60"
              >
                연결 해제
              </button>
            </div>

            {scan.isError && (
              <p className="mt-3 text-sm text-red-500">
                스캔에 실패했어요. 잠시 후 다시 시도해 주세요.
              </p>
            )}

            {result && (
              <div className="mt-4 border-t border-border pt-4">
                {visible.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {result.scanned}개의 메일을 살펴봤어요. 새로 반영할 합격·불합격
                    소식은 없었어요.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {visible.map((s) => (
                      <li
                        key={s.applicationId}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                              s.detected === 'passed'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/15 text-red-600 dark:text-red-400'
                            }`}
                          >
                            {s.detected === 'passed' ? '합격 추정' : '불합격 추정'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{s.companyName}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {s.subject}
                            </div>
                            {s.stageName && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                반영 대상: {s.stageName}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setHandled((prev) =>
                                new Set(prev).add(s.applicationId),
                              );
                            }}
                            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                          >
                            무시
                          </button>
                          <button
                            disabled={!s.stageId || apply.isPending}
                            onClick={() => {
                              apply.mutate(s);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                          >
                            {apply.isPending && <Spinner className="h-3 w-3" />}
                            반영하기
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              아직 Gmail이 연결되어 있지 않아요.
            </p>
            <button
              disabled={connect.isPending}
              onClick={() => {
                connect.mutate();
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {connect.isPending && <Spinner className="h-3.5 w-3.5" />}
              Gmail 연결
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
