'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ParsedPosting, ParseResponse } from '@joblog/types';

type Step = 'input' | 'manual' | 'draft';

export default function AddJobModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('input');
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [notice, setNotice] = useState<string | undefined>();
  const [draft, setDraft] = useState<ParsedPosting | null>(null);
  const [jobUrl, setJobUrl] = useState('');

  const parse = useMutation({
    mutationFn: (body: { url?: string; rawText?: string }) =>
      apiFetch<ParseResponse>('/applications/parse', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
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
    mutationFn: (d: ParsedPosting) =>
      apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: d.companyName,
          position: d.position,
          jobUrl: jobUrl || undefined,
          location: d.location ?? undefined,
          employmentType: d.employmentType ?? undefined,
          deadline: d.deadline ?? undefined,
          stages: d.stages.map((s, i) => ({ name: s.name, order: i })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      onClose();
    },
  });

  const updateDraft = (patch: Partial<ParsedPosting>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">공고 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        {step === 'input' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              채용 공고 링크를 붙여넣으면 회사·직무·전형을 자동으로 분석해요.
            </p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              disabled={!url || parse.isPending}
              onClick={() => parse.mutate({ url })}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {parse.isPending ? '분석 중…' : '분석'}
            </button>
            <button
              onClick={() => setStep('manual')}
              className="text-sm text-slate-400 hover:text-slate-700"
            >
              직접 입력할래요
            </button>
          </div>
        )}

        {step === 'manual' && (
          <div className="flex flex-col gap-3">
            {notice && <p className="text-sm text-amber-600">{notice}</p>}
            <p className="text-sm text-slate-500">공고 내용을 붙여넣어 주세요.</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder="채용 공고 전문…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              disabled={!rawText || parse.isPending}
              onClick={() => parse.mutate({ rawText })}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {parse.isPending ? '분석 중…' : '분석'}
            </button>
          </div>
        )}

        {step === 'draft' && draft && (
          <div className="flex flex-col gap-3">
            {notice && <p className="text-sm text-amber-600">{notice}</p>}
            <Field
              label="회사명"
              value={draft.companyName}
              onChange={(v) => updateDraft({ companyName: v })}
            />
            <Field
              label="직무"
              value={draft.position}
              onChange={(v) => updateDraft({ position: v })}
            />
            <Field
              label="마감일"
              value={draft.deadline ?? ''}
              onChange={(v) => updateDraft({ deadline: v || null })}
              placeholder="YYYY-MM-DD"
            />

            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">
                전형 단계
              </div>
              <div className="flex flex-col gap-2">
                {draft.stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs text-slate-400">
                      {i + 1}
                    </span>
                    <input
                      value={s.name}
                      onChange={(e) => {
                        const stages = [...draft.stages];
                        stages[i] = { ...stages[i], name: e.target.value };
                        updateDraft({ stages });
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() =>
                        updateDraft({
                          stages: draft.stages.filter((_, j) => j !== i),
                        })
                      }
                      className="text-slate-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  updateDraft({
                    stages: [
                      ...draft.stages,
                      { name: '', order: draft.stages.length },
                    ],
                  })
                }
                className="mt-2 text-sm text-brand hover:underline"
              >
                + 단계 추가
              </button>
            </div>

            <button
              disabled={!draft.companyName || !draft.position || save.isPending}
              onClick={() => save.mutate(draft)}
              className="mt-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {save.isPending ? '저장 중…' : '저장'}
            </button>
          </div>
        )}

        {(parse.isError || save.isError) && (
          <p className="mt-3 text-sm text-red-500">
            오류가 발생했어요. 다시 시도해 주세요.
          </p>
        )}
      </div>
    </div>
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
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
