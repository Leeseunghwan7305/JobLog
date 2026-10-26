import type { ApplicationDto, StageStatus } from '@joblog/types';

/** 카드에 표시할 "현재 전형" 요약 라벨 */
export function currentStageLabel(app: ApplicationDto): string {
  if (app.status === 'OFFER') return '최종합격';
  if (app.status === 'CLOSED') return '지원철회';
  const failed = app.stages.find((s) => s.status === 'FAILED');
  if (failed) return `${failed.name} 탈락`;
  const inProgress = app.stages.find((s) => s.status === 'IN_PROGRESS');
  if (inProgress) return `${inProgress.name} 진행중`;
  const pending = app.stages.find((s) => s.status === 'PENDING');
  if (pending) return `${pending.name} 대기`;
  return '진행중';
}

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행중',
  PASSED: '합격',
  FAILED: '탈락',
};

export const STAGE_STATUS_CLASS: Record<StageStatus, string> = {
  PENDING:
    'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300',
  IN_PROGRESS:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  PASSED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
};
