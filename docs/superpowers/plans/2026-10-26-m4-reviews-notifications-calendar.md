# M4 (잡플래닛 스크래핑 · D-1 알림 · 캘린더) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구직 지원에 캘린더 뷰, D-1 마감/면접 이메일 알림, 잡플래닛 공개 평점 best-effort 스크래핑+캐시를 추가한다.

**Architecture:** 기존 `Application.deadline`·`Stage.scheduledAt`·`CompanyReview`(미사용) 데이터를 활용한다. 캘린더는 읽기 전용 집계 API+뷰. 알림은 `@nestjs/schedule` cron이 매일 09:00 KST에 D-1 대상을 모아 Resend로 발송하고 `SentNotification`으로 멱등성을 보장한다. 스크래핑은 `ParseModule`에서 빼낸 공유 `FirecrawlService`로 잡플래닛을 best-effort 수집해 7일 TTL 캐시한다. 외부 키 부재 시 전부 우아하게 폴백한다.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL, Next.js(App Router) + TanStack Query v5, `@nestjs/schedule`, `resend`. 테스트는 저장소 기존 하네스(`node --import tsx --test`)를 그대로 쓴다.

**Spec:** `docs/superpowers/specs/2026-10-26-m4-reviews-notifications-calendar-design.md`

## Global Constraints

- 외부 키(`FIRECRAWL_API_KEY`, `RESEND_API_KEY`)는 **서버 전용**. 없으면 서비스는 `enabled=false`로 동작하고 앱이 죽지 않는다(기존 `FirecrawlService`/`ClaudeService` 패턴).
- 모든 조회는 JWT `userId`로 소유권 필터. 캘린더·알림도 본인 리소스만. 소유권 불일치는 404.
- web↔api 공유 데이터 타입은 `packages/types`(`@joblog/types`)에 정의하고 양쪽에서 import. api 로컬 DTO 중복은 지양.
- 에러는 조용히 삼키지 않는다 — 실패는 `Logger.warn`으로 기록하되 폴백(딥링크/콘솔 로그)으로 핵심 플로우를 유지.
- 서비스는 env를 `process.env.*`로 직접 읽는다(기존 관례). `ConfigService` 주입하지 않는다.
- **테스트 컨벤션(기존 하네스 준수)**: 파일명 `*.test.ts`, `import { test, mock } from 'node:test'` + `import assert from 'node:assert/strict'`. 새 러너(vitest 등) 도입 금지 — Stop 훅이 `node:test`만 돌린다.
- **검증 게이트**: `.claude/hooks/verify.sh`(Stop 훅)가 `apps/api/` 변경 턴마다 `pnpm --filter @joblog/api typecheck` + `test`를 돌려 통과해야 턴이 끝난다. typecheck는 `*.test.ts` 포함 전 소스를 검사하므로 테스트 파일도 타입이 맞아야 한다. 각 백엔드 작업은 커밋 전 이 둘을 직접 돌려 맞춘다.
- 커밋 메시지는 한글 가능. 커밋 꼬리에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 알림 시점은 **D-1 단일**(마감일/면접일 하루 전, 09:00 KST). 스크래핑 캐시 TTL은 **7일**.

---

## 작업 순서 개요

- **그룹 A (공통 준비)**: Task 1~2 — Firecrawl 공유화, 단계 일정 입력 UI
- **그룹 B (캘린더)**: Task 3~5
- **그룹 C (알림)**: Task 6~10
- **그룹 D (스크래핑)**: Task 11~12
- **마무리**: Task 13 — 문서 갱신

각 그룹은 독립적으로 동작·테스트 가능한 소프트웨어를 만든다. 테스트 하네스는 이미 존재하므로(`apps/api`에 `score.test.ts` 가동 중) 별도 셋업 작업 없음.

> 단일 테스트 파일만 돌리려면: `node --import tsx --test apps/api/src/<path>.test.ts` (레포 루트에서). 전체는 `pnpm --filter @joblog/api test`.

---

### Task 1: FirecrawlService 공유 모듈로 추출

`FirecrawlService`를 `ParseModule` 밖으로 빼내 잡플래닛 스크래핑에서도 쓸 수 있게 한다.

**Files:**
- Create: `apps/api/src/shared/firecrawl.service.ts` (이동)
- Create: `apps/api/src/shared/shared.module.ts`
- Delete: `apps/api/src/parse/firecrawl.service.ts`
- Modify: `apps/api/src/parse/parse.module.ts`
- Modify: `apps/api/src/parse/*` (firecrawl import 경로 — 아래 Step에서 grep로 확인)

**Interfaces:**
- Produces: `SharedModule` exports `FirecrawlService`. `FirecrawlService`: `get enabled(): boolean`, `scrape(url: string): Promise<string | null>`.

- [ ] **Step 1: firecrawl.service.ts 이동**

```bash
git mv apps/api/src/parse/firecrawl.service.ts apps/api/src/shared/firecrawl.service.ts
```

파일 내용은 변경 없음(자기완결적).

- [ ] **Step 2: SharedModule 작성**

Create `apps/api/src/shared/shared.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { FirecrawlService } from './firecrawl.service';

@Module({
  providers: [FirecrawlService],
  exports: [FirecrawlService],
})
export class SharedModule {}
```

- [ ] **Step 3: ParseModule 수정 — SharedModule import, FirecrawlService provider 제거**

`apps/api/src/parse/parse.module.ts` 를 다음으로:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { ParseController } from './parse.controller';
import { ParseService } from './parse.service';
import { LlmService } from './llm.service';
import { ClaudeService } from './claude.service';
import { OllamaService } from './ollama.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [ParseController],
  providers: [ParseService, LlmService, ClaudeService, OllamaService],
})
export class ParseModule {}
```

- [ ] **Step 4: FirecrawlService import 경로 갱신**

Run: `grep -rn "firecrawl.service" apps/api/src/parse`
`parse/` 내부에서 `./firecrawl.service` 를 import 하던 파일(예: `parse.service.ts`, `llm.service.ts`)의 경로를 `../shared/firecrawl.service` 로 수정.

- [ ] **Step 5: 검증 (typecheck + test + build)**

Run: `pnpm --filter @joblog/api typecheck && pnpm --filter @joblog/api test && pnpm --filter @joblog/api build`
Expected: 전부 성공(기존 테스트 통과 유지).

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/shared apps/api/src/parse
git commit -m "refactor: FirecrawlService를 SharedModule로 추출"
```

---

### Task 2: 프론트 단계 일정(scheduledAt) 입력 UI

지원 상세의 각 전형 단계에 예정일 입력을 추가한다. 백엔드 `PATCH /applications/:id/stages/:stageId`(이미 `scheduledAt` 수신)를 재사용. 이 값이 캘린더·알림의 데이터 소스다.

**Files:**
- Modify: `apps/web/app/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `StageDto.scheduledAt: string | null` (`@joblog/types`), `PATCH /applications/:id/stages/:stageId` body `{ scheduledAt?: string | null }`.

- [ ] **Step 1: scheduledAt 저장 뮤테이션 추가**

`apps/web/app/applications/[id]/page.tsx` 의 `setStage` 뮤테이션 아래에 추가:

```tsx
  const setSchedule = useMutation({
    mutationFn: ({ stageId, scheduledAt }: { stageId: string; scheduledAt: string }) =>
      apiFetch(`/applications/${id}/stages/${stageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduledAt: scheduledAt || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app', id] });
      qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
```

- [ ] **Step 2: 단계 행에 datetime-local 입력 추가**

기존 전형 단계 `<div key={s.id} ...>` 블록 전체를 아래로 교체(세로 구조로 변경 + 예정일 입력 추가):

```tsx
            <div
              key={s.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{s.name}</span>
                <div className="flex gap-1.5">
                  {STATUSES.map((st) => (
                    <button
                      key={st}
                      onClick={() => setStage.mutate({ stageId: s.id, status: st })}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        s.status === st
                          ? STAGE_STATUS_CLASS[st]
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {STAGE_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                예정일
                <input
                  type="datetime-local"
                  defaultValue={s.scheduledAt ? s.scheduledAt.slice(0, 16) : ''}
                  onChange={(e) =>
                    setSchedule.mutate({
                      stageId: s.id,
                      scheduledAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : '',
                    })
                  }
                  className="rounded-md border border-slate-200 px-2 py-1 text-slate-700"
                />
              </label>
            </div>
```

- [ ] **Step 3: 빌드/타입체크**

Run: `pnpm --filter @joblog/web build`
Expected: 성공

- [ ] **Step 4: 수동 검증**

api·web dev 서버를 띄우고(`pnpm --filter @joblog/api dev`, `pnpm --filter @joblog/web dev`), 지원 상세에서 한 단계의 예정일을 설정 → 새로고침 후 값 유지 확인.

- [ ] **Step 5: 커밋**

```bash
git add "apps/web/app/applications/[id]/page.tsx"
git commit -m "feat(web): 전형 단계 예정일(scheduledAt) 입력 UI"
```

---

### Task 3: CalendarEvent 공유 타입

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `CalendarEventType`, `CalendarEvent`.

- [ ] **Step 1: 타입 추가**

`packages/types/src/index.ts` 끝에 추가:

```ts
export type CalendarEventType = "deadline" | "stage";

export interface CalendarEvent {
  date: string; // ISO datetime
  type: CalendarEventType;
  applicationId: string;
  companyName: string;
  label: string; // deadline: "서류 마감" / stage: 전형명
  status: StageStatus | null; // type === "stage" 일 때만 값
}
```

- [ ] **Step 2: 타입 패키지 확인**

Run: `cat packages/types/package.json` 로 빌드 스크립트 확인 후 있으면 `pnpm --filter @joblog/types build`, 없으면 `pnpm --filter @joblog/api typecheck`(api가 types를 참조하므로 간접 검증).
Expected: 타입 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): CalendarEvent 공유 타입 추가"
```

---

### Task 4: 캘린더 집계 API (`GET /calendar`)

본인 지원의 `deadline`과 `stage.scheduledAt`을 범위로 조회해 이벤트 배열로 반환한다.

**Files:**
- Create: `apps/api/src/applications/calendar.util.ts`
- Create: `apps/api/src/applications/calendar.util.test.ts`
- Modify: `apps/api/src/applications/applications.service.ts`
- Modify: `apps/api/src/applications/applications.controller.ts`

**Interfaces:**
- Consumes: `PrismaService` (주입됨).
- Produces: `toCalendarEvents(apps): CalendarEvent[]` (순수 변환, 테스트 대상); `ApplicationsService.calendar(userId, from?, to?): Promise<CalendarEvent[]>`; route `GET /calendar?from=&to=`.

- [ ] **Step 1: 순수 변환 함수의 실패 테스트 작성**

Create `apps/api/src/applications/calendar.util.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCalendarEvents } from './calendar.util';

test('deadline과 scheduledAt을 이벤트로 투영한다', () => {
  const events = toCalendarEvents([
    {
      id: 'a1',
      companyName: '카카오',
      deadline: new Date('2026-11-01T00:00:00Z'),
      stages: [
        { name: '1차 면접', status: 'IN_PROGRESS', scheduledAt: new Date('2026-11-05T05:00:00Z') },
        { name: '서류', status: 'PASSED', scheduledAt: null },
      ],
    },
  ]);
  assert.equal(events.length, 2);
  const deadline = events.find((e) => e.type === 'deadline')!;
  assert.equal(deadline.applicationId, 'a1');
  assert.equal(deadline.label, '서류 마감');
  assert.equal(deadline.status, null);
  const stage = events.find((e) => e.type === 'stage')!;
  assert.equal(stage.label, '1차 면접');
  assert.equal(stage.status, 'IN_PROGRESS');
});

test('deadline이 없고 scheduledAt도 없으면 이벤트를 만들지 않는다', () => {
  const events = toCalendarEvents([
    { id: 'a2', companyName: '네이버', deadline: null, stages: [{ name: '서류', status: 'PENDING', scheduledAt: null }] },
  ]);
  assert.equal(events.length, 0);
});

test('날짜 오름차순으로 정렬한다', () => {
  const events = toCalendarEvents([
    {
      id: 'a3',
      companyName: 'A',
      deadline: new Date('2026-12-10T00:00:00Z'),
      stages: [{ name: '면접', status: 'PENDING', scheduledAt: new Date('2026-12-01T00:00:00Z') }],
    },
  ]);
  assert.deepEqual(events.map((e) => e.type), ['stage', 'deadline']);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test apps/api/src/applications/calendar.util.test.ts`
Expected: FAIL (`toCalendarEvents` 모듈 없음)

- [ ] **Step 3: 변환 함수 구현**

Create `apps/api/src/applications/calendar.util.ts`:

```ts
import type { StageStatus } from '@prisma/client';

export type CalendarEventType = 'deadline' | 'stage';

export interface CalendarEvent {
  date: string;
  type: CalendarEventType;
  applicationId: string;
  companyName: string;
  label: string;
  status: StageStatus | null;
}

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
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test apps/api/src/applications/calendar.util.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 서비스에 calendar 메서드 추가**

`apps/api/src/applications/applications.service.ts` 상단 import에 추가:

```ts
import { toCalendarEvents, CalendarEvent } from './calendar.util';
```

클래스에 메서드 추가(`stats` 아래):

```ts
  async calendar(userId: string, from?: string, to?: string): Promise<CalendarEvent[]> {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 2, 0);

    const apps = await this.prisma.application.findMany({
      where: {
        userId,
        OR: [
          { deadline: { gte: start, lte: end } },
          { stages: { some: { scheduledAt: { gte: start, lte: end } } } },
        ],
      },
      include: { stages: true },
    });

    const inRange = (d: Date | null) => !!d && d >= start && d <= end;
    const filtered = apps.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      deadline: inRange(a.deadline) ? a.deadline : null,
      stages: a.stages
        .filter((s) => inRange(s.scheduledAt))
        .map((s) => ({ name: s.name, status: s.status, scheduledAt: s.scheduledAt })),
    }));
    return toCalendarEvents(filtered);
  }
```

- [ ] **Step 6: 컨트롤러에 라우트 추가**

`apps/api/src/applications/applications.controller.ts` 의 `stats` 핸들러 아래에 추가:

```ts
  @Get('calendar')
  calendar(
    @CurrentUser() userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.calendar(userId, from, to);
  }
```

- [ ] **Step 7: 검증 (typecheck + test + build)**

Run: `pnpm --filter @joblog/api typecheck && pnpm --filter @joblog/api test && pnpm --filter @joblog/api build`
Expected: 전부 성공.

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/applications
git commit -m "feat(api): GET /calendar 집계 엔드포인트 + 변환 함수 테스트"
```

---

### Task 5: 프론트 캘린더 페이지 (`/calendar`)

월간 그리드로 이벤트를 표시한다.

**Files:**
- Create: `apps/web/app/calendar/page.tsx`
- Modify: `apps/web/app/page.tsx` (대시보드에 캘린더 링크)

**Interfaces:**
- Consumes: `CalendarEvent[]` (`@joblog/types`), `GET /calendar?from=&to=`.

- [ ] **Step 1: 캘린더 페이지 작성**

Create `apps/web/app/calendar/page.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';
import type { CalendarEvent } from '@joblog/types';

export default function CalendarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0-based
  });

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  const from = new Date(cursor.year, cursor.month, 1);
  const to = new Date(cursor.year, cursor.month + 1, 0);

  const events = useQuery({
    queryKey: ['calendar', from.toISOString(), to.toISOString()],
    queryFn: () =>
      apiFetch<CalendarEvent[]>(
        `/calendar?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
    enabled: ready,
  });

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of events.data ?? []) {
      const d = new Date(e.date);
      if (d.getFullYear() === cursor.year && d.getMonth() === cursor.month) {
        const day = d.getDate();
        map.set(day, [...(map.get(day) ?? []), e]);
      }
    }
    return map;
  }, [events.data, cursor]);

  if (!ready) return null;

  const firstWeekday = from.getDay();
  const daysInMonth = to.getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-700">
          ← 대시보드
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setCursor((c) =>
                c.month === 0
                  ? { year: c.year - 1, month: 11 }
                  : { ...c, month: c.month - 1 },
              )
            }
            className="text-slate-400 hover:text-slate-700"
          >
            ←
          </button>
          <span className="font-bold">
            {cursor.year}년 {cursor.month + 1}월
          </span>
          <button
            onClick={() =>
              setCursor((c) =>
                c.month === 11
                  ? { year: c.year + 1, month: 0 }
                  : { ...c, month: c.month + 1 },
              )
            }
            className="text-slate-400 hover:text-slate-700"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-px rounded-xl border border-slate-200 bg-slate-200 text-sm">
        {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
          <div key={w} className="bg-slate-50 py-2 text-center font-semibold text-slate-500">
            {w}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="min-h-[96px] bg-white p-1.5 align-top">
            {day && (
              <>
                <div className="text-xs text-slate-400">{day}</div>
                <div className="mt-1 flex flex-col gap-1">
                  {(byDay.get(day) ?? []).map((e, j) => (
                    <Link
                      key={j}
                      href={`/applications/${e.applicationId}`}
                      className={`truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        e.type === 'deadline'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-brand/10 text-brand'
                      }`}
                      title={`${e.companyName} · ${e.label}`}
                    >
                      {e.companyName} · {e.label}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 대시보드에 캘린더 링크 추가**

먼저 헤더 구조 확인: `grep -n "Link\|href\|<h1\|대시보드" apps/web/app/page.tsx | head -30`
적절한 헤더/네비 영역에 삽입:

```tsx
<Link href="/calendar" className="text-sm text-brand hover:underline">
  캘린더 보기 →
</Link>
```

(`import Link from 'next/link'` 가 없으면 추가.)

- [ ] **Step 3: 빌드/타입체크**

Run: `pnpm --filter @joblog/web build`
Expected: 성공

- [ ] **Step 4: 수동 검증**

dev 서버에서 한 지원에 마감일과 단계 예정일을 넣고 `/calendar` 이동 → 날짜 셀 배지 표시, 클릭 시 상세 이동, 이전/다음 달 이동 확인.

- [ ] **Step 5: 커밋**

```bash
git add apps/web/app/calendar/page.tsx apps/web/app/page.tsx
git commit -m "feat(web): 월간 캘린더 뷰 + 대시보드 링크"
```

---

### Task 6: SentNotification 모델 + 알림 의존성

알림 멱등성용 테이블과 스케줄/메일 라이브러리를 추가한다.

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration (자동 생성)
- Modify: `apps/api/package.json` (deps `@nestjs/schedule`, `resend`)

**Interfaces:**
- Produces: Prisma `SentNotification { id, userId, kind, refId, sendDate, createdAt }` with `@@unique([userId, kind, refId, sendDate])` → client 복합키 접근자 `userId_kind_refId_sendDate`.

- [ ] **Step 1: Prisma 모델 추가**

`apps/api/prisma/schema.prisma` 의 `CompanyReview` 모델 아래에 추가:

```prisma
// M4 — 알림 중복 발송 방지 (D-1 멱등성)
model SentNotification {
  id        String   @id @default(cuid())
  userId    String
  kind      String   // "deadline" | "stage"
  refId     String   // applicationId(deadline) 또는 stageId(stage)
  sendDate  String   // 발송 기준 KST 날짜 "YYYY-MM-DD"
  createdAt DateTime @default(now())

  @@unique([userId, kind, refId, sendDate])
}
```

- [ ] **Step 2: 마이그레이션 생성·적용**

로컬 DB(Docker, 포트 5433)가 떠 있어야 한다: `pnpm db:up`.

Run: `pnpm --filter @joblog/api prisma migrate dev --name add_sent_notification`
Expected: 마이그레이션 생성 + `prisma generate` 성공. `SentNotification` 테이블 생성.

- [ ] **Step 3: 의존성 설치**

```bash
pnpm --filter @joblog/api add @nestjs/schedule@^4 resend@^4
```

- [ ] **Step 4: 검증**

Run: `pnpm --filter @joblog/api typecheck && pnpm --filter @joblog/api build`
Expected: 성공(Prisma client에 `sentNotification` 생성됨).

- [ ] **Step 5: 커밋**

```bash
git add apps/api/prisma apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): SentNotification 모델 + 알림 의존성(@nestjs/schedule, resend)"
```

---

### Task 7: MailerService (Resend 래핑)

**Files:**
- Create: `apps/api/src/notifications/mailer.service.ts`
- Create: `apps/api/src/notifications/mailer.service.test.ts`

**Interfaces:**
- Produces: `MailerService`: `get enabled(): boolean`, `send(input: { to: string; subject: string; html: string }): Promise<boolean>`.

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/api/src/notifications/mailer.service.test.ts`:

```ts
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { MailerService } from './mailer.service';

const orig = process.env.RESEND_API_KEY;
afterEach(() => {
  if (orig === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = orig;
});

test('키가 없으면 enabled=false 이고 send는 false(폴백)', async () => {
  delete process.env.RESEND_API_KEY;
  const mailer = new MailerService();
  assert.equal(mailer.enabled, false);
  const ok = await mailer.send({ to: 'a@b.com', subject: 's', html: '<p>h</p>' });
  assert.equal(ok, false);
});

test('키가 있으면 enabled=true', () => {
  process.env.RESEND_API_KEY = 'test-key';
  const mailer = new MailerService();
  assert.equal(mailer.enabled, true);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test apps/api/src/notifications/mailer.service.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: MailerService 구현**

Create `apps/api/src/notifications/mailer.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/** Resend 이메일 발송. 키가 없으면 콘솔 로그로 폴백(앱이 죽지 않음). */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  get enabled(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  async send(input: { to: string; subject: string; html: string }): Promise<boolean> {
    if (!this.enabled) {
      this.logger.log(`[mail disabled] to=${input.to} subject=${input.subject}`);
      return false;
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.MAIL_FROM ?? 'JobLog <onboarding@resend.dev>';
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      });
      if (error) {
        this.logger.warn(`Resend error: ${JSON.stringify(error)}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Resend failed: ${String(e)}`);
      return false;
    }
  }
}
```

- [ ] **Step 4: 통과 확인 + typecheck**

Run: `node --import tsx --test apps/api/src/notifications/mailer.service.test.ts && pnpm --filter @joblog/api typecheck`
Expected: 테스트 PASS(2), typecheck 성공.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/notifications/mailer.service.ts apps/api/src/notifications/mailer.service.test.ts
git commit -m "feat(api): MailerService (Resend, 키 부재 시 폴백)"
```

---

### Task 8: KST 날짜 범위 유틸

D-1 대상 조회용으로 KST 달력 날짜의 UTC 구간을 계산하는 순수 함수. `Date.now()` 의존 없이 `now`를 인자로 받아 테스트 가능하게 한다.

**Files:**
- Create: `apps/api/src/notifications/kst.util.ts`
- Create: `apps/api/src/notifications/kst.util.test.ts`

**Interfaces:**
- Produces: `kstDayRange(now: Date, dayOffset: number): { start: Date; end: Date; dateStr: string }` — 지정 KST 날짜(now 기준 +dayOffset일)의 `[start, end)` UTC 구간과 `YYYY-MM-DD` 문자열.

- [ ] **Step 1: 실패 테스트 작성**

Create `apps/api/src/notifications/kst.util.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kstDayRange } from './kst.util';

test('09:00 KST(=00:00Z) 기준 D-1은 다음 KST 날짜 구간', () => {
  // 2026-10-26T00:00:00Z == 2026-10-26 09:00 KST
  const r = kstDayRange(new Date('2026-10-26T00:00:00Z'), 1);
  assert.equal(r.dateStr, '2026-10-27');
  // KST 2026-10-27 00:00 == 2026-10-26T15:00:00Z
  assert.equal(r.start.toISOString(), '2026-10-26T15:00:00.000Z');
  // KST 2026-10-28 00:00 == 2026-10-27T15:00:00Z
  assert.equal(r.end.toISOString(), '2026-10-27T15:00:00.000Z');
});

test('월말 경계를 넘긴다', () => {
  const r = kstDayRange(new Date('2026-10-30T00:00:00Z'), 1); // KST 10-30 → D-1 = 10-31
  assert.equal(r.dateStr, '2026-10-31');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test apps/api/src/notifications/kst.util.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

Create `apps/api/src/notifications/kst.util.ts`:

```ts
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * now 기준 KST 달력으로 dayOffset일 뒤 날짜의 [start, end) UTC 구간과
 * YYYY-MM-DD(KST) 문자열을 반환한다.
 */
export function kstDayRange(
  now: Date,
  dayOffset: number,
): { start: Date; end: Date; dateStr: string } {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate() + dayOffset;

  // KST 자정 = 해당 UTC시각 - 9h
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0) - KST_OFFSET_MS);
  const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0) - KST_OFFSET_MS);

  const dayUtc = new Date(Date.UTC(y, m, d));
  const dateStr = `${dayUtc.getUTCFullYear()}-${String(dayUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(dayUtc.getUTCDate()).padStart(2, '0')}`;

  return { start, end, dateStr };
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test apps/api/src/notifications/kst.util.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/notifications/kst.util.ts apps/api/src/notifications/kst.util.test.ts
git commit -m "feat(api): KST 날짜 범위 유틸 (D-1 구간 계산)"
```

---

### Task 9: NotificationsService + cron (멱등 D-1 발송)

**Files:**
- Create: `apps/api/src/notifications/notifications.service.ts`
- Create: `apps/api/src/notifications/notifications.service.test.ts`

**Interfaces:**
- Consumes: `PrismaService`, `MailerService` (주입), `kstDayRange` (Task 8).
- Produces: `NotificationsService.runDaily(now: Date): Promise<{ sent: number; skipped: number }>` — cron 본체이자 테스트 진입점. `@Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })` 로 호출.

- [ ] **Step 1: 실패 테스트 작성 (멱등성/이메일 없음/발송 실패)**

Create `apps/api/src/notifications/notifications.service.test.ts`:

```ts
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationsService } from './notifications.service';

function makePrisma(opts: {
  apps?: any[];
  stages?: any[];
  existingKeys?: Set<string>;
}) {
  const existing = opts.existingKeys ?? new Set<string>();
  return {
    application: { findMany: mock.fn(async () => opts.apps ?? []) },
    stage: { findMany: mock.fn(async () => opts.stages ?? []) },
    sentNotification: {
      findUnique: mock.fn(async ({ where }: any) => {
        const w = where.userId_kind_refId_sendDate;
        const k = `${w.userId}|${w.kind}|${w.refId}|${w.sendDate}`;
        return existing.has(k) ? { id: 'x' } : null;
      }),
      create: mock.fn(async ({ data }: any) => {
        existing.add(`${data.userId}|${data.kind}|${data.refId}|${data.sendDate}`);
        return { id: 'new' };
      }),
    },
  } as any;
}

const NOW = new Date('2026-10-26T00:00:00Z'); // D-1 target = KST 2026-10-27

test('마감 D-1 지원에 메일을 보내고 기록한다', async () => {
  const prisma = makePrisma({
    apps: [
      { id: 'a1', companyName: '카카오', deadline: new Date('2026-10-27T05:00:00Z'), user: { id: 'u1', email: 'u1@x.com' } },
    ],
  });
  const mailer = { send: mock.fn(async () => true) } as any;
  const svc = new NotificationsService(prisma, mailer);

  const res = await svc.runDaily(NOW);

  assert.equal(mailer.send.mock.callCount(), 1);
  assert.equal(mailer.send.mock.calls[0].arguments[0].to, 'u1@x.com');
  assert.equal(prisma.sentNotification.create.mock.callCount(), 1);
  assert.equal(res.sent, 1);
});

test('이미 보낸 건은 다시 보내지 않는다(멱등)', async () => {
  const prisma = makePrisma({
    apps: [
      { id: 'a1', companyName: '카카오', deadline: new Date('2026-10-27T05:00:00Z'), user: { id: 'u1', email: 'u1@x.com' } },
    ],
    existingKeys: new Set(['u1|deadline|a1|2026-10-27']),
  });
  const mailer = { send: mock.fn(async () => true) } as any;
  const svc = new NotificationsService(prisma, mailer);

  const res = await svc.runDaily(NOW);

  assert.equal(mailer.send.mock.callCount(), 0);
  assert.equal(res.skipped, 1);
});

test('email이 없으면 스킵하고 기록하지 않는다', async () => {
  const prisma = makePrisma({
    apps: [
      { id: 'a1', companyName: '카카오', deadline: new Date('2026-10-27T05:00:00Z'), user: { id: 'u1', email: null } },
    ],
  });
  const mailer = { send: mock.fn(async () => true) } as any;
  const svc = new NotificationsService(prisma, mailer);

  await svc.runDaily(NOW);

  assert.equal(mailer.send.mock.callCount(), 0);
  assert.equal(prisma.sentNotification.create.mock.callCount(), 0);
});

test('면접 D-1 메일 발송 실패 시 기록하지 않는다(다음에 재시도)', async () => {
  const prisma = makePrisma({
    stages: [
      { id: 's1', name: '1차 면접', scheduledAt: new Date('2026-10-27T05:00:00Z'), application: { id: 'a9', companyName: '라인', user: { id: 'u1', email: 'u1@x.com' } } },
    ],
  });
  const mailer = { send: mock.fn(async () => false) } as any;
  const svc = new NotificationsService(prisma, mailer);

  const res = await svc.runDaily(NOW);

  assert.equal(mailer.send.mock.callCount(), 1);
  assert.equal(prisma.sentNotification.create.mock.callCount(), 0);
  assert.equal(res.sent, 0);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test apps/api/src/notifications/notifications.service.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현 (링크는 applicationId 사용)**

Create `apps/api/src/notifications/notifications.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from './mailer.service';
import { kstDayRange } from './kst.util';

interface Target {
  userId: string;
  email: string | null;
  kind: 'deadline' | 'stage';
  refId: string;
  applicationId: string;
  companyName: string;
  label: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async runDailyCron() {
    const res = await this.runDaily(new Date());
    this.logger.log(`D-1 알림: sent=${res.sent} skipped=${res.skipped}`);
  }

  /** now 기준 D-1 대상에게 메일 발송(멱등). 테스트 진입점. */
  async runDaily(now: Date): Promise<{ sent: number; skipped: number }> {
    const { start, end, dateStr } = kstDayRange(now, 1);
    const targets = await this.collectTargets(start, end);

    let sent = 0;
    let skipped = 0;
    for (const t of targets) {
      const where = {
        userId_kind_refId_sendDate: {
          userId: t.userId,
          kind: t.kind,
          refId: t.refId,
          sendDate: dateStr,
        },
      };
      const already = await this.prisma.sentNotification.findUnique({ where });
      if (already) {
        skipped++;
        continue;
      }
      if (!t.email) {
        this.logger.log(`email 없음, 스킵: user=${t.userId}`);
        skipped++;
        continue;
      }
      const ok = await this.mailer.send({
        to: t.email,
        subject: `[JobLog] 내일 ${t.companyName} ${t.label}`,
        html: this.html(t),
      });
      if (!ok) {
        skipped++;
        continue; // 기록하지 않아 다음 cron에서 재시도
      }
      await this.prisma.sentNotification.create({
        data: { userId: t.userId, kind: t.kind, refId: t.refId, sendDate: dateStr },
      });
      sent++;
    }
    return { sent, skipped };
  }

  private async collectTargets(start: Date, end: Date): Promise<Target[]> {
    const [apps, stages] = await Promise.all([
      this.prisma.application.findMany({
        where: { deadline: { gte: start, lt: end } },
        include: { user: true },
      }),
      this.prisma.stage.findMany({
        where: { scheduledAt: { gte: start, lt: end } },
        include: { application: { include: { user: true } } },
      }),
    ]);

    const targets: Target[] = [];
    for (const a of apps as any[]) {
      targets.push({
        userId: a.user.id,
        email: a.user.email,
        kind: 'deadline',
        refId: a.id,
        applicationId: a.id,
        companyName: a.companyName,
        label: '서류 마감',
      });
    }
    for (const s of stages as any[]) {
      targets.push({
        userId: s.application.user.id,
        email: s.application.user.email,
        kind: 'stage',
        refId: s.id,
        applicationId: s.application.id,
        companyName: s.application.companyName,
        label: s.name,
      });
    }
    return targets;
  }

  private html(t: Target): string {
    const base = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    const url = `${base}/applications/${t.applicationId}`;
    return `
      <div>
        <p><strong>${t.companyName}</strong> · ${t.label}이(가) 내일입니다.</p>
        <p><a href="${url}">JobLog에서 보기</a></p>
      </div>`;
  }
}
```

- [ ] **Step 4: 통과 확인 + typecheck**

Run: `node --import tsx --test apps/api/src/notifications/notifications.service.test.ts && pnpm --filter @joblog/api typecheck`
Expected: 테스트 PASS(4), typecheck 성공.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/notifications/notifications.service.ts apps/api/src/notifications/notifications.service.test.ts
git commit -m "feat(api): NotificationsService D-1 cron (멱등 발송)"
```

---

### Task 10: NotificationsModule 등록 + ScheduleModule + env

**Files:**
- Create: `apps/api/src/notifications/notifications.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: NotificationsModule 작성**

Create `apps/api/src/notifications/notifications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { MailerService } from './mailer.service';

@Module({
  providers: [NotificationsService, MailerService],
})
export class NotificationsModule {}
```

(PrismaModule은 `@Global` 이라 import 불필요.)

- [ ] **Step 2: app.module.ts 에 ScheduleModule + NotificationsModule 등록**

`apps/api/src/app.module.ts` 를 다음으로:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ApplicationsModule } from './applications/applications.module';
import { ParseModule } from './parse/parse.module';
import { CompaniesModule } from './companies/companies.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    ApplicationsModule,
    ParseModule,
    CompaniesModule,
    NotificationsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: .env.example 에 메일 변수 추가**

`apps/api/.env.example` 끝에 추가:

```
# M4 알림 (없으면 메일 비활성 — 콘솔 로그 폴백)
RESEND_API_KEY=
MAIL_FROM=JobLog <onboarding@resend.dev>
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: 검증 (typecheck + test + build + 부팅)**

Run: `pnpm --filter @joblog/api typecheck && pnpm --filter @joblog/api test && pnpm --filter @joblog/api build`
Expected: 전부 성공.

Run(DB 필요): `pnpm db:up` 후 `pnpm --filter @joblog/api dev` 로 부팅 → `Nest application successfully started` 확인 후 종료(Ctrl-C). cron 등록 에러가 없어야 한다.

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/notifications/notifications.module.ts apps/api/src/app.module.ts apps/api/.env.example
git commit -m "feat(api): NotificationsModule + ScheduleModule 등록, 메일 env"
```

---

### Task 11: 잡플래닛 평점 best-effort 스크래핑 + 캐시

`CompaniesService`를 확장한다. 정규화 키로 캐시 조회 → 7일 TTL → 만료/부재 시 Firecrawl로 검색→단일 후보일 때만 평점/요약 수집→upsert. 모호하면 딥링크만.

**Files:**
- Modify: `apps/api/src/companies/companies.service.ts`
- Modify: `apps/api/src/companies/companies.module.ts`
- Create: `apps/api/src/companies/jobplanet.util.ts`
- Create: `apps/api/src/companies/jobplanet.util.test.ts`
- Create: `apps/api/src/companies/companies.service.test.ts`

**Interfaces:**
- Consumes: `FirecrawlService` (SharedModule, Task 1), `PrismaService`, `@joblog/types` `CompanyReviewDto`.
- Produces: `extractCandidates(markdown): { id: string; name: string; url: string }[]`, `extractRating(markdown): number | null`, `extractSummary(markdown): string | null`. `CompaniesService.getReviews(nameRaw): Promise<CompanyReviewDto>` (생성자 `(prisma, firecrawl)`).

> 주의: 잡플래닛 마크다운 포맷은 실연동 시 조정이 필요하다(task.md 백로그). 아래 추출기는 합성 입력으로 테스트되는 **휴리스틱**이며, 실패는 전부 딥링크로 폴백한다.

- [ ] **Step 1: 추출기 실패 테스트 작성**

Create `apps/api/src/companies/jobplanet.util.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCandidates, extractRating, extractSummary } from './jobplanet.util';

const SEARCH_MD = `
검색 결과
[카카오](https://www.jobplanet.co.kr/companies/123456/info/kakao)
[카카오게임즈](https://www.jobplanet.co.kr/companies/789012/info/kakaogames)
`;

const SINGLE_MD = `
검색 결과
[카카오](https://www.jobplanet.co.kr/companies/123456/info/kakao)
`;

const COMPANY_MD = `
카카오 기업정보
총 평점 3.7
한줄평: 복지가 좋고 성장할 수 있는 회사입니다.
`;

test('검색 마크다운에서 회사 후보를 중복 제거해 추출', () => {
  const c = extractCandidates(SEARCH_MD);
  assert.equal(c.length, 2);
  assert.equal(c[0].id, '123456');
  assert.equal(c[0].name, '카카오');
});

test('단일 후보를 정확히 1개로 반환', () => {
  assert.equal(extractCandidates(SINGLE_MD).length, 1);
});

test('회사 페이지에서 평점을 뽑는다', () => {
  assert.equal(extractRating(COMPANY_MD), 3.7);
});

test('평점이 없으면 null', () => {
  assert.equal(extractRating('평점 정보 없음'), null);
});

test('한줄평 요약을 뽑는다', () => {
  assert.ok(extractSummary(COMPANY_MD)?.includes('복지가 좋고'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --import tsx --test apps/api/src/companies/jobplanet.util.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 3: 추출기 구현**

Create `apps/api/src/companies/jobplanet.util.ts`:

```ts
const COMPANY_LINK = /\[([^\]]+)\]\((https:\/\/www\.jobplanet\.co\.kr\/companies\/(\d+)[^)]*)\)/g;

/** 검색 결과 마크다운에서 잡플래닛 회사 후보 추출(회사 id 기준 중복 제거). */
export function extractCandidates(
  markdown: string,
): { id: string; name: string; url: string }[] {
  const out: { id: string; name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of markdown.matchAll(COMPANY_LINK)) {
    const [, name, url, id] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: name.trim(), url });
  }
  return out;
}

/** 회사 페이지 마크다운에서 공개 평점(0~5) 추출. 못 찾으면 null. */
export function extractRating(markdown: string): number | null {
  const m = markdown.match(/(?:총\s*평점|평점|별점)\s*([0-5](?:\.\d)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

/** 공개 한줄평/요약 한 줄 추출(전체 후기 본문은 수집하지 않음). 못 찾으면 null. */
export function extractSummary(markdown: string): string | null {
  const m = markdown.match(/(?:한줄평|기업\s*소개)\s*[:：]?\s*(.+)/);
  if (!m) return null;
  const line = m[1].trim();
  return line.length ? line.slice(0, 200) : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `node --import tsx --test apps/api/src/companies/jobplanet.util.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: CompaniesService 확장 테스트 작성**

Create `apps/api/src/companies/companies.service.test.ts`:

```ts
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { CompaniesService } from './companies.service';

function deps(opts: {
  cache?: any;
  firecrawlEnabled?: boolean;
  scrapeMap?: Record<string, string>;
}) {
  const prisma = {
    companyReview: {
      findUnique: mock.fn(async () => opts.cache ?? null),
      upsert: mock.fn(async () => ({})),
    },
  } as any;
  const firecrawl = {
    get enabled() {
      return opts.firecrawlEnabled ?? true;
    },
    scrape: mock.fn(async (url: string) => opts.scrapeMap?.[url] ?? null),
  } as any;
  return { prisma, firecrawl };
}

const SEARCH_URL = 'https://www.jobplanet.co.kr/search?query=%EC%B9%B4%EC%B9%B4%EC%98%A4';

test('신선한 캐시는 그대로 반환하고 스크래핑하지 않는다', async () => {
  const { prisma, firecrawl } = deps({
    cache: { companyName: '카카오', rating: 3.9, summary: '좋음', sourceUrl: 'u', fetchedAt: new Date() },
  });
  const svc = new CompaniesService(prisma, firecrawl);
  const r = await svc.getReviews('(주)카카오');
  assert.equal(r.rating, 3.9);
  assert.equal(firecrawl.scrape.mock.callCount(), 0);
});

test('Firecrawl 비활성이면 딥링크만 반환', async () => {
  const { prisma, firecrawl } = deps({ firecrawlEnabled: false });
  const svc = new CompaniesService(prisma, firecrawl);
  const r = await svc.getReviews('카카오');
  assert.equal(r.rating, null);
  assert.ok(r.sourceUrl.includes('jobplanet'));
});

test('단일 후보면 평점을 수집해 upsert', async () => {
  const { prisma, firecrawl } = deps({
    scrapeMap: {
      [SEARCH_URL]: '[카카오](https://www.jobplanet.co.kr/companies/123/info/k)',
      'https://www.jobplanet.co.kr/companies/123/info/k': '총 평점 3.7\n한줄평: 좋아요',
    },
  });
  const svc = new CompaniesService(prisma, firecrawl);
  const r = await svc.getReviews('카카오');
  assert.equal(r.rating, 3.7);
  assert.equal(prisma.companyReview.upsert.mock.callCount(), 1);
});

test('후보가 복수면 수집/저장하지 않고 딥링크만', async () => {
  const { prisma, firecrawl } = deps({
    scrapeMap: {
      [SEARCH_URL]:
        '[카카오](https://www.jobplanet.co.kr/companies/1/info/a)\n[카카오게임즈](https://www.jobplanet.co.kr/companies/2/info/b)',
    },
  });
  const svc = new CompaniesService(prisma, firecrawl);
  const r = await svc.getReviews('카카오');
  assert.equal(r.rating, null);
  assert.equal(prisma.companyReview.upsert.mock.callCount(), 0);
});
```

> 참고: 세 번째 테스트의 검색 URL 키는 `encodeURIComponent('카카오')` 결과(`%EC%B9%B4%EC%B9%B4%EC%98%A4`)와 일치해야 한다. `normalize('카카오') === '카카오'` 이므로 서비스가 만드는 `sourceUrl`과 동일하다.

- [ ] **Step 6: 실패 확인**

Run: `node --import tsx --test apps/api/src/companies/companies.service.test.ts`
Expected: FAIL (생성자 시그니처 불일치/의존성 없음)

- [ ] **Step 7: CompaniesService 구현 교체**

`apps/api/src/companies/companies.service.ts` 전체를 다음으로:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { CompanyReviewDto } from '@joblog/types';
import { PrismaService } from '../prisma/prisma.service';
import { FirecrawlService } from '../shared/firecrawl.service';
import { extractCandidates, extractRating, extractSummary } from './jobplanet.util';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private firecrawl: FirecrawlService,
  ) {}

  /** 회사명 정규화: 법인 접미사·여분 공백 제거 (spec 6.1) */
  normalize(name: string): string {
    return (name ?? '')
      .replace(/\(주\)|\(유\)|주식회사|유한회사|㈜/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 기업 후기 조회 (M4, best-effort).
   * 캐시(7일) → Firecrawl 검색 → 단일 후보일 때만 공개 평점·요약 수집 → upsert.
   * 모호(0/복수)하거나 실패하면 딥링크만 반환(spec 6.1).
   */
  async getReviews(nameRaw: string): Promise<CompanyReviewDto> {
    const name = this.normalize(nameRaw);
    const sourceUrl = `https://www.jobplanet.co.kr/search?query=${encodeURIComponent(name)}`;

    const cached = await this.prisma.companyReview.findUnique({
      where: { companyName: name },
    });
    if (cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS) {
      return {
        companyName: name,
        rating: cached.rating,
        summary: cached.summary,
        sourceUrl: cached.sourceUrl ?? sourceUrl,
      };
    }

    const fallback: CompanyReviewDto = { companyName: name, rating: null, summary: null, sourceUrl };
    if (!this.firecrawl.enabled) return fallback;

    try {
      const searchMd = await this.firecrawl.scrape(sourceUrl);
      if (!searchMd) return fallback;

      const candidates = extractCandidates(searchMd);
      if (candidates.length !== 1) return fallback; // 모호하면 딥링크만

      const companyUrl = candidates[0].url;
      const companyMd = await this.firecrawl.scrape(companyUrl);
      if (!companyMd) return fallback;

      const rating = extractRating(companyMd);
      const summary = extractSummary(companyMd);

      await this.prisma.companyReview.upsert({
        where: { companyName: name },
        create: { companyName: name, rating, summary, sourceUrl: companyUrl, fetchedAt: new Date() },
        update: { rating, summary, sourceUrl: companyUrl, fetchedAt: new Date() },
      });

      return { companyName: name, rating, summary, sourceUrl: companyUrl };
    } catch (e) {
      this.logger.warn(`잡플래닛 수집 실패: ${String(e)}`);
      return fallback;
    }
  }
}
```

- [ ] **Step 8: CompaniesModule 수정**

`apps/api/src/companies/companies.module.ts` 를 다음으로:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [AuthModule, SharedModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
```

- [ ] **Step 9: 검증 (test + typecheck + build)**

Run: `pnpm --filter @joblog/api test && pnpm --filter @joblog/api typecheck && pnpm --filter @joblog/api build`
Expected: 전부 성공(신규 9 tests 포함).

- [ ] **Step 10: 커밋**

```bash
git add apps/api/src/companies apps/api/src/shared
git commit -m "feat(api): 잡플래닛 평점 best-effort 스크래핑 + 7일 캐시"
```

---

### Task 12: 프론트 후기 위젯에 요약(summary) 표시

**Files:**
- Modify: `apps/web/app/applications/[id]/page.tsx`

- [ ] **Step 1: 요약 렌더 추가**

기존 기업 후기 `<div className="rounded-xl ...">` 블록(평점/딥링크)을 다음으로 교체:

```tsx
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div>
            {reviews.data?.rating != null ? (
              <span className="font-semibold">★ {reviews.data.rating}</span>
            ) : (
              <span className="text-slate-500">
                평점 정보를 바로 가져올 수 없어요.
              </span>
            )}
            {reviews.data?.sourceUrl && (
              <a
                href={reviews.data.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2 text-brand hover:underline"
              >
                잡플래닛에서 보기 ↗
              </a>
            )}
          </div>
          {reviews.data?.summary && (
            <p className="mt-2 text-slate-600">{reviews.data.summary}</p>
          )}
        </div>
```

- [ ] **Step 2: 빌드/타입체크**

Run: `pnpm --filter @joblog/web build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add "apps/web/app/applications/[id]/page.tsx"
git commit -m "feat(web): 기업 후기 위젯에 요약 표시"
```

---

### Task 13: 문서 갱신 (task.md · spec.md)

**Files:**
- Modify: `task.md`
- Modify: `spec.md`

- [ ] **Step 1: task.md M4 체크박스 갱신**

`task.md` M4 섹션에서 완료 항목을 `[x]` 로:

- `[x] 잡플래닛 공개 평점·요약 best-effort 스크래핑 + 캐시 TTL`
- `[x] 마감·면접 임박 알림 (이메일/Resend, D-1)`
- `[x] 캘린더 뷰`

- [ ] **Step 2: spec.md 에 신규 API/모델 반영**

5절 API 표에 행 추가:

```
| GET | `/calendar` | ✓ | 마감·단계 예정일을 이벤트로 집계 (`?from=&to=`) |
```

2.1 엔티티 표에 `SentNotification`(알림 중복 방지) 추가. 8절 환경변수에 `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL` 추가. 6절에 "공개 평점·요약은 Firecrawl best-effort 수집, 7일 TTL 캐시, 후보 모호 시 딥링크" 한 줄 보강. 알림(D-1, 09:00 KST, 이메일/Resend) 섹션 간단 명시.

- [ ] **Step 3: 커밋**

```bash
git add task.md spec.md
git commit -m "docs: M4 완료 반영 (캘린더·알림·스크래핑)"
```

---

## Self-Review

**Spec coverage:**
- A-1 Firecrawl 공유화 → Task 1 ✓
- A-2 단계 일정 입력 UI → Task 2 ✓
- B 캘린더 타입/API/뷰 → Task 3/4/5 ✓
- C 알림 의존성·모델/Mailer/KST유틸/Service·cron/모듈·env → Task 6/7/8/9/10 ✓
- D 스크래핑 추출·캐시 서비스/요약표시 → Task 11/12 ✓
- 문서 갱신 → Task 13 ✓
- 테스트 전략(집계·멱등성·스크래핑 분기) → Task 4/9/11 단위 테스트(기존 `node:test` 하네스) ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD/TODO/적절히 처리" 없음.

**Type consistency:** `CalendarEvent`(types) ↔ api `calendar.util.ts` 구조 일치. `CompanyReviewDto`(types) ↔ `CompaniesService.getReviews` 반환 일치(`rating: number|null`, `summary: string|null`). `SentNotification` 복합 유니크 키 접근자 `userId_kind_refId_sendDate` 를 service와 테스트에서 동일 사용. `kstDayRange(now, dayOffset)` 시그니처 Task 8 정의 ↔ Task 9 사용 일치. `FirecrawlService.enabled/scrape` Task 1 ↔ Task 11 사용 일치. 생성자 주입 순서 `CompaniesService(prisma, firecrawl)`, `NotificationsService(prisma, mailer)` 를 테스트와 모듈 등록에서 동일 사용.

**하네스 정합성:** 테스트는 전부 `*.test.ts` + `node:test`/`node:assert`(기존 `score.test.ts`와 동일 스타일). 새 러너 미도입. 각 api 작업 커밋 전 `typecheck && test` 를 돌려 Stop 훅(`verify.sh`) 게이트와 일치시킴.

## 알려진 한계 / 후속

- 잡플래닛 마크다운 추출기(Task 11)는 휴리스틱 — 실제 `FIRECRAWL_API_KEY` 연결 후 셀렉터/정규식 튜닝 필요(task.md 백로그).
- 프론트는 컴포넌트 테스트 하네스가 없어 빌드+수동 검증으로 둔다(도입은 범위 밖). web은 `test` 스크립트가 없어 루트 `pnpm -r --if-present test` 에서 자동 skip.
- cron 서버 타임존은 `@Cron({ timeZone: 'Asia/Seoul' })`로 고정 — 배포 환경 TZ와 무관.
- `@nestjs/schedule`/`resend` 메이저 버전(`^4`)은 설치 시점 최신과 다를 수 있다 — peer 경고 시 NestJS 10 호환 버전으로 조정.
