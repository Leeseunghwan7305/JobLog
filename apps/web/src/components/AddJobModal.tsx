'use client';

import type { ParsedPosting, ParseResponse } from '@joblog/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';

type Step = 'input' | 'manual' | 'draft';
type AnalyzeMode = 'url' | 'text';

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export default function AddJobModal({
  onClose,
  initialUrl,
}: {
  onClose: () => void;
  initialUrl?: string;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [rawText, setRawText] = useState('');
  const [notice, setNotice] = useState<string | undefined>();
  const [draft, setDraft] = useState<ParsedPosting | null>(null);
  const [jobUrl, setJobUrl] = useState('');
  const [mode, setMode] = useState<AnalyzeMode>('url');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const parse = useMutation({
    mutationFn: (body: { url?: string; rawText?: string }) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      return apiFetch<ParseResponse>('/applications/parse', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    },
    onSuccess: (res, body) => {
      setNotice(res.notice);
      setJobUrl(body.url ?? jobUrl);
      if (res.needsManualInput) {
        setStep('manual');
      } else {
        setDraft(res.draft);
        setStep('draft');
      }
    },
  });

  const save = useMutation({
    mutationFn: (d: ParsedPosting) => {
      // 빈 전형명은 제외하고 순서 재부여 (빈 칩 생성 방지)
      const stages = d.stages
        .map((s) => s.name.trim())
        .filter((name) => name.length > 0)
        .map((name, i) => ({ name, order: i }));
      return apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: d.companyName.trim(),
          position: d.position.trim(),
          jobUrl: jobUrl || undefined,
          location: d.location ?? undefined,
          employmentType: d.employmentType ?? undefined,
          deadline: d.deadline ?? undefined,
          stages,
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['apps'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
  });

  const analyze = (body: { url?: string; rawText?: string }) => {
    setMode(body.rawText ? 'text' : 'url');
    parse.mutate(body);
  };

  const cancelAnalyze = () => {
    abortRef.current?.abort();
    parse.reset();
  };

  // 분석 중이 아닐 때만 모달을 닫을 수 있다 (실수로 긴 분석을 날리지 않게)
  const closable = !parse.isPending;
  const tryClose = () => {
    if (closable) onClose();
  };

  // 모달이 입력 단계일 때 URL 입력창에 자동 포커스
  useEffect(() => {
    if (step === 'input' && !parse.isPending) urlInputRef.current?.focus();
  }, [step, parse.isPending]);

  // Esc로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [closable, onClose]);

  // 로그인 후 이어진 흐름: 저장해둔 URL로 분석 자동 시작 (1회만)
  const autoRan = useRef(false);
  useEffect(() => {
    if (initialUrl && !autoRan.current) {
      autoRan.current = true;
      analyze({ url: initialUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (patch: Partial<ParsedPosting>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const showError = (parse.isError && !isAbort(parse.error)) || save.isError;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm duration-200 animate-in fade-in"
      onClick={tryClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-black/5 duration-200 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">공고 추가</h2>
          <button
            onClick={tryClose}
            disabled={!closable}
            aria-label="닫기"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {parse.isPending ? (
          <AnalyzingView mode={mode} onCancel={cancelAnalyze} />
        ) : (
          <>
            {step === 'input' && (
              <div className="flex flex-col gap-3 duration-200 animate-in fade-in">
                <p className="text-sm text-muted-foreground">
                  채용 공고 링크를 붙여넣으면 회사·직무·전형을 자동으로 정리해
                  드려요.
                </p>
                <input
                  ref={urlInputRef}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url) analyze({ url });
                  }}
                  placeholder="https://..."
                  className="rounded-lg border border-input px-3 py-2.5 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <PrimaryButton
                  disabled={!url}
                  onClick={() => {
                    analyze({ url });
                  }}
                >
                  분석
                </PrimaryButton>
                <button
                  onClick={() => {
                    setStep('manual');
                  }}
                  className="mx-auto text-sm text-muted-foreground transition hover:text-foreground"
                >
                  링크 대신 내용을 직접 붙여넣을래요
                </button>
              </div>
            )}

            {step === 'manual' && (
              <div className="flex flex-col gap-3 duration-200 animate-in fade-in">
                {notice && <Notice>{notice}</Notice>}
                <p className="text-sm text-muted-foreground">
                  공고 전문을 붙여넣으면 AI가 똑같이 정리해 드려요.
                </p>
                <textarea
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                  }}
                  rows={8}
                  placeholder="채용 공고 내용을 여기에 붙여넣으세요…"
                  className="rounded-lg border border-input px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <PrimaryButton
                  disabled={!rawText}
                  onClick={() => {
                    analyze({ rawText });
                  }}
                >
                  분석
                </PrimaryButton>
              </div>
            )}

            {step === 'draft' && draft && (
              <div className="flex flex-col gap-3 duration-200 animate-in fade-in">
                {notice ? (
                  <Notice>{notice}</Notice>
                ) : (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    분석 완료! 내용을 확인하고 저장하세요.
                  </p>
                )}
                <Field
                  label="회사명"
                  value={draft.companyName}
                  onChange={(v) => {
                    updateDraft({ companyName: v });
                  }}
                />
                <Field
                  label="직무"
                  value={draft.position}
                  onChange={(v) => {
                    updateDraft({ position: v });
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="근무지"
                    value={draft.location ?? ''}
                    onChange={(v) => {
                      updateDraft({ location: v || null });
                    }}
                    placeholder="예: 서울 강남구"
                  />
                  <Field
                    label="고용형태"
                    value={draft.employmentType ?? ''}
                    onChange={(v) => {
                      updateDraft({ employmentType: v || null });
                    }}
                    placeholder="예: 정규직"
                  />
                </div>
                <Field
                  label="마감일"
                  value={draft.deadline ?? ''}
                  onChange={(v) => {
                    updateDraft({ deadline: v || null });
                  }}
                  placeholder="YYYY-MM-DD"
                />

                <div>
                  <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                    전형 단계
                  </div>
                  <div className="flex flex-col gap-2">
                    {draft.stages.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                        <input
                          value={s.name}
                          onChange={(e) => {
                            const stages = [...draft.stages];
                            stages[i] = { ...stages[i], name: e.target.value };
                            updateDraft({ stages });
                          }}
                          placeholder="예: 서류, 코딩테스트, 1차 면접"
                          className="flex-1 rounded-lg border border-input px-3 py-1.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                        />
                        <button
                          onClick={() => {
                            updateDraft({
                              stages: draft.stages.filter((_, j) => j !== i),
                            });
                          }}
                          aria-label={`${i + 1}번째 단계 삭제`}
                          className="grid h-7 w-7 flex-none place-items-center rounded-md text-muted-foreground transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      updateDraft({
                        stages: [
                          ...draft.stages,
                          { name: '', order: draft.stages.length },
                        ],
                      });
                    }}
                    className="mt-2 text-sm font-medium text-primary transition hover:text-primary/80"
                  >
                    + 단계 추가
                  </button>
                </div>

                <PrimaryButton
                  disabled={
                    !draft.companyName || !draft.position || save.isPending
                  }
                  onClick={() => {
                    save.mutate(draft);
                  }}
                >
                  {save.isPending ? '저장 중…' : '저장'}
                </PrimaryButton>
              </div>
            )}

            {showError && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
                <p className="font-medium">분석에 실패했어요.</p>
                <p className="mt-0.5 text-red-500/90 dark:text-red-400/90">
                  잠시 후 다시 시도하거나, 공고 내용을 직접 붙여넣어 주세요.
                </p>
                <div className="mt-2 flex gap-3">
                  <button
                    onClick={() => {
                      parse.reset();
                      save.reset();
                    }}
                    className="font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    다시 시도
                  </button>
                  <button
                    onClick={() => {
                      parse.reset();
                      setStep('manual');
                    }}
                    className="font-semibold text-muted-foreground hover:underline"
                  >
                    직접 입력
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────── 분석 진행 스테퍼 (JobLog 아이콘의 타임라인 모티프) ───────────────── */

const URL_STEPS = [
  { key: 'fetch', label: '공고 내용 가져오는 중', at: 0 },
  { key: 'read', label: 'AI가 회사·직무·전형 읽는 중', at: 4 },
  { key: 'organize', label: '전형 단계 정리하는 중', at: 18 },
];
const TEXT_STEPS = [
  { key: 'read', label: 'AI가 회사·직무·전형 읽는 중', at: 0 },
  { key: 'organize', label: '전형 단계 정리하는 중', at: 14 },
];

function AnalyzingView({
  mode,
  onCancel,
}: {
  mode: AnalyzeMode;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, []);

  const steps = mode === 'url' ? URL_STEPS : TEXT_STEPS;
  let active = 0;
  steps.forEach((s, i) => {
    if (elapsed >= s.at) active = i;
  });

  return (
    <div className="flex flex-col items-center gap-6 py-4 duration-200 animate-in fade-in">
      <div className="text-center">
        <h3 className="text-base font-bold">공고를 분석하고 있어요</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {elapsed < 30 ? '보통 30초 안에 끝나요' : '거의 다 됐어요…'}
        </p>
      </div>

      <ol className="w-full max-w-xs">
        {steps.map((s, i) => {
          const state: 'done' | 'active' | 'pending' =
            i < active ? 'done' : i === active ? 'active' : 'pending';
          const isLast = i === steps.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-7 h-[calc(100%-1rem)] w-0.5 transition-colors duration-500 ${
                    i < active ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              <span className="relative z-10 flex-none">
                {state === 'done' ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
                    <CheckIcon />
                  </span>
                ) : state === 'active' ? (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary ring-4 ring-ring/15">
                    <span className="h-2 w-2 rounded-full bg-card motion-safe:animate-pulse" />
                  </span>
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-border bg-card" />
                )}
              </span>
              <span
                className={`pt-0.5 text-sm ${
                  state === 'pending'
                    ? 'text-muted-foreground'
                    : state === 'active'
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground">
          {elapsed}초 경과
        </span>
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          취소
        </button>
      </div>
    </div>
  );
}

/* ───────────────── 작은 UI 조각 ───────────────── */

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      {children}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className="rounded-lg border border-input px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </label>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
