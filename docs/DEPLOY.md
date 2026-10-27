# JobLog 배포 런북

스택: **웹 = Vercel · API = 자체 서버(duckdns, 상주 Node 프로세스) · DB = 자체 호스팅 PostgreSQL · LLM = Groq(무료)**

- 웹은 Vercel(GitHub 연동 자동 배포), API는 자체 서버에서 상주 실행(서버리스 아님).
- API가 상주하므로 알림(`@Cron`)이 정상 동작한다.
- DB는 자체 호스팅 Postgres(서버의 docker 또는 네이티브). 연결 문자열은 API 서버의 환경변수로만 주입.

> 순서: **DB 준비 → API 서버 배포(마이그레이션 적용) → 도메인 확보 → 웹 배포(API URL 주입) → API에 웹 도메인(CORS) 설정 → 카카오 Redirect 등록**.

---

## 0. DB (자체 호스팅 PostgreSQL)

- 로컬 개발: `pnpm db:up` (docker-compose의 `joblog-db`, 포트 5434). `apps/api/.env`의 `DATABASE_URL`이 이를 가리킴.
- 운영: 서버의 Postgres에 접근 가능한 `DATABASE_URL`을 API 서버 환경변수로 설정.
- 마이그레이션은 **런타임이 아니라 배포 단계에서** 적용:
  `pnpm --filter @joblog/api exec prisma migrate deploy` (API 서버에서, `DATABASE_URL`이 운영 DB를 가리킨 상태).

## 1. API 서버 (자체 호스팅, 상주)

1. 서버에 레포 체크아웃 → `pnpm install` → `pnpm --filter @joblog/api build`.
2. **환경변수** (서버의 `.env` 또는 프로세스 매니저 설정):

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | 운영 Postgres 연결 문자열 |
   | `PORT` | API 포트 (예: 4000) |
   | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 강한 랜덤 |
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | `gsk_...` (console.groq.com) |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 키 |
   | `KAKAO_REDIRECT_URI` | `https://<api-도메인>/auth/kakao/callback` |
   | `FIRECRAWL_API_KEY` | `fc-...` (선택) |
   | `RESEND_API_KEY` | 알림 메일 (없으면 콘솔 로그 폴백) |
   | `WEB_ORIGIN` / `APP_BASE_URL` | 웹 도메인 (2 후 확정) |
3. `prisma migrate deploy`로 스키마 적용 → 상주 실행(`node dist/main.js` 등, 프로세스 매니저로 always-on).
4. duckdns 도메인 + 리버스 프록시(TLS)로 `https://<api-도메인>` 노출.

## 2. 웹 프로젝트 (Vercel Next)

1. Vercel → Import `JobLog` → **Root Directory = `apps/web`** (GitHub 연동 시 push 자동 배포).
2. 환경변수: `NEXT_PUBLIC_API_BASE_URL = https://<api-도메인>` (+ 선택 `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_SITE_URL`).
3. Deploy → `https://<web-도메인>.vercel.app`.

## 3. 상호 연결 + 카카오

- API 서버 env 갱신 후 재시작: `WEB_ORIGIN`·`APP_BASE_URL = https://<web-도메인>`, `KAKAO_REDIRECT_URI = https://<api-도메인>/auth/kakao/callback`.
- 카카오 콘솔 → Redirect URI 등록: `https://<api-도메인>/auth/kakao/callback`, 플랫폼 Web 도메인에 두 도메인 등록.

## 4. 검증

- `https://<api-도메인>/auth/kakao/login` → 카카오 로그인으로 302.
- `https://<web-도메인>` → 로그인 → 대시보드 → 공고 추가(Groq 파싱).

---

## 유의사항

- **마이그레이션**: 코드 배포 시 스키마 변경이 있으면 `prisma migrate deploy`를 **먼저** 실행(컬럼 없는 상태로 새 코드가 뜨면 런타임 에러).
- **Prisma 엔진**: `schema.prisma`에 `binaryTargets=["native","rhel-openssl-3.0.x"]`. 서버 OS에 맞는 엔진이 없으면 배포 로그에 뜨므로 타깃을 조정.
- **알림 cron**: API가 상주 프로세스이므로 `@Cron`(매일 09:00 KST 마감/면접 임박 메일) 정상 동작. 서버가 KST인지 타임존 확인.
