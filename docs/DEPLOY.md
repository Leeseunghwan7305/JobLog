# JobLog 배포 런북

스택: **웹 = Vercel · API = Railway · DB = Neon · 프로덕션 LLM = Anthropic**
코드 변경 없음 — 전부 환경변수로 구성한다. 아래 순서대로 진행.

> 닭-달걀 주의: 웹은 API URL이 필요하고 API는 웹 URL(CORS)이 필요하다.
> → **API(Railway)를 먼저 올려 도메인을 얻고 → 웹(Vercel) 배포 → 다시 Railway에 웹 도메인 설정 후 재배포** 순서로 푼다.

---

## 1. Neon (PostgreSQL)

1. https://neon.tech → 프로젝트 생성 (region: 가까운 곳).
2. **Connection string**(pooled, `?sslmode=require`) 복사 → 이게 `DATABASE_URL`.
   - 마이그레이션은 Railway 배포 시 `prisma migrate deploy`가 자동 적용한다(railway.json).

## 2. Railway (NestJS API)

1. https://railway.app → **New Project → Deploy from GitHub repo** → `Leeseunghwan7305/JobLog` 선택.
   - 루트의 `railway.json`을 읽어 build/start(마이그레이션 포함)를 수행한다.
2. **Variables**에 아래를 설정:

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | (1에서 복사한 Neon 문자열) |
   | `JWT_ACCESS_SECRET` | 강한 랜덤 문자열 |
   | `JWT_REFRESH_SECRET` | 강한 랜덤 문자열 |
   | `KAKAO_REST_API_KEY` | 카카오 REST 키 |
   | `KAKAO_CLIENT_SECRET` | 카카오 Client Secret |
   | `KAKAO_REDIRECT_URI` | `https://<railway-도메인>/auth/kakao/callback` (3번 후 확정) |
   | `LLM_PROVIDER` | `anthropic` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `FIRECRAWL_API_KEY` | `fc-...` (잡플래닛 평점용, 선택) |
   | `WEB_ORIGIN` | 웹 도메인 (4번에서 확정, 임시로 비워두거나 `*` 금지) |
   | `APP_BASE_URL` | 웹 도메인 (메일 링크용) |
   | `RESEND_API_KEY` | (선택, 없으면 메일 콘솔 폴백) |
   | `MAIL_FROM` | `JobLog <onboarding@resend.dev>` |
   | `NOTIFY_DAYS_AHEAD` | `3` |

   > `PORT`는 Railway가 자동 주입 → `main.ts`가 `process.env.PORT`를 읽는다. 따로 설정 불필요.
3. 배포 후 **public 도메인 생성**(Settings → Networking → Generate Domain) → `https://<railway-도메인>` 확보.
   - 이 값으로 `KAKAO_REDIRECT_URI` 확정.

## 3. Vercel (Next.js 웹)

1. https://vercel.com → **Add New → Project → Import** `JobLog`.
2. **Root Directory = `apps/web`** (모노레포 — Vercel이 루트에서 pnpm 워크스페이스 설치 후 빌드).
3. **Environment Variables**:

   | 키 | 값 |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://<railway-도메인>` (2에서 확보) |
   | `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 JS 키 (선택) |
4. Deploy → `https://<vercel-도메인>` 확보.

## 4. 도메인 상호 연결 (재배포)

Railway Variables 업데이트 후 재배포:
- `WEB_ORIGIN = https://<vercel-도메인>`
- `APP_BASE_URL = https://<vercel-도메인>`
- `KAKAO_REDIRECT_URI = https://<railway-도메인>/auth/kakao/callback`

## 5. 카카오 콘솔

1. 내 애플리케이션 → **카카오 로그인 → Redirect URI**에 `https://<railway-도메인>/auth/kakao/callback` 추가.
2. (플랫폼) Web 사이트 도메인에 Vercel·Railway 도메인 등록.
3. Client Secret을 켠 상태라면 Railway의 `KAKAO_CLIENT_SECRET`과 일치해야 함.

## 6. 검증

- `https://<railway-도메인>/auth/kakao/login` → 카카오 로그인 페이지로 302.
- `https://<vercel-도메인>` → 랜딩 → 카카오 로그인 → 대시보드.
- 공고 추가 → Anthropic으로 파싱 / 기업 후기 → 잡플래닛 평점.

---

## 비고 / 운영

- **알림 cron**: Railway는 always-on이라 `@Cron`(매일 09:00 KST)이 그대로 동작.
- **CORS**: `WEB_ORIGIN` 단일 도메인만 허용. Vercel 프리뷰 URL도 쓰려면 main.ts의 cors origin을 배열/함수로 확장 필요(이번 범위 밖).
- **비용**: Neon 무료 티어, Railway 사용량 과금, Vercel Hobby 무료. Anthropic/Firecrawl/Resend는 사용량 과금.
- **비밀값**: 모두 각 플랫폼 Variables에만. 저장소엔 `.env.example`(빈 템플릿)만 커밋됨.
