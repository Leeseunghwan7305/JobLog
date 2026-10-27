# JobLog 배포 런북 (Vercel 전용)

스택: **웹 = Vercel · API = Vercel 서버리스 · DB = Neon · LLM = Groq(무료)**

- 고정비 **≈ $0** (Vercel Hobby + Neon 무료 + Groq 무료).
- **Vercel 프로젝트 2개**: `apps/web`(Next), `apps/api`(NestJS 서버리스 함수).
- 알림(@Cron)은 서버리스에서 동작 안 함 — 미사용 전제(이미 결정).

> 순서: **API 프로젝트 먼저 배포 → 도메인 확보 → 웹 프로젝트 배포(API URL 주입) → API에 웹 도메인(CORS) 설정**.

---

## 0. 사전: Neon은 이미 셋업됨

- 스키마 마이그레이션 적용 완료(Neon). 서버리스는 **런타임에 migrate 하지 않음**.
- 연결 문자열은 `.env.local`에 있음(`DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` direct).
- ⚠️ 서버리스 런타임용 `DATABASE_URL`에는 **`&pgbouncer=true`** 를 붙인다(prepared-statement 충돌 방지).

## 1. API 프로젝트 (Vercel 서버리스)

1. Vercel → **Add New → Project → Import** `JobLog`, **Root Directory = `apps/api`**.
   - `apps/api/vercel.json`이 build(`prisma generate` + `nest build`)와 라우팅(`/*` → `api/index.js`)을 정의.
2. **Environment Variables**:

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | Neon pooled + `&pgbouncer=true` |
   | `DATABASE_URL_UNPOOLED` | Neon direct |
   | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 강한 랜덤 |
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | `gsk_...` (console.groq.com) |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` |
   | `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 키 |
   | `KAKAO_REDIRECT_URI` | `https://<api-도메인>/auth/kakao/callback` (배포 후 확정) |
   | `FIRECRAWL_API_KEY` | `fc-...` (잡플래닛, 선택) |
   | `WEB_ORIGIN` / `APP_BASE_URL` | 웹 도메인 (2 후 확정) |
3. Deploy → `https://<api-도메인>.vercel.app` 확보. (첫 요청 콜드스타트 ~1–2s)

## 2. 웹 프로젝트 (Vercel Next)

1. Import `JobLog` **다시** → **Root Directory = `apps/web`**.
2. 환경변수: `NEXT_PUBLIC_API_BASE_URL = https://<api-도메인>` (+ 선택 `NEXT_PUBLIC_KAKAO_JS_KEY`, `NEXT_PUBLIC_SITE_URL`).
3. Deploy → `https://<web-도메인>.vercel.app`.

## 3. 상호 연결 + 카카오

- API 프로젝트 env 업데이트 후 재배포: `WEB_ORIGIN`·`APP_BASE_URL = https://<web-도메인>`, `KAKAO_REDIRECT_URI = https://<api-도메인>/auth/kakao/callback`.
- 카카오 콘솔 → Redirect URI 등록: `https://<api-도메인>/auth/kakao/callback`, 플랫폼 Web 도메인에 두 도메인 등록.

## 4. 검증

- `https://<api-도메인>/auth/kakao/login` → 카카오 로그인으로 302.
- `https://<web-도메인>` → 로그인 → 대시보드 → 공고 추가(Groq 파싱).

---

## 서버리스 유의사항 (Nest on Vercel)

- **DI 보존**: 함수 엔트리 `api/index.js`가 `nest build`로 tsc 컴파일된 `dist/vercel.js`를 require(번들러가 데코레이터 메타데이터를 깨지 않도록). 로컬 부트스트랩 DI 검증 완료.
- **Prisma 엔진**: `schema.prisma`에 `binaryTargets=["native","rhel-openssl-3.0.x"]`. 함수 번들에 엔진 누락 시 배포 로그에 뜨면 `vercel.json functions`에 `includeFiles`로 엔진 경로 추가.
- **커넥션**: pooled + `pgbouncer=true`로 서버리스 다중 인스턴스 대응.
- **콜드스타트**: 유휴 후 첫 요청 ~1–2s.
- **알림 cron 필요해지면**: API만 always-on 호스트로 옮기면 `@Cron` 복구(코드 그대로).
