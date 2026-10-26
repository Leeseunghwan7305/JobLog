# M4 설계 — 잡플래닛 평점 스크래핑 · 마감 알림 · 캘린더

> 2026-10-26 · 기준 문서: `spec.md`, `task.md` · 상태: 설계(구현 전)

M4의 세 기능(잡플래닛 공개 평점 best-effort 스크래핑 + 캐시, D-1 이메일 알림, 캘린더 뷰)의 구현 설계. `spec.md` 6절(기업 후기)·2.3절(상태 파생)·7절(폴백)을 따른다.

## 확정된 결정

| 항목 | 결정 |
|------|------|
| 알림 채널 | 이메일 (Resend) |
| 알림 시점 | D-1 단일 (마감일/면접일 하루 전) |
| 스크래핑 범위 | Firecrawl 실제 수집 + `CompanyReview` TTL 7일 캐시, 모호하면 딥링크 폴백 |
| 작업 순서 | A(공통) → B(캘린더) → C(알림) → D(스크래핑) |
| 알림 멱등성 | 신규 `SentNotification` 모델로 "보냈음" 영속화 |

## 설계 원칙 (spec 계승)

- 수집(Firecrawl)과 저장/표시는 분리. 외부 호출 실패는 삼키지 않되 **우아한 폴백**(딥링크, 콘솔 로그)으로 처리하고 핵심 플로우를 죽이지 않는다.
- 외부 키(Resend, Firecrawl)는 서버 전용. 키 부재 시 `enabled=false`로 비활성(기존 `FirecrawlService`/`ClaudeService` 패턴).
- 모든 조회는 JWT `userId`로 소유권 필터. 캘린더·알림도 본인 리소스만.
- 잡플래닛은 best-effort: 모호하면(0개/복수 후보) 자신 있게 틀린 정보를 보여주느니 딥링크로 넘긴다(spec 6.1).

---

## A. 공통 사전작업

### A-1. Firecrawl 공유화

현재 `FirecrawlService`는 `apps/api/src/parse/firecrawl.service.ts`에 있고 `ParseModule` 내부에서만 제공된다. 잡플래닛 스크래핑에서 재사용하려면 공유해야 한다.

- `apps/api/src/shared/shared.module.ts` 신설 → `FirecrawlService`를 `providers`+`exports`.
- 파일 이동: `parse/firecrawl.service.ts` → `shared/firecrawl.service.ts`.
- `ParseModule`·`CompaniesModule`이 `SharedModule`을 `imports`.
- `FirecrawlService` 인터페이스는 그대로 유지: `get enabled(): boolean`, `scrape(url): Promise<string | null>`.

### A-2. 단계 일정 입력 UI (캘린더/알림의 데이터 소스)

백엔드는 이미 `PATCH /applications/:id/stages/:stageId`로 `scheduledAt`을 받는다(`UpdateStageDto.scheduledAt?: string`). 하지만 프론트에 입력 UI가 없어 값이 항상 비어 있다.

- `apps/web/app/applications/[id]/page.tsx`의 Stage 섹션에 각 단계별 날짜/시간 입력(`<input type="datetime-local">`) 추가.
- 변경 시 기존 stage PATCH 뮤테이션 재사용, `['app', id]` 무효화.
- `completedAt`은 이번 범위 밖(상태 토글로 충분). `scheduledAt`만 노출.

---

## B. 캘린더 (읽기 전용 집계)

새 데이터 모델 없음. 기존 `Application.deadline` + `Stage.scheduledAt`을 이벤트로 투영한다.

### B-1. 공유 타입 (`packages/types`)

```ts
export type CalendarEventType = 'deadline' | 'stage';

export interface CalendarEvent {
  date: string;            // ISO date (YYYY-MM-DD 기준 그룹핑용 ISO datetime)
  type: CalendarEventType;
  applicationId: string;
  companyName: string;
  label: string;           // deadline: "서류 마감" / stage: 전형명(name)
  status?: StageStatus;    // type==='stage'일 때만
}
```

### B-2. API

`GET /calendar?from=<ISO>&to=<ISO>` (JWT 필수)

- `from`/`to`는 월 뷰 범위. 누락 시 기본값(이번 달 ±1개월).
- 로직: 본인 `Application` 중
  - `deadline`이 범위 내 → `{ type:'deadline', label:'서류 마감', ... }`
  - 각 `stage.scheduledAt`이 범위 내 → `{ type:'stage', label: stage.name, status, ... }`
- 응답: `CalendarEvent[]` (날짜 오름차순).
- 소유권: `where: { userId }`로 1차 필터 — 남의 지원은 조회 자체가 안 됨.
- 모듈: `ApplicationsModule`에 `GET /calendar` 핸들러 추가(별도 모듈 불필요, 같은 Prisma·소유권 맥락).

### B-3. 프론트

- 신규 페이지 `apps/web/app/calendar/page.tsx` — 월간 그리드.
- React Query 인라인: `useQuery(['calendar', from, to], () => apiFetch<CalendarEvent[]>(...))`.
- 날짜 셀에 이벤트 배지(회사명 + label). `deadline`과 `stage`는 색으로 구분. 배지 클릭 → `/applications/:id`.
- 이전/다음 달 네비게이션(`from`/`to` 상태). 모바일은 간소화 리스트 폴백은 이번 범위 밖(데스크톱 그리드 우선).
- 대시보드/상세에서 캘린더로 가는 링크 추가.

---

## C. 알림 (D-1 이메일, Resend)

### C-1. 의존성 / 등록

- `apps/api` 의존성 추가: `@nestjs/schedule`, `resend`.
- `app.module.ts`에 `ScheduleModule.forRoot()` + 신규 `NotificationsModule` 등록.

### C-2. MailerService (`apps/api/src/notifications/mailer.service.ts`)

- `resend` SDK 래핑. 패턴은 `FirecrawlService`와 동일.
- `get enabled(): boolean` → `!!process.env.RESEND_API_KEY`.
- `send({ to, subject, html }): Promise<boolean>` — 비활성이면 콘솔 로그 후 `false`, 성공 시 `true`, 예외는 로깅 후 `false`(삼키되 기록).
- 발신 주소는 `process.env.MAIL_FROM`.

### C-3. NotificationsService + cron

- `@Cron`으로 매일 1회 실행. 표현식은 서버 TZ 가정 하에 09:00 KST에 맞춘다(`ScheduleModule`의 `timeZone: 'Asia/Seoul'` 옵션 사용).
- 로직(멱등):
  1. "내일"(D-1) 날짜 구간 계산(KST 자정~자정).
  2. 해당 구간에 `deadline`이 있는 본인 지원 + `scheduledAt`이 있는 stage 조회(모든 유저 대상, `include: user`).
  3. 각 대상에 대해 `SentNotification`에 (userId, kind, refId, sendDate) 존재 확인 → 이미 있으면 skip.
  4. `user.email`이 null이면 skip(로그).
  5. `MailerService.send` 호출. **성공 시에만** `SentNotification` 기록(실패는 다음 cron에서 재시도 가능).
- 메일 본문: 회사명·전형명/마감·날짜 + `APP_BASE_URL`로 지원 상세 딥링크.
- 수동 트리거(개발/테스트용) `POST /notifications/run`(JWT, 본인 것만, dev 편의) — 선택. 기본은 cron.

### C-4. 멱등성 모델 (Prisma)

```prisma
model SentNotification {
  id        String   @id @default(cuid())
  userId    String
  kind      String   // "deadline" | "stage"
  refId     String   // applicationId(deadline) 또는 stageId(stage)
  sendDate  String   // "YYYY-MM-DD" (알림 발송 기준일)
  createdAt DateTime @default(now())

  @@unique([userId, kind, refId, sendDate])
}
```

- `@@unique`로 같은 대상·같은 날 중복 발송 차단(cron 재실행·배포 안전).
- migration 1건 추가.

### C-5. 환경변수 (`.env.example`)

```
RESEND_API_KEY=         # 없으면 메일 비활성(콘솔 로그 폴백)
MAIL_FROM=JobLog <no-reply@example.com>
APP_BASE_URL=http://localhost:3000   # 메일 내 링크
```

---

## D. 잡플래닛 스크래핑 (best-effort + 캐시)

`CompaniesService.getReviews`를 확장한다. 현재는 딥링크만 반환.

### D-1. 모듈/의존성

- `CompaniesModule`이 `SharedModule`(A-1)·`PrismaModule` import. `CompaniesService`에 `FirecrawlService`·`PrismaService` 주입.
- 로컬 중복 `CompanyReviewDto` 제거 → `@joblog/types`의 공유 타입 사용.

### D-2. 흐름

1. `normalize(name)`로 정규화 키 생성(기존 로직 유지).
2. `CompanyReview` 캐시 조회(`companyName` = 정규화 키).
   - 존재 & `fetchedAt`이 7일 이내 → 그대로 반환.
3. 만료/부재 시 best-effort 수집:
   - Firecrawl `enabled=false`면 수집 스킵 → 딥링크만 반환.
   - 잡플래닛 **검색 결과 페이지** 수집 → 마크다운에서 회사 후보 링크 추출.
   - **정확히 1개**로 좁혀지면 그 회사 페이지 수집 → 공개 평점(별점)·짧은 요약 파싱 → `CompanyReview` upsert(`rating`, `summary`, `sourceUrl`, `fetchedAt: now`).
   - **0개/복수(동명)**면 저장하지 않고 딥링크만 반환(spec 6.1).
4. 수집·파싱 예외는 로깅 후 딥링크 폴백. `rating`/`summary` null이어도 정상 응답.

### D-3. 응답 (`CompanyReviewDto`, 변경 없음)

`{ companyName(정규화 키), rating: number|null, summary: string|null, sourceUrl }` — `sourceUrl`은 항상 존재(검색 딥링크).

### D-4. 프론트

- 상세 후기 위젯(`applications/[id]/page.tsx`)에 `summary` 표시 추가(현재 rating만 렌더). null-safe, 없으면 숨김. 딥링크는 유지.

---

## 테스트 전략

- **캘린더 집계**: 범위 경계(from/to 포함·제외), 소유권 필터(남의 지원 제외), deadline/stage 혼합 → 단위 테스트.
- **알림 멱등성**: 같은 날 두 번 실행 시 1회만 발송(`SentNotification` 중복 차단), `email` null skip, Mailer 비활성 시 기록 안 함 → 단위 테스트(Mailer·Prisma 모킹).
- **스크래핑**: 후보 0/1/복수 분기, 캐시 신선/만료 분기, Firecrawl 비활성 폴백 → Firecrawl 모킹 단위 테스트.
- 외부 호출(Firecrawl, Resend)은 전부 모킹. 실제 잡플래닛 HTML 파싱 품질은 실키 연결 후 수동 튜닝(task.md).

## 에러 처리 / 폴백 요약

| 상황 | 동작 |
|------|------|
| Firecrawl 비활성/수집 실패 | 평점 없이 딥링크만 반환, 상세 정상 |
| 후보 모호(0/복수) | 저장 안 함, 딥링크 반환 |
| Resend 비활성/발송 실패 | 콘솔 로그, `SentNotification` 미기록(재시도 여지) |
| `user.email` null | 알림 skip(로그) |
| cron 중복 실행 | `SentNotification @@unique`로 1회만 |

## 영향받는 파일 (요약)

- **신규**: `apps/api/src/shared/shared.module.ts`, `apps/api/src/notifications/{notifications.module,notifications.service,mailer.service}.ts`, `apps/web/app/calendar/page.tsx`, Prisma migration(SentNotification).
- **수정**: `firecrawl.service.ts` 이동, `parse.module.ts`, `companies.{module,service}.ts`, `applications.{controller,service}.ts`(+calendar), `app.module.ts`, `packages/types/src/index.ts`, `apps/web/app/applications/[id]/page.tsx`, `apps/api/prisma/schema.prisma`, `.env.example`.
- **문서**: `task.md`(M4 체크박스), `spec.md`(캘린더·알림 API·SentNotification 반영).

## 범위 밖 (이번 M4 아님)

사용자별 알림 시점/온오프 설정, 이메일 재입력 UI, 잡플래닛 Claude 요약, 합격률·전형별 인사이트, 태그·메모 검색, 공고 아카이브, 모바일 캘린더 전용 레이아웃.
