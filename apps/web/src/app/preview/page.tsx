'use client';

import type { StageStatus } from '@joblog/types';
import { useState } from 'react';

import AddJobModal from '@/components/AddJobModal';
import ThemeToggle from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { DEADLINE_TONE_CLASS } from '@/lib/date';
import { STAGE_STATUS_CLASS, STAGE_STATUS_LABEL } from '@/lib/stage';

// 임시 시각 검증 페이지 (검증 후 삭제)
export default function Preview() {
  const [modal, setModal] = useState(false);
  const statuses: StageStatus[] = [
    'PENDING',
    'IN_PROGRESS',
    'PASSED',
    'FAILED',
  ];
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">UI 프리뷰</h1>
        <ThemeToggle />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <span
            key={s}
            className={`rounded px-2 py-1 text-xs font-medium ${STAGE_STATUS_CLASS[s]}`}
          >
            {STAGE_STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="font-bold">네이버</div>
          <div className="text-sm text-muted-foreground">프론트엔드</div>
          <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[13px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            코딩테스트 진행중
          </span>
          <div className="mt-2 flex flex-wrap gap-1">
            {statuses.map((s, i) => (
              <span
                key={s}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STAGE_STATUS_CLASS[s]}`}
              >
                {['서류', '코테', '1차', '최종'][i]}
              </span>
            ))}
          </div>
          <div className={`mt-2 text-xs font-medium ${DEADLINE_TONE_CLASS.soon}`}>
            마감 D-3 · 11/30
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="font-bold">토스</div>
          <div className="text-sm text-muted-foreground">백엔드</div>
          <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-[13px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            최종합격
          </span>
          <div className={`mt-2 text-xs font-medium ${DEADLINE_TONE_CLASS.over}`}>
            마감 지남 · 10/1
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Skeleton className="h-16 flex-1 rounded-xl" />
      </div>

      <button
        onClick={() => {
          setModal(true);
        }}
        className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground transition hover:bg-primary/90"
      >
        모달 열기
      </button>

      {modal && (
        <AddJobModal
          onClose={() => {
            setModal(false);
          }}
        />
      )}
    </main>
  );
}
