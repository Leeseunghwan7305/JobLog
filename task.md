# JobLog — 작업 목록 (task.md)

> 기준 문서: `spec.md`, `docs/planning.html` · 완료 시 `[x]` 체크
> 전략: MVP를 최단 경로로(M1→M2) 세우고, AI 자동화(M3)와 후기·알림(M4)을 뒤에 붙인다.
>
> **현황 (2026-10-26):** M1~M3의 코드가 모두 구현·빌드·엔드투엔드 검증 완료. 남은 것은 배포 파이프라인, 정식 테스트 코드, M4.

---

## M1 — 기반 구축

- [x] pnpm 모노레포 초기화 (`apps/web`, `apps/api`, `packages/types`)
- [x] `apps/web` Next.js(App Router) + TypeScript + Tailwind 세팅
- [x] `apps/api` NestJS + TypeScript 세팅
- [x] PostgreSQL 연결 (로컬 Docker `docker-compose.yml`, 포트 5433)
- [x] Prisma 설치 + `schema.prisma` 작성 (User/Application/Stage/StatusLog/CompanyReview) + 최초 migrate
- [x] 카카오 OAuth (REST 코드 플로우) — REST 키는 서버 전용
- [x] JWT 발급·검증 + 인증 가드 (`JwtAuthGuard`)
- [x] 프론트 로그인 페이지(카카오 버튼) + 콜백 처리 + 토큰 저장
- [x] `GET /auth/me` 연동, 보호 라우트 리다이렉트
- [x] `packages/types` 공유 타입 세팅 (web에서 import)
- [x] CORS·환경변수 정리 (`.env` / `.env.example`)
- [ ] 배포 파이프라인 구성 (Vercel / Railway) — 아직

## M2 — 핵심 CRUD & 상태 추적

- [x] 지원 등록 폼 + `POST /applications`
- [x] 지원 목록 `GET /applications` (상태 필터) + React Query
- [x] 지원 상세 `GET /applications/:id` (전형 단계 포함)
- [x] 지원 수정 `PATCH` / 삭제 `DELETE`
- [x] 전형 단계 추가·삭제·순서·이름수정 (자유 문자열 명칭 지원)
- [x] 단계 상태 토글 `PATCH .../stages/:stageId`
- [x] **전체 상태 파생 계산 로직** (spec 2.3) — 엔드투엔드 검증 완료
- [x] `StatusLog` 기록(상태 변경 이력)
- [x] 칸반 보드 뷰 (진행중/최종합격/불합격/철회)
- [x] 대시보드 통계 `GET /dashboard/stats` + 위젯
- [x] 소유권 검증(본인 리소스만, 불일치 404)
- [ ] 상태 파생 로직 정식 단위 테스트 (현재 수동 검증만)

## M3 — 공고 자동 분석 (링크 우선)

- [x] Firecrawl 연동 서비스 (URL → 본문), 실패 감지
- [x] Claude API 연동 서비스 (본문 → `ParsedPosting`, tool로 JSON 강제)
- [x] 파싱 결과 서버 검증 + 기본 단계 폴백
- [x] `POST /applications/parse` (링크 우선, 실패 시 `needsManualInput`)
- [x] 프론트 "링크 붙여넣기 → 분석" 모달 + 로딩 상태
- [x] 수집 실패 시 "본문 붙여넣기" 폴백 전환
- [x] 파싱 초안 보정 폼 (회사·직무·전형 단계 편집) → 확정 저장
- [x] 키 부재 시 우아한 폴백 (앱이 죽지 않음) — 검증 완료
- [~] `ANTHROPIC_API_KEY` / `FIRECRAWL_API_KEY` 실제 연결 후 실공고 품질 튜닝
  - [x] 프롬프트·스키마 튜닝(인라인 전형 절차 추출, 마감일 `YYYY-MM-DD` 정규화, 전송 실패 1회 재시도) 반영
  - [x] 실공고 골든 픽스처를 평가 하니스(`pnpm --filter api parse:eval`, `src/parse/eval/`)에 추가 (원티드 인라인 절차·전용 섹션, 잡코리아 폴백)
  - [ ] **키 실제 연결 후 `parse:eval`로 품질 수치 검증 + 재튜닝** (현재 키 미연결 → 실호출 검증 대기)

## M4 — 후기 · 알림 · 인사이트

- [x] `CompanyReview` 캐시 모델 migrate (스키마)
- [x] 회사명 정규화 + 잡플래닛 딥링크 (`GET /companies/reviews`) — 검증 완료
- [x] 지원 상세 후기 위젯 (없으면 딥링크)
- [x] 잡플래닛 공개 평점·요약 best-effort 스크래핑 + 캐시 TTL(7일) — 정규화→후보해소(0/1/복수)→평점·요약 파싱, 모호/실패 시 딥링크 폴백. 파싱 로직 단위테스트 완료 (`jobplanet.test.ts`). 실공고 HTML 파싱 품질 튜닝은 FIRECRAWL_API_KEY 연결 후
- [x] 마감·면접 임박 D-3 이메일 알림 (Resend) — @Cron 매일 09:00 KST, `SentNotification` 멱등(중복 발송 차단), 키 없으면 콘솔 로그 폴백. `NOTIFY_DAYS_AHEAD`로 D-N 조정. 수동 트리거 `POST /notifications/run`. 날짜 유틸 단위테스트(`notifications.util.test.ts`). 실발송은 RESEND_API_KEY 연결 후
- [x] 캘린더 뷰 — 백엔드(`GET /calendar`, `toCalendarEvents`, 소유권 필터) + 프론트 월간 그리드(`/calendar`, 이전/다음 달, 마감/전형 이벤트 뱃지→상세 딥링크). 대시보드에 캘린더 링크
- [ ] 합격률·전형별 통계 인사이트
- [ ] 태그·메모 검색, 공고 아카이브

---

## 백로그 / 미결정

- [ ] 링크 스크래핑 대상 사이트별 안정성 점검 (원티드/잡코리아/사람인 등)
  - 세션 점검(Playwright/WebFetch): 원티드 공고 본문 접근 OK, 잡코리아 **데스크톱** `GI_Read`는 `socket hang up`으로 실패(모바일 `m.jobkorea`는 OK). Firecrawl v1(`firecrawl.service.ts`)로 실제 수집 성공률은 키 연결 후 재확인 필요.
- [ ] 잡플래닛 연동의 ToS·법적 범위 최종 확인
- [ ] 전형 단계 프리셋(개발 직군형·일반형 등) 제공 여부
- [ ] 드래그앤드롭으로 보드 상태 변경할지 여부
- [ ] 모바일 레이아웃 우선순위
- [ ] refresh token 도입 (현재 MVP는 7일 access token 단일)
- [ ] **수익 모델 계측** — 분석 1건당 토큰·Firecrawl 비용 로깅 (상한값을 데이터로 정하기 위한 선행 작업, spec §10.3)
- [ ] 수익 모델 결정 — 프리미엄+사용량 상한 / BYOK / 크레딧제 중 선택 (미구현, spec §10.2)
