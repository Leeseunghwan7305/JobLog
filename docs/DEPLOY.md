# JobLog 배포 런북

스택(알림 미사용 · 거의 무료 구성): **웹 = Vercel(무료) · API = Render 무료 · DB = Neon 무료 · 프로덕션 LLM = Anthropic(haiku)**

- 고정비 **≈ $0** (Render/Neon/Vercel 무료 티어). 공고 분석은 Anthropic 쓴 만큼(건당 사실상 0원 수준, haiku).
- 코드 변경 없음 — 전부 환경변수 구성.
- **알림(D-3 이메일)은 이 구성에선 비활성**: Render 무료는 유휴 시 절전돼 `@Cron`이 안 돈다. 알림이 필요해지면 API를 Railway(~$5/월, always-on)로 옮기면 코드 그대로 살아난다.

> 순서: **API(Render) 먼저 → 도메인 확보 → 웹(Vercel) → 다시 Render에 웹 도메인(CORS) 설정** (웹↔API URL 상호의존 해소).

---

## 1. Neon (PostgreSQL)

1. https://neon.tech → 프로젝트 생성.
2. **pooled connection string**(`?sslmode=require`) 복사 → `DATABASE_URL`. (마이그레이션은 배포 시 자동)

## 2. Render (NestJS API, 무료)

1. https://render.com → **New → Blueprint** → GitHub `Leeseunghwan7305/JobLog` 연결 → 루트 `render.yaml` 자동 인식.
   (또는 New → Web Service 수동: build/start는 render.yaml과 동일하게)
2. **Environment**에서 `sync:false` 값들 입력:

   | 키 | 값 |
   |---|---|
   | `DATABASE_URL` | Neon 문자열 |
   | `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 강한 랜덤 |
   | `KAKAO_REST_API_KEY` / `KAKAO_CLIENT_SECRET` | 카카오 키 |
   | `KAKAO_REDIRECT_URI` | `https://<render-도메인>/auth/kakao/callback` |
   | `ANTHROPIC_API_KEY` | `sk-ant-...` |
   | `FIRECRAWL_API_KEY` | `fc-...` (잡플래닛 평점, 선택) |
   | `WEB_ORIGIN` / `APP_BASE_URL` | 웹 도메인 (3번 후 확정) |

   (`LLM_PROVIDER=anthropic`, `ANTHROPIC_MODEL=claude-haiku-4-5`, `NOTIFY_DAYS_AHEAD` 는 render.yaml에 이미 있음)
3. 배포 → Render가 준 `https://<render-도메인>` 확보 → `KAKAO_REDIRECT_URI` 확정.

## 3. Vercel (Next.js 웹, 무료)

1. https://vercel.com → **Import** `JobLog`, **Root Directory = `apps/web`**.
2. 환경변수: `NEXT_PUBLIC_API_BASE_URL = https://<render-도메인>` (+ 선택 `NEXT_PUBLIC_KAKAO_JS_KEY`).
3. Deploy → `https://<vercel-도메인>` 확보.

## 4. 도메인 상호 연결

Render Environment 업데이트 후 재배포:
- `WEB_ORIGIN = https://<vercel-도메인>`
- `APP_BASE_URL = https://<vercel-도메인>`

## 5. 카카오 콘솔

- 카카오 로그인 → **Redirect URI**에 `https://<render-도메인>/auth/kakao/callback` 추가.
- 플랫폼 Web 도메인에 Vercel·Render 도메인 등록.

## 6. 검증

- `https://<render-도메인>/auth/kakao/login` → 카카오 로그인으로 302 (첫 요청은 콜드스타트로 느릴 수 있음).
- `https://<vercel-도메인>` → 로그인 → 대시보드 → 공고 추가(Anthropic 파싱) / 기업 후기(잡플래닛 평점).

---

## 비용 메모

| 서비스 | 요금 |
|---|---|
| Vercel / Neon / Render | 무료 티어 ($0) |
| Anthropic (haiku) | 공고 분석 건당 사실상 0원 수준, 쓴 만큼 |
| Firecrawl / Resend | 무료 티어 |

**실질 고정비 ≈ $0.** (요금 정책은 바뀔 수 있으니 배포 시 확인 권장.)

### 알림까지 켜고 싶어지면
API만 Render → **Railway**(~$5/월, always-on)로 이전하면 `@Cron` D-3 알림이 동작한다. 그 외 설정은 동일, 코드 변경 없음.
