import type { ApplicationDto, StageDto, StageStatus } from '@joblog/types';

// 전형 구분자: ＞ > → ▶ » ▷ · • | , / 줄바꿈. 공고에서 흔히 쓰는 화살표·쉼표 등.
const STAGE_SEPARATORS = /[＞>→▶»▷⟶·•｜|,/\n\r]+/;

/**
 * 공고에서 복사한 전형 한 줄/여러 줄을 단계 배열로 분리한다.
 * (수집이 전형을 못 가져왔을 때 사용자가 직접 붙여넣어 채우는 용도 — LLM 재호출 없음)
 * 선행 번호("1. ")·끝 괄호 부연("(직무)")·콜론 뒤 설명은 LLM 규칙과 맞춰 제거한다.
 */
export function parseStagesFromText(
  text: string,
): { name: string; order: number }[] {
  return text
    .split(STAGE_SEPARATORS)
    .map((s) =>
      s
        .replace(/^\s*\d+\s*[.)]\s*/, '') // 선행 "1. " "2) "
        .replace(/\s*[(（].*?[)）]\s*$/, '') // 끝 괄호 부연
        .replace(/\s*:.*$/, '') // 콜론 뒤 설명
        .trim(),
    )
    .filter((s) => s.length > 0 && s.length <= 24) // 빈·과도하게 긴 토막 제외
    .map((name, i) => ({ name, order: i }));
}

/** 카드/퀵액션에서 '지금 처리할' 전형. 진행중 우선, 없으면 첫 대기 전형. */
export function currentStage(app: ApplicationDto): StageDto | null {
  return (
    app.stages.find((s) => s.status === 'IN_PROGRESS') ??
    app.stages.find((s) => s.status === 'PENDING') ??
    null
  );
}

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
