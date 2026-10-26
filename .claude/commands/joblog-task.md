---
description: task.md의 다음 미완료 항목을 JobLog 방식(테스트 우선 → 검증 → 기록)으로 진행한다
argument-hint: "[선택: 특정 task 번호나 키워드]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

JobLog의 작업 흐름대로 한 항목을 끝까지 진행한다.

## 1. 집는다
- 인자(`$ARGUMENTS`)가 있으면 그 항목을, 없으면 `task.md`에서 체크 안 된 **다음 항목 하나**를 고른다.
- `spec.md`에서 관련 절을 읽어 요구사항(목표·완료조건)을 확인한다. 애매하면 멈추고 물어본다.

## 2. 구현한다 (테스트 우선)
- 가능하면 **테스트부터** 쓴다.
  - api: 순수 로직은 `*.test.ts` + `node --test` (예: `src/parse/eval/score.test.ts`, `src/applications/status.util.ts`)
  - 파싱 품질에 영향 주는 변경이면 `src/parse/eval/fixtures/`에 케이스를 추가한다.
- 외부 API(Claude·Firecrawl·Kakao·잡플래닛)는 **서비스로 격리**하고, 실패 시 폴백/우아한 실패를 설계한다. (CLAUDE.md 원칙 2·5)
- 공유 타입(DTO·파싱 결과)은 `packages/types`에 두고 web·api 양쪽에서 import.

## 3. 검증한다 (루프를 닫는다)
아래가 **모두 통과**할 때까지 반복한다. 실패하면 원인을 고치고 다시 돌린다.
```bash
pnpm --filter @joblog/api typecheck
pnpm --filter @joblog/api test
```
- `parse/`를 건드렸다면 회귀 확인: `pnpm --filter @joblog/api parse:eval`
  (프로바이더 꺼져 있으면 채점은 건너뛰지만, 최소한 로직 테스트는 통과해야 한다.)
- 복잡한 파싱 변경이면 **parse-evaluator 서브에이전트**로 상세 리포트를 받는다.
- 스키마/타입을 건드렸다면 **schema-guard 서브에이전트**로 `packages/types` ↔ `prisma/schema.prisma` 동기화를 점검한다.

## 4. 기록한다
- `task.md`의 체크박스를 갱신하고, 바뀐 범위를 `spec.md`에 반영한다. (CLAUDE.md "작업 시 주의")
- 커밋 메시지는 한글 가능. 무엇을·왜 바꿨는지 한 줄로.

막히면 추측해서 넘어가지 말고, 무엇이 불확실한지 말하고 멈춘다.
