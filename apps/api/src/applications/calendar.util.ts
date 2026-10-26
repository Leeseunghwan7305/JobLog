import type { CalendarEvent } from '@joblog/types';
import type { StageStatus } from '@prisma/client';

interface AppLike {
  id: string;
  companyName: string;
  deadline: Date | null;
  stages: { name: string; status: StageStatus; scheduledAt: Date | null }[];
}

/** 지원 목록을 캘린더 이벤트로 투영(날짜 없는 건 제외, 날짜 오름차순). */
export function toCalendarEvents(apps: AppLike[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const app of apps) {
    if (app.deadline) {
      events.push({
        date: app.deadline.toISOString(),
        type: 'deadline',
        applicationId: app.id,
        companyName: app.companyName,
        label: '서류 마감',
        status: null,
      });
    }
    for (const s of app.stages) {
      if (s.scheduledAt) {
        events.push({
          date: s.scheduledAt.toISOString(),
          type: 'stage',
          applicationId: app.id,
          companyName: app.companyName,
          label: s.name,
          status: s.status,
        });
      }
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}
