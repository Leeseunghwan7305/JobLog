'use client';

import type {
  ApplicationDto,
  DashboardInsights,
  DashboardStats,
  ParsedPosting,
  ParseResponse,
  StageDto,
  UserDto,
} from '@joblog/types';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import AddJobModal from '@/components/AddJobModal';
import LoginModal from '@/components/LoginModal';
import ShareCard from '@/components/ShareCard';
import ThemeToggle from '@/components/ThemeToggle';
import { useToast } from '@/components/Toast';
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
  currentStage,
  currentStageLabel,
  STAGE_STATUS_CLASS,
  STAGE_STATUS_LABEL,
} from '@/lib/stage';

export default function Home() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  useEffect(() => {
    // 크롬 익스텐션(?addUrl=)에서 넘어온 공고 URL → 기존 pendingUrl 흐름으로 연결
    // (로그인 상태면 Dashboard가 자동으로 분석 모달을 연다).
    const addUrl = new URLSearchParams(window.location.search).get('addUrl');
    if (addUrl) {
      setPendingUrl(addUrl);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setHasToken(!!getToken());
  }, []);

  if (hasToken === null) return null; // SSR/하이드레이션 전
  return hasToken ? <Dashboard /> : <Landing />;
}

/* ───────────────── 로그아웃 랜딩: URL 입력 → 로그인 유도 ───────────────── */

function Landing() {
  const [url, setUrl] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);

  // 비로그인 체험 분석: 로그인 전에 결과를 먼저 보여준다(저장은 로그인 후).
  const preview = useMutation({
    mutationFn: (u: string) =>
      apiFetch<ParseResponse>('/parse/preview', {
        method: 'POST',
        body: JSON.stringify({ url: u }),
      }),
    onSuccess: (res) => {
      setResult(res);
    },
  });

  const analyze = () => {
    const v = url.trim();
    if (!v || preview.isPending) return;
    setResult(null);
    preview.mutate(v);
  };

  // 저장: 분석했던 URL을 보존 → 로그인 복귀 후 자동 분석·저장(기존 흐름 재사용).
  const saveWithLogin = () => {
    setPendingUrl(url.trim());
    setShowLogin(true);
  };

  const reset = () => {
    setResult(null);
    preview.reset();
  };

  const raw = preview.error?.message ?? '';
  const errorText =
    raw && raw !== 'unauthorized' && !/^API \d+$/.test(raw)
      ? raw
      : '분석에 실패했어요. 잠시 후 다시 시도해 주세요.';

  const inputRef = useRef<HTMLInputElement>(null);
  const goAnalyze = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 400);
  };

  return (
    <main className="relative overflow-x-hidden">
      {/* ───── 히어로 ───── */}
      <section className="relative px-6 pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -left-24 top-4 h-72 w-72 rounded-full bg-primary/25 blur-3xl motion-safe:animate-[float-slow_9s_ease-in-out_infinite]" />
          <div className="absolute -right-16 top-28 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl motion-safe:animate-[float-slow_11s_ease-in-out_infinite]" />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30 duration-500 animate-in fade-in zoom-in-95">
            J
          </div>
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground duration-500 animate-in fade-in">
            🇰🇷 한국 취준생을 위한 구직 트래커
          </span>
          <h1 className="text-balance text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            공고 링크 붙여넣기 한 번,
            <br />
            <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
              AI가 전형까지 정리
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-muted-foreground">
            회사·직무·전형 단계를 자동으로 뽑아내고, 서류부터 최종까지 상태를
            추적해요.
            <br />
            <span className="text-sm">
              로그인 없이 바로 분석 — 저장은 가입 후에.
            </span>
          </p>

          <div className="mx-auto mt-8 flex max-w-lg gap-2">
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') analyze();
              }}
              disabled={preview.isPending}
              placeholder="채용 공고 링크를 붙여넣으세요"
              className="flex-1 rounded-lg border border-input bg-background px-4 py-3 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
            />
            <button
              onClick={analyze}
              disabled={!url.trim() || preview.isPending}
              className="shrink-0 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {preview.isPending ? '분석 중…' : '분석'}
            </button>
          </div>

          {preview.isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground duration-200 animate-in fade-in">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
              AI가 공고를 읽고 있어요…
            </div>
          )}

          {preview.isError && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {errorText}
            </div>
          )}

          {result &&
            (result.needsManualInput ? (
              <ManualFallbackCard
                notice={result.notice}
                onSave={saveWithLogin}
                onReset={reset}
              />
            ) : (
              <PreviewCard
                draft={result.draft}
                notice={result.notice}
                onSave={saveWithLogin}
                onReset={reset}
              />
            ))}

          {!result && !preview.isPending && (
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
          )}
        </div>
      </section>

      {/* ───── 왜 JobLog ───── */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal className="text-center">
            <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              엑셀로 관리하기엔, 너무 번거롭잖아요
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              붙여넣기 한 번이면 끝. 한국 채용 사이트에 맞춘 AI가 정리하고,
              회사 정보까지 함께 보여줍니다.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <FeatureCard {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 작동 방식 ───── */}
      <section className="bg-secondary/40 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              3단계면 충분해요
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <StepItem index={i + 1} title={s.title} desc={s.desc} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───── 칸반 미리보기 ───── */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              서류부터 최종까지, 한눈에
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-10">
              <KanbanMock />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───── 크롬 익스텐션 ───── */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
              <div className="flex flex-col items-center gap-10 text-center sm:flex-row sm:text-left">
                <div className="flex-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                    🧩 크롬 익스텐션 · 곧 출시
                  </span>
                  <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                    공고 보다가, 클릭 한 번으로 담기
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    원티드·잡코리아·사람인에서 공고를 보던 그 화면에서, 익스텐션
                    버튼만 누르면 복사·붙여넣기 없이 바로 JobLog에 담겨요.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <button
                      disabled
                      className="cursor-not-allowed rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground opacity-60"
                    >
                      🧩 크롬에 추가 (준비 중)
                    </button>
                    <button
                      onClick={goAnalyze}
                      className="rounded-xl border border-border px-5 py-3 font-semibold text-foreground transition hover:border-ring"
                    >
                      지금은 링크로 분석하기 →
                    </button>
                  </div>
                </div>
                {/* 미니 목업: 브라우저 창 + 플로팅 담기 버튼 */}
                <div
                  aria-hidden="true"
                  className="w-full max-w-xs shrink-0 overflow-hidden rounded-xl border border-border bg-background shadow-card"
                >
                  <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                    <span className="ml-2 truncate rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                      wanted.co.kr/wd/12345
                    </span>
                  </div>
                  <div className="relative space-y-2 p-4">
                    <div className="h-2.5 w-2/3 rounded bg-muted" />
                    <div className="h-2 w-full rounded bg-muted/70" />
                    <div className="h-2 w-5/6 rounded bg-muted/70" />
                    <div className="h-2 w-4/6 rounded bg-muted/70" />
                    <div className="pt-6" />
                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30 motion-safe:animate-[float-slow_4s_ease-in-out_infinite]">
                      ＋ JobLog에 담기
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───── 마지막 CTA ───── */}
      <section className="px-6 pb-24 pt-6 text-center">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            지금 공고 하나로 시작해 보세요
          </h2>
          <p className="mt-3 text-muted-foreground">
            로그인 없이 바로 분석 · 저장은 카카오로 3초면 끝나요.
          </p>
          <button
            onClick={goAnalyze}
            className="mt-6 rounded-xl bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 motion-safe:hover:-translate-y-0.5"
          >
            공고 분석하러 가기 ↑
          </button>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        JobLog · 지원 현황 추적 서비스
      </footer>

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

/* ───────────────── 랜딩 섹션 조각 ───────────────── */

const FEATURES = [
  {
    icon: '🤖',
    title: '한국형 AI 파싱',
    desc: '원티드·잡코리아·사람인 링크를 붙여넣으면 회사·직무·전형을 자동으로 정리해요.',
  },
  {
    icon: '🗂️',
    title: '전형 추적',
    desc: '서류부터 최종까지 칸반으로. 카드에서 1클릭 합격/탈락, 실수하면 되돌리기.',
  },
  {
    icon: '🏢',
    title: '회사 정보',
    desc: '잡플래닛 평점·국민연금 기반 직원수까지, 지원 전에 한눈에.',
  },
  {
    icon: '⏰',
    title: '마감 관리',
    desc: 'D-day·캘린더로 마감과 면접 일정을 놓치지 않게.',
  },
];

const STEPS = [
  { title: '공고 링크 붙여넣기', desc: '채용 공고 URL만 복사해서 붙여넣으세요.' },
  {
    title: 'AI가 자동 정리',
    desc: '회사·직무·전형 단계·마감일을 알아서 추출해요.',
  },
  { title: '전형까지 추적', desc: '서류부터 최종까지 상태를 한 곳에서 관리해요.' },
];

/** 스크롤 진입 시 아래에서 위로 페이드인. 모션 최소화 설정이면 즉시 표시. */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, []);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}
    >
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-5 text-left shadow-card transition duration-300 hover:border-ring hover:shadow-card-hover motion-safe:hover:-translate-y-1">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-2xl">
        {icon}
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  );
}

function StepItem({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground shadow-md shadow-primary/25">
        {index}
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

type MockTone = 'amber' | 'emerald' | 'red';

/** 칸반 미리보기(정적 목업) — 로그인 전 서비스 느낌을 보여준다. */
function KanbanMock() {
  const cols: {
    label: string;
    items: { c: string; p: string; tone: MockTone }[];
  }[] = [
    {
      label: '진행중',
      items: [
        { c: '토스', p: '프론트엔드', tone: 'amber' },
        { c: '네이버', p: '백엔드', tone: 'amber' },
      ],
    },
    { label: '최종합격', items: [{ c: '카카오', p: '서버', tone: 'emerald' }] },
    { label: '불합격', items: [{ c: '쿠팡', p: 'iOS', tone: 'red' }] },
    { label: '철회', items: [] },
  ];
  const toneClass: Record<MockTone, string> = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    emerald:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cols.map((col) => (
          <div key={col.label}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {col.label}
            </div>
            <div className="flex flex-col gap-2">
              {col.items.map((it) => (
                <div
                  key={it.c}
                  className="rounded-lg border border-border bg-background p-2.5"
                >
                  <div className="text-sm font-bold">{it.c}</div>
                  <div className="text-xs text-muted-foreground">{it.p}</div>
                  <span
                    className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneClass[it.tone]}`}
                  >
                    {col.label}
                  </span>
                </div>
              ))}
              {col.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">
                  비어 있음
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 체험 분석 결과 미리보기 (읽기 전용). 로그인하면 저장 가능. */
/** 파싱 신뢰도 배지. low면 "확인 필요"로 보정을 유도한다(confidence는 서버가 내려줌). */
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'low' }) {
  if (confidence === 'low') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        ⚠ 신뢰도 낮음 · 확인 필요
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      ✓ 신뢰도 높음
    </span>
  );
}

function PreviewCard({
  draft,
  notice,
  onSave,
  onReset,
}: {
  draft: ParsedPosting;
  notice?: string;
  onSave: () => void;
  onReset: () => void;
}) {
  const hasMeta =
    draft.location != null ||
    draft.employmentType != null ||
    draft.deadline != null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left shadow-card duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary">
          ✨ AI가 이렇게 정리했어요
        </span>
        <ConfidenceBadge confidence={draft.confidence} />
      </div>
      <div className="text-lg font-bold">
        {draft.companyName || '회사명 미정'}
      </div>
      <div className="text-sm text-muted-foreground">
        {draft.position || '직무 미정'}
      </div>
      {hasMeta && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {draft.location && <span>📍 {draft.location}</span>}
          {draft.employmentType && <span>💼 {draft.employmentType}</span>}
          {draft.deadline && <span>🗓 ~{draft.deadline}</span>}
        </div>
      )}
      {draft.stages.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            전형 단계
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.stages.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/60">→</span>}
                <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                  {s.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
      {notice ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {notice}
        </p>
      ) : (
        draft.confidence === 'low' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            일부 항목을 확실히 추출하지 못했어요. 저장 후 회사·직무·전형을 한 번 확인해
            주세요.
          </p>
        )
      )}
      <button
        onClick={onSave}
        className="mt-5 w-full rounded-lg bg-[#FEE500] px-6 py-3 font-semibold text-[#191600] transition hover:brightness-95"
      >
        카카오로 로그인하고 저장하기
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        로그인하면 이 공고가 저장되고 전형별 상태를 추적할 수 있어요
      </p>
      <button
        onClick={onReset}
        className="mx-auto mt-2 block text-sm text-muted-foreground hover:text-foreground"
      >
        다른 공고 분석하기
      </button>
    </div>
  );
}

/** 링크 수집 실패 시 폴백 카드 — 로그인 후 본문 붙여넣기로 이어진다. */
function ManualFallbackCard({
  notice,
  onSave,
  onReset,
}: {
  notice: string | undefined;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-left shadow-card duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-1 text-sm font-semibold">공고를 자동으로 못 읽었어요</div>
      <p className="text-sm text-muted-foreground">
        {notice ??
          '링크에서 내용을 가져오지 못했어요. 로그인하고 공고 내용을 직접 붙여넣어 분석할 수 있어요.'}
      </p>
      <button
        onClick={onSave}
        className="mt-4 w-full rounded-lg bg-[#FEE500] px-6 py-3 font-semibold text-[#191600] transition hover:brightness-95"
      >
        카카오로 로그인하고 직접 입력하기
      </button>
      <button
        onClick={onReset}
        className="mx-auto mt-2 block text-sm text-muted-foreground hover:text-foreground"
      >
        다른 링크로 시도
      </button>
    </div>
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

/**
 * 대시보드 카드. 전체는 상세 페이지로 가는 stretched link(절대위치)로 덮고,
 * 진행중 공고에 한해 '현재 전형'을 카드에서 바로 합격/탈락 처리하는 퀵 액션을 얹는다.
 * 합격 시 다음 대기 전형을 자동으로 '진행중'으로 승급해 바로 이어서 추적할 수 있다.
 */
function AppCard({ app }: { app: ApplicationDto }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const cur = currentStage(app);
  const actionable = app.status === 'IN_PROGRESS' && cur !== null;

  // 모르고 합격/탈락을 눌렀을 때 되돌릴 '결정적 단계'
  // (탈락 → 그 FAILED 단계 / 최종합격 → 마지막 PASSED 단계)를 진행중으로 복구한다.
  const decisiveStage =
    app.status === 'REJECTED'
      ? app.stages.find((s) => s.status === 'FAILED')
      : app.status === 'OFFER'
        ? [...app.stages]
            .sort((a, b) => b.order - a.order)
            .find((s) => s.status === 'PASSED')
        : undefined;

  // 서버의 단일 액션(progress)에 위임 — 전체 파이프라인을 일관되게 세팅.
  const act = useMutation({
    mutationFn: (v: {
      stageId: string;
      mode: 'passed' | 'failed' | 'current';
    }) =>
      apiFetch(`/applications/${app.id}/stages/${v.stageId}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ mode: v.mode }),
      }),
    onSuccess: async (_data, v) => {
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      const name = app.stages.find((s) => s.id === v.stageId)?.name ?? '전형';
      if (v.mode === 'current') {
        show(`‘${name}’ 단계로 되돌렸어요`, 'success');
        return;
      }
      // 돌아올 보상: 상태를 반영한 '지금까지 합격률' 한 줄. 갱신된 인사이트를
      // 바로 받아 붙인다(동시에 상단 인사이트 패널도 최신화). 실패하면 조용히 생략.
      let reward = '';
      try {
        const ins = await apiFetch<DashboardInsights>('/dashboard/insights');
        qc.setQueryData(['insights'], ins); // 상단 인사이트 패널도 최신화
        if (ins.offerRate !== null && ins.decided > 0) {
          reward = ` · 지금까지 합격률 ${Math.round(ins.offerRate * 100)}%`;
        }
      } catch {
        // 보상 한 줄은 부가 정보 — 실패해도 핵심 토스트는 띄운다.
      }
      const base =
        v.mode === 'passed'
          ? `‘${name}’ 합격 처리했어요`
          : `‘${name}’ 탈락 처리했어요`;
      show(base + reward, v.mode === 'failed' ? 'info' : 'success');
    },
    onError: () => {
      show('처리에 실패했어요. 잠시 후 다시 시도해 주세요.', 'error');
    },
  });

  return (
    <div className="relative rounded-xl border border-border bg-card p-3 shadow-card transition duration-300 animate-in fade-in slide-in-from-bottom-1 hover:border-ring hover:shadow-card-hover">
      <Link
        href={`/applications/${app.id}`}
        aria-label={`${app.companyName} 상세 보기`}
        className="absolute inset-0 rounded-xl"
      />
      <div className="flex items-center gap-1.5 font-bold">
        <span>{app.companyName}</span>
        {app.employeeCount ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {app.employeeCount.toLocaleString()}명
          </span>
        ) : null}
      </div>
      <div className="text-sm text-muted-foreground">{app.position}</div>
      <span
        className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${pillClass(app.status)}`}
      >
        {currentStageLabel(app)}
      </span>
      <StageTrack stages={app.stages} />
      <Deadline iso={app.deadline} />
      {actionable && (
        <div className="relative z-10 mt-2.5 flex gap-1.5">
          <button
            onClick={() => {
              act.mutate({ stageId: cur.id, mode: 'passed' });
            }}
            disabled={act.isPending}
            title={`${cur.name} 합격 처리`}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            ✓ 합격
          </button>
          <button
            onClick={() => {
              act.mutate({ stageId: cur.id, mode: 'failed' });
            }}
            disabled={act.isPending}
            title={`${cur.name} 탈락 처리`}
            className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            ✕ 탈락
          </button>
        </div>
      )}
      {decisiveStage && (
        <div className="relative z-10 mt-2.5 flex items-center gap-2">
          <button
            onClick={() => {
              act.mutate({ stageId: decisiveStage.id, mode: 'current' });
            }}
            disabled={act.isPending}
            title={`${decisiveStage.name} 단계로 되돌리기`}
            className="rounded-md border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            ↩ 되돌리기
          </button>
          <span className="text-[11px] text-muted-foreground">
            잘못 눌렀나요?
          </span>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState<string | undefined>(undefined);
  const [addRawText, setAddRawText] = useState<string | undefined>(undefined);

  // 크롬 익스텐션 캡처(본문+URL) 또는 로그인 유도 흐름의 URL이 있으면 분석 모달 자동 오픈
  useEffect(() => {
    try {
      const raw = localStorage.getItem('joblog_ext_capture');
      if (raw) {
        localStorage.removeItem('joblog_ext_capture');
        const cap = JSON.parse(raw) as { url?: string; text?: string };
        if (cap.text || cap.url) {
          setAddUrl(cap.url);
          setAddRawText(cap.text);
          setShowAdd(true);
          return;
        }
      }
    } catch {
      /* 손상된 캡처는 무시 */
    }
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

  const apps = useQuery({
    queryKey: ['apps', debouncedQ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set('q', debouncedQ);
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
    setAddRawText(undefined);
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
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-primary"
          >
            마이페이지
          </Link>
          <Link
            href="/calendar"
            className="text-muted-foreground hover:text-primary"
          >
            캘린더
          </Link>
          {me.data?.isAdmin && (
            <Link
              href="/admin"
              className="font-semibold text-primary hover:underline"
            >
              어드민
            </Link>
          )}
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
          {(stats.data?.total ?? 0) > 0 && stats.data && (
            <ShareCard
              stats={stats.data}
              offerRate={insights.data?.offerRate ?? null}
            />
          )}
          <button
            onClick={openAdd}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            + 공고 추가
          </button>
        </div>
      </div>

      {!debouncedQ &&
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
                    className="rounded-xl border border-border bg-card p-3 shadow-card"
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
        debouncedQ ? (
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
                    <AppCard key={app.id} app={app} />
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
          initialRawText={addRawText}
          onClose={() => {
            setShowAdd(false);
            setAddUrl(undefined);
            setAddRawText(undefined);
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
    <div className="rounded-xl border border-border bg-card px-4 py-2 shadow-card">
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
    <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-card">
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
