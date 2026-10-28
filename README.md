# JobLog

**구직 현황 추적 서비스.** 채용 공고 링크를 붙여넣으면 AI가 회사·직무·전형 절차를 자동 추출하고, 서류부터 최종 면접까지 각 전형의 상태(대기/진행중/합격/탈락)를 한곳에서 관리한다. 카카오 로그인 기반 다중 사용자 서비스.

- 상세 기획: [`docs/planning.html`](docs/planning.html)
- 기술 스펙: [`spec.md`](spec.md) · 작업 목록: [`task.md`](task.md)
- 배포 가이드: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- 에이전트 작업 가이드: [`CLAUDE.md`](CLAUDE.md)

## 주요 기능

- **공고 자동 분석** — 공고 링크를 붙여넣으면 Firecrawl로 본문을 수집하고 LLM이 회사·직무·전형 단계를 추출한다. 수집/파싱이 실패해도 **본문 붙여넣기 폴백**으로 등록은 항상 가능하다.
- **전형 상태 관리** — 서류·코딩테스트·1차/2차 면접 등 단계별 상태를 추적한다. 지원 전체 상태는 단계 상태에서 **파생 계산**한다(중복 저장 없음).
- **AI는 초안, 최종 권한은 사용자** — 파싱 결과는 언제든 사용자가 보정할 수 있다.
- **회사 정보 패널** — 공공데이터포털 국민연금 가입사업장 데이터로 직원 수·입퇴사·추정 연봉·회전율·업력·업종 등을 조회한다(키 없으면 바로가기 링크만 노출).
- **카카오 로그인** — 모든 `/applications/*` 요청은 JWT의 userId로 본인 리소스인지 소유권을 검증한다.
- **마감 알림** — 마감 임박 공고를 이메일로 알린다(Resend, 키 없으면 콘솔 로그 폴백).

## 기술 스택

| 영역          | 기술                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Frontend      | Next.js (App Router), TypeScript, TanStack Query, shadcn/ui, Tailwind CSS |
| Backend       | NestJS, Prisma, PostgreSQL, Passport (Kakao + JWT)                        |
| 외부 연동     | Firecrawl(스크래핑), LLM(파싱: Ollama/Groq/Anthropic 라우팅), 국민연금 공개데이터 |
| 패키지 매니저 | pnpm (workspace 모노레포)                                                 |

## 저장소 구조

```
JobLog/
├── apps/
│   ├── web/                # Next.js 프론트엔드 (포트 3000, alias @/* → ./src/*)
│   └── api/                # NestJS 백엔드 (포트 4000)
│       └── prisma/         # schema.prisma, migrations
├── packages/               # 공통으로 묶는다
│   ├── types/              # web·api 공유 타입 (source of truth)
│   ├── tsconfig/           # 공유 tsconfig
│   ├── eslint-config/      # 공유 ESLint (타입 인지·빡세게)
│   └── prettier-config/    # 공유 Prettier
├── docker-compose.yml      # 로컬 PostgreSQL (joblog-db, 포트 5434)
└── docs/ · spec.md · task.md · CLAUDE.md
```

## 빠른 시작

**사전 요구사항**: Node.js, pnpm 11+, Docker(로컬 DB용).

```bash
# 1) 의존성 설치
pnpm install

# 2) 로컬 PostgreSQL 기동 (docker-compose, localhost:5434)
pnpm db:up

# 3) 환경변수 준비
cp apps/api/.env.example apps/api/.env            # 값 채우기 (아래 표 참고)
cp apps/web/.env.local.example apps/web/.env.local # NEXT_PUBLIC_API_BASE_URL

# 4) DB 스키마 적용 + Prisma 클라이언트 생성
pnpm api prisma:migrate

# 5) 개발 서버 (web:3000 + api:4000 동시 실행)
pnpm dev
```

> LLM 없이도 동작한다: `apps/api/.env`의 `LLM_PROVIDER=none`이면 공고는 붙여넣기 폴백으로 등록된다. 로컬 무료로 파싱하려면 [Ollama](https://ollama.com)를 설치하고 `ollama pull qwen2.5:7b`.

## 스크립트

루트에서 실행(pnpm workspace 재귀). 앱 단위는 `pnpm api <script>` / `pnpm web <script>`.

| 명령                  | 설명                                             |
| --------------------- | ------------------------------------------------ |
| `pnpm dev`            | web + api 개발 서버 동시 실행                     |
| `pnpm db:up` / `db:down` | 로컬 PostgreSQL 컨테이너 기동 / 종료            |
| `pnpm build`          | 전체 빌드                                        |
| `pnpm test`           | 전체 테스트 (`node --import tsx --test`, 네트워크 불필요) |
| `pnpm typecheck`      | 전체 타입체크 (`tsc --noEmit`)                   |
| `pnpm lint` / `lint:fix` | 전체 ESLint (타입 인지·빡세게) / 자동수정      |
| `pnpm format` / `format:check` | Prettier 적용 / 검사                    |
| `pnpm parse:eval`     | 공고 파싱 품질을 골든 대비 필드 정확도로 채점    |
| `pnpm api prisma:studio` | Prisma Studio(DB GUI)                         |

## 환경변수 (`apps/api/.env`)

전체 목록과 설명은 [`apps/api/.env.example`](apps/api/.env.example) 참고. 비밀값은 **백엔드 환경변수로만** 두고 프론트에 노출하지 않는다.

| 변수                               | 용도                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`                     | PostgreSQL 연결 문자열 (로컬: `...@localhost:5434/joblog`) |
| `PORT` / `WEB_ORIGIN`              | API 포트 / CORS 허용 오리진                               |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT 서명 키                                       |
| `KAKAO_REST_API_KEY` / `KAKAO_REDIRECT_URI` / `KAKAO_CLIENT_SECRET` | 카카오 로그인       |
| `LLM_PROVIDER`                     | `ollama` \| `groq` \| `anthropic` \| `none`               |
| `OLLAMA_*` / `GROQ_*` / `ANTHROPIC_API_KEY` | 선택한 프로바이더 설정                           |
| `FIRECRAWL_API_KEY`                | 공고 스크래핑(없으면 붙여넣기 폴백)                       |
| `NPS_API_KEY`                      | 국민연금 공개데이터(없으면 회사 지표 생략, 링크만)        |
| `DISCORD_WEBHOOK_URL`              | 문의하기 전송(없으면 `/support` 503)                      |
| `RESEND_API_KEY` / `MAIL_FROM` / `NOTIFY_DAYS_AHEAD` | 마감 알림 메일(없으면 콘솔 로그)        |

프론트는 [`apps/web/.env.local`](apps/web/.env.local.example)의 `NEXT_PUBLIC_API_BASE_URL` 하나로 API 주소를 가리킨다(로컬 `http://localhost:4000`).

## 설계 원칙

1. **수집(Firecrawl)과 이해(LLM)를 분리** — 파싱 서비스는 입력 텍스트만 받고 출처를 모른다. 수집 수단은 교체 가능.
2. **AI는 초안 생성기, 최종 권한은 사용자** — 수집·파싱 실패가 등록 실패로 이어지지 않는다.
3. **전형 상태는 단계(Stage)가 소유** — 지원 전체 상태는 파생 계산, 중복 저장 없음.
4. **소유권 검증 필수** — 모든 `/applications/*`는 JWT userId로 본인 리소스 확인.
5. **공유 타입은 `packages/types`가 source of truth** — DTO·파싱 결과를 web·api 양쪽에서 import.

## 검증 루프

파싱처럼 비결정적인 부분은 **eval(정답 신호)**로, 일반 코드는 **typecheck + test**로 수렴시킨다.

- `pnpm typecheck` / `pnpm lint` — 결정적. lint는 error 0이어야 통과.
- `pnpm api test` — 순수 로직 단위 테스트(`*.test.ts`), 네트워크 불필요.
- `pnpm parse:eval` — API와 동일한 LLM 서비스로 공고 파싱 품질 채점. 자세히는 `apps/api/src/parse/eval/README.md`.

> `.claude/`의 Stop 훅이 `apps/`·`packages/` 변경 시 typecheck + lint + test를 자동 실행한다.

## 배포

- **Web** — Vercel(`joblog-web`). GitHub `main`에 push하면 프로덕션 자동 배포.
- **API** — 자체 서버 호스팅(`https://joblog.duckdns.org`). 서버에서 `git pull → pnpm install → prisma generate → migrate deploy → build → 재시작`.
- **DB** — 자체 호스팅 PostgreSQL.

자세한 절차는 [`docs/DEPLOY.md`](docs/DEPLOY.md).
