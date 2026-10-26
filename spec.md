# JobLog — 기술 스펙 (spec.md)

> v0.1 (MVP) · 2026-10-26 · 기획서: `docs/planning.html`

구직 공고 지원 현황을 추적하는 다중 사용자 웹 서비스의 기술 명세. 구현의 단일 기준(source of truth)으로 삼고, 변경 시 이 문서와 `task.md`를 함께 갱신한다.

---

## 1. 시스템 구성

```
Next.js (web) ──REST/JSON──> NestJS (api) ──Prisma──> PostgreSQL
                                  ├── Kakao OAuth   (로그인)
                                  ├── Firecrawl     (공고 링크 → 본문)
                                  ├── Claude API    (본문 → 구조화 JSON)
                                  └── Jobplanet      (기업 후기, M4, best-effort)
```

- 프론트는 api와만 통신한다. 외부 연동 키는 전부 api 뒤에 둔다.
- 인증은 자체 발급 JWT(access/refresh). 카카오는 최초 신원 확인에만 사용.

---

## 2. 도메인 모델

### 2.1 엔티티

| 엔티티 | 설명 | 관계 |
|--------|------|------|
| `User` | 카카오로 로그인한 사용자 | 1:N Application |
| `Application` | 하나의 지원 = 회사 하나 | N:1 User, 1:N Stage, 1:N StatusLog |
| `Stage` | 전형 단계(서류/코테/면접…) | N:1 Application |
| `StatusLog` | 상태 변경 이력 | N:1 Application |
| `CompanyReview` | 기업 후기 캐시 (M4) | 독립 |

Prisma 스키마 전문은 `docs/planning.html` 06 섹션 및 `apps/api/prisma/schema.prisma`.

### 2.2 상태 enum

```
AppStatus   = IN_PROGRESS | OFFER | REJECTED | CLOSED
StageStatus = PENDING | IN_PROGRESS | PASSED | FAILED
```

### 2.3 전체 상태 파생 규칙 (중요)

`Application.status`는 **저장하되 단계 상태로부터 계산해 갱신**한다. 단계가 바뀔 때마다 재계산:

1. 사용자가 `CLOSED`(철회)로 지정 → 그대로 `CLOSED`.
2. 하나라도 `FAILED` → `REJECTED`.
3. `order`가 가장 큰(마지막) 단계가 `PASSED` → `OFFER`.
4. 그 외 → `IN_PROGRESS`.

> 단일 소스 원칙: 단계 상태가 진실이고 전체 상태는 그 투영(projection)이다. 둘이 어긋나면 단계 기준으로 재계산한다.

### 2.4 전형 단계는 가변이다 (중요)

- 전형 구성은 **회사마다 다르다.** 고정 enum/목록으로 두지 않는다.
  - 예: `서류 → 1차 면접 → 2차 컬쳐핏 면접 → 처우협의`
  - 예: `서류 → 과제 → 임원면접`
  - 예: `서류 → 코딩테스트 → 1차 면접 → 2차 면접 → 최종`
- `Stage.name`은 **자유 문자열**이다. AI가 공고에서 실제 명칭(예: "2차 컬쳐핏 면접")을 그대로 추출하고, 사용자가 추가·삭제·순서변경(`order`)·이름수정으로 보정한다.
- 공고에서 전형을 못 뽑으면 기본 단계(`서류 → 면접 → 최종`)를 넣고 `confidence: "low"`로 보정을 유도한다.
- (M2+) 자주 쓰는 구성을 빠르게 넣도록 **프리셋**(개발 직군형, 일반형 등)을 제공할 수 있다 — 어디까지나 편의 기능이며, 프리셋 선택 후에도 자유 편집이 원칙이다.

---

## 3. 인증 (Kakao + JWT)

### 3.1 흐름

1. 프론트가 카카오 인가 페이지로 리다이렉트.
2. 카카오 콜백(`GET /auth/kakao/callback?code=`)을 **api가 수신**.
3. api가 code로 카카오 토큰·프로필 조회 → `kakaoId`로 User 조회, 없으면 생성.
4. 자체 access token(짧음) + refresh token(김) 발급. refresh는 httpOnly 쿠키, access는 응답 바디 또는 메모리.
5. 이후 요청은 `Authorization: Bearer <access>`.

### 3.2 인가

- `/auth/*`, `/companies/reviews`를 제외한 모든 라우트는 JWT 가드 적용.
- `/applications/:id` 계열은 `application.userId === req.user.id`를 추가 검증(소유권). 불일치 시 404(존재 노출 방지).

---

## 4. 공고 파싱 파이프라인

### 4.1 입력 (링크 우선, 붙여넣기 폴백)

`POST /applications/parse`

```jsonc
// 1순위: 링크
{ "url": "https://.../job/12345" }
// 폴백: 본문 직접
{ "rawText": "채용 공고 전문..." }
```

### 4.2 처리 단계

1. `url`이 오면 **Firecrawl**로 스크래핑 → 본문 텍스트/마크다운 확보.
   - 실패(차단·빈 본문·타임아웃) 시 `needsManualInput: true`로 응답 → 프론트가 "본문 붙여넣기" 창 노출.
2. 확보한 텍스트를 **Claude API**에 구조화 프롬프트로 전달. **JSON 스키마를 강제**해 아래 형태만 받는다.
3. 받은 JSON을 서버에서 검증(필드 타입·전형 순서) 후 **초안(draft)** 으로 반환. 이 단계에서 DB 저장은 안 함.
4. 사용자가 보정 후 `POST /applications`로 확정 저장.

### 4.3 파싱 결과 스키마 (Claude 강제 출력)

```ts
// packages/types
interface ParsedPosting {
  companyName: string;
  position: string;
  location?: string;
  employmentType?: string;      // 정규직 | 인턴 | 계약직 ...
  deadline?: string;            // ISO date, 없으면 생략
  stages: { name: string; order: number }[];  // 전형 단계 (추출 못하면 기본값 제공)
  confidence: "high" | "low";   // 낮으면 프론트가 보정 유도
}
```

- 전형 단계를 전혀 못 뽑으면 기본 단계(`서류 → 면접 → 최종`)를 넣고 `confidence: "low"`.

---

## 5. API 계약

> 모든 응답은 JSON. 에러는 `{ statusCode, message, code }` 형태.

| Method | Path | 인증 | 설명 |
|--------|------|:---:|------|
| GET | `/auth/kakao/callback` | - | 카카오 콜백 → JWT 발급 |
| GET | `/auth/me` | ✓ | 로그인 사용자 정보 |
| POST | `/auth/refresh` | 쿠키 | access token 재발급 |
| POST | `/applications/parse` | ✓ | 링크/본문 → 파싱 초안 반환 (저장 X) |
| POST | `/applications` | ✓ | 보정된 초안으로 지원 생성 |
| GET | `/applications` | ✓ | 내 지원 목록 (`?status=` 필터, 정렬) |
| GET | `/applications/:id` | ✓ | 지원 상세 (stages 포함) |
| PATCH | `/applications/:id` | ✓ | 회사·직무·메모 등 수정 |
| DELETE | `/applications/:id` | ✓ | 지원 삭제 |
| PATCH | `/applications/:id/stages/:stageId` | ✓ | 단계 상태·일정 갱신 → 전체 상태 재계산 |
| POST | `/applications/:id/stages` | ✓ | 단계 추가 |
| DELETE | `/applications/:id/stages/:stageId` | ✓ | 단계 삭제 |
| GET | `/companies/reviews?name=` | ✓ | 기업 후기 평점·요약 (M4, best-effort) |
| GET | `/dashboard/stats` | ✓ | 지원 수·진행중·합격·탈락 통계 |

### 5.1 주요 DTO (요약)

```ts
// POST /applications  (파싱 초안 보정 후 확정)
interface CreateApplicationDto {
  companyName: string;
  position: string;
  jobUrl?: string;
  rawPosting?: string;
  location?: string;
  employmentType?: string;
  deadline?: string;
  appliedAt?: string;
  memo?: string;
  stages: { name: string; order: number }[];
}

// PATCH /applications/:id/stages/:stageId
interface UpdateStageDto {
  status?: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED";
  scheduledAt?: string;   // 면접·발표 예정일
  completedAt?: string;
}
```

---

## 6. 기업 후기 (잡플래닛, M4, best-effort)

- `GET /companies/reviews?name=` — 공고에서 추출한 회사명으로 조회.
- 서버는 `CompanyReview` 캐시 확인 → 없거나 오래되면(예: 7일) best-effort로 공개 평점·요약만 갱신.
- **제약**: 잡플래닛은 로그인·블러·ToS 제한이 있어 전체 후기 본문은 수집/저장하지 않는다.
- 응답은 `{ rating?, summary?, sourceUrl }`. 아무것도 못 얻으면 `sourceUrl`(검색 딥링크)만 반환해 "잡플래닛에서 보기"로 연결.
- 프론트는 이 기능이 비어 있어도 지원 상세가 정상 동작해야 한다(선택적 위젯).

### 6.1 회사명 정규화 · 매칭 (entity resolution)

공고의 회사명과 잡플래닛의 회사 항목이 정확히 일치하지 않을 수 있으므로 중간 단계를 둔다.

1. **정규화**: 법인 접미사·공백 제거 등으로 키 생성. 예: `(주)카카오`, `카카오(주)` → `카카오`, `삼성전자(주)` → `삼성전자`.
2. **매칭**: 정규화 키로 잡플래닛 검색 → 후보 목록 확보.
   - 후보가 명확히 1개로 좁혀지면 그 회사 페이지에서 공개 평점·요약을 best-effort로 수집.
   - **모호하면(0개 또는 복수·동명 회사) 자동 표시하지 않고** 검색 딥링크(`sourceUrl`)만 반환해 사용자가 직접 고르게 한다.
3. 캐시는 **정규화 키 기준**으로 저장(`CompanyReview.companyName` = 정규화 키)해 표기 변형이 같은 캐시를 공유하게 한다.

> 원칙: 잘못된 회사를 자신 있게 보여주느니, 모호하면 링크로 넘긴다. 엔티티 해소 실패가 오정보가 되면 안 된다.

---

## 7. 에러 처리 / 폴백

| 상황 | 동작 |
|------|------|
| Firecrawl 수집 실패 | `needsManualInput: true` → 본문 붙여넣기 폴백 |
| Claude 파싱 실패/스키마 불일치 | 재시도 1회 → 실패 시 빈 초안 + `confidence: low`로 수동 입력 유도 |
| 잡플래닛 조회 실패 | 위젯 숨기거나 딥링크만 표시 (지원 상세는 정상) |
| 소유권 불일치 | 404 |
| 토큰 만료 | 401 → 프론트가 refresh 시도 |

---

## 8. 환경 변수

```
# apps/api/.env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
KAKAO_REDIRECT_URI=...
ANTHROPIC_API_KEY=...        # Claude API
FIRECRAWL_API_KEY=...
WEB_ORIGIN=http://localhost:3000   # CORS

# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## 9. 비기능 요건 (MVP 수준)

- **보안**: 외부 키 서버 전용, CORS는 `WEB_ORIGIN`만 허용, refresh는 httpOnly 쿠키.
- **비용**: 공고 1건 파싱 ≈ Claude 토큰 소량 + Firecrawl 1크레딧. 파싱 결과는 재요청 방지를 위해 draft 단계에서만 호출.
- **성능**: 파싱은 수 초 소요 → 프론트는 로딩 상태 표시, 낙관적 UI 지양.
- **테스트**: 상태 파생 규칙(2.3)과 파싱 결과 검증은 단위 테스트 필수.
