export type DeadlineTone = 'over' | 'soon' | 'normal';

export interface DeadlineInfo {
  text: string;
  tone: DeadlineTone;
}

/** 마감일 ISO → "마감 D-7 (11/30)" 형태 라벨 + 임박/초과 톤. 없거나 파싱 실패 시 null. */
export function deadlineInfo(iso: string | null | undefined): DeadlineInfo | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const diff = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  const md = `${dueDay.getMonth() + 1}/${dueDay.getDate()}`;

  if (diff < 0) return { text: `마감 지남 · ${md}`, tone: 'over' };
  if (diff === 0) return { text: `오늘 마감 · ${md}`, tone: 'soon' };
  return { text: `마감 D-${diff} · ${md}`, tone: diff <= 3 ? 'soon' : 'normal' };
}

export const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  over: 'text-red-600',
  soon: 'text-amber-600',
  normal: 'text-slate-400',
};
