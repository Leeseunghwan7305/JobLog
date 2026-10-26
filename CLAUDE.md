# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 가이드다. 작업 전 반드시 읽는다.

## 프로젝트 개요

**JobLog** — 구직 현황 추적 서비스. 채용 공고 링크를 붙여넣으면 AI가 회사·직무·전형 절차를 자동 추출하고, 서류부터 최종 면접까지 각 전형의 상태(대기/진행중/합격/탈락)를 관리한다. 카카오 로그인 기반 다중 사용자 서비스.

- 상세 기획: `docs/planning.html`
- 기술 스펙: `spec.md`
- 작업 목록: `task.md`

## 기술 스택

| 영역          | 기술                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Frontend      | Next.js (App Router), TypeScript, TanStack Query, shadcn/ui, Tailwind CSS |
| Backend       | NestJS, Prisma, PostgreSQL, Passport (Kakao + JWT)                        |
| 외부 연동     | Firecrawl(공고 스크래핑), Claude API(파싱), 잡플래닛(기업 후기, M4)       |
| 인프라        | Vercel(web), Railway/Render(api), Neon/Supabase(DB)                       |
| 패키지 매니저 | pnpm (workspace 모노레포)                                                 |

## 저장소 구조

```
JobLog/
├── apps/
│   ├── web/          # Next.js 프론트엔드
│   └── api/          # NestJS 백엔드
│       └── prisma/   # schema.prisma, migrations
├── packages/
│   └── types/        # web·api 공유 타입 (DTO, 파싱 결과 스키마)
├── docs/
│   └── planning.html # 서비스 기획서
├── spec.md
├── task.md
└── CLAUDE.md
```

## 핵심 설계 원칙

1. **수집(Firecrawl)과 이해(Claude)를 분리한다.** 공고 수집 수단은 교체 가능해야 하므로, 파싱 서비스는 "입력 텍스트"만 받고 어디서 왔는지 모른다.
2. **AI는 초안 생성기, 최종 권한은 사용자.** 파싱 결과는 항상 사용자가 보정할 수 있고, 수집·파싱 실패가 등록 실패로 이어지면 안 된다. 링크 실패 → 본문 붙여넣기 폴백.
3. **전형 상태는 단계(Stage)가 소유한다.** 지원 전체 상태(`AppStatus`)는 단계 상태에서 파생 계산한다. 중복 저장하지 않는다.
4. **소유권 검증 필수.** 모든 `/applications/*` 요청은 JWT의 userId로 본인 리소스인지 확인한다.
5. **잡플래닛 후기는 best-effort.** 공개 평점·요약만 참고용으로 캐시하고, 전체 후기 본문은 스크래핑·저장하지 않는다 (로그인·블러·ToS 제약). 자세히는 딥링크.

## 명령어

> 아직 scaffolding 전이면 `task.md`의 M1부터 시작한다.

```bash
pnpm install              # 의존성 설치
pnpm --filter web dev     # 프론트 개발 서버
pnpm --filter api dev     # 백엔드 개발 서버
pnpm --filter api prisma migrate dev   # DB 마이그레이션
pnpm --filter api prisma studio        # DB GUI
pnpm test                 # 전체 테스트 (-r --if-present)
pnpm typecheck            # 전체 타입체크
pnpm parse:eval           # 파싱 품질 eval (아래 참고)
```

## 하네스 / 검증 루프

이 저장소는 에이전트가 스스로 수렴하도록 전용 하네스를 둔다. 작업할 때 이걸 신호로 쓴다.

**검증 신호 (루프를 닫는 기준)**

- `pnpm --filter @joblog/api typecheck` — `tsc --noEmit`. 결정적.
- `pnpm --filter @joblog/api test` — `node --import tsx --test`로 순수 로직 테스트(`*.test.ts`). 네트워크 불필요.
- `pnpm --filter @joblog/api parse:eval` — 공고 파싱 품질을 골든 대비 **필드 정확도로 채점**. API와 동일한 `LlmService`를 태운다. 자세히는 `apps/api/src/parse/eval/README.md`.

**자동화 (`.claude/`)**

- `settings.json` → **Stop 훅**이 `hooks/verify.sh`를 돌린다: api 소스가 바뀐 턴이면 typecheck+test가 통과해야 턴이 끝난다(실패 시 한 바퀴 더). 끄려면 해당 훅 제거.
- `/joblog-task` 명령 — spec→task→테스트 우선 구현→검증→기록 흐름.
- 서브에이전트 `parse-evaluator`(파싱 품질 리포트), `schema-guard`(타입↔스키마 동기화 점검).

**원칙**: 파싱처럼 비결정적인 부분은 "정답 신호(eval)"로, 일반 코드는 typecheck+test로 루프를 닫는다. 파싱 프롬프트/스키마를 바꾸면 `fixtures/`에 실패 케이스를 추가해 회귀를 막는다.

## 컨벤션

- **언어**: 코드/주석은 상황에 맞게, 커밋 메시지는 한글 가능. 사용자 대면 문구는 한글.
- **타입**: 프론트·백엔드가 주고받는 데이터(DTO, 파싱 결과)는 `packages/types`에 정의하고 양쪽에서 import.
- **검증**: 백엔드 입력은 `class-validator` DTO로 검증. AI 파싱 결과는 JSON 스키마로 강제·검증 후 사용.
- **에러**: 조용히 삼키지 않는다. 수집/파싱 실패는 명확한 상태 코드와 폴백 안내로 프론트에 전달.
- **비밀값**: Claude·Firecrawl·Kakao 키는 백엔드 환경변수로만. 프론트에 노출 금지.

## 작업 시 주의

- 기능 추가·변경 시 `task.md`의 체크박스와 `spec.md`를 함께 갱신한다.
- 외부 API(Claude, Firecrawl, Kakao, 잡플래닛) 호출 로직은 각각 서비스로 격리해 모킹·교체가 쉽게 한다.
- 링크 스크래핑과 잡플래닛 후기는 대상 사이트 상황에 따라 실패할 수 있다 — 항상 폴백/우아한 실패를 설계한다.
