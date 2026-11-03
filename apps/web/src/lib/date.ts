export type DeadlineTone = 'over' | 'soon' | 'normal';

export interface DeadlineInfo {
  text: string;
  tone: DeadlineTone;
}

/** 마감일 ISO → "마감 D-7 (11/30)" 형태 라벨 + 임박/초과 톤. 없거나 파싱 실패 시 null. */
export function deadlineInfo(
  iso: string | null | undefined,
): DeadlineInfo | null {
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
  return {
    text: `마감 D-${diff} · ${md}`,
    tone: diff <= 3 ? 'soon' : 'normal',
  };
}

export const DEADLINE_TONE_CLASS: Record<DeadlineTone, string> = {
  over: 'text-red-600 dark:text-red-400',
  soon: 'text-amber-600 dark:text-amber-400',
  normal: 'text-muted-foreground',
};

/** 타임라인용 타임스탬프: "M.D HH:mm" (올해가 아니면 연도 포함). 파싱 실패 시 빈 문자열. */
export function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const md = `${d.getMonth() + 1}.${d.getDate()}`;
  const date =
    d.getFullYear() === new Date().getFullYear()
      ? md
      : `${d.getFullYear()}.${md}`;
  return `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
