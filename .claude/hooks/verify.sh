#!/usr/bin/env bash
# JobLog 검증 게이트 — Stop 훅에서 호출된다.
# api 소스가 바뀐 턴이면 타입체크 + 테스트를 돌리고, 실패하면 종료코드 2로
# 턴 종료를 막아(= 루프를 한 바퀴 더 돌려) Claude가 고치게 만든다.
#
# 끄고 싶으면 .claude/settings.json 의 hooks.Stop 항목을 지우면 된다.
set -uo pipefail

# 훅 JSON(stdin)을 읽어 무한 루프를 방지한다:
# 이미 이 훅이 유발한 연속 실행이면 그냥 통과시킨다.
input="$(cat 2>/dev/null || true)"
case "$input" in
  *'"stop_hook_active":true'* | *'"stop_hook_active": true'*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# git이 없거나 api 변경이 없는 턴이면(순수 대화 등) 검증을 건너뛴다.
if command -v git >/dev/null 2>&1; then
  changed="$( { git diff --name-only HEAD; git diff --name-only --cached; git ls-files --others --exclude-standard; } 2>/dev/null )"
  if ! printf '%s\n' "$changed" | grep -q '^apps/api/'; then
    exit 0
  fi
fi

echo "▶ JobLog verify: typecheck + test (apps/api)" >&2

if ! out="$(pnpm --filter @joblog/api typecheck 2>&1)"; then
  {
    echo "✗ 타입체크 실패 — 끝내기 전에 고쳐라:"
    echo "$out" | tail -20
  } >&2
  exit 2
fi

if ! out="$(pnpm --filter @joblog/api test 2>&1)"; then
  {
    echo "✗ 테스트 실패 — 끝내기 전에 고쳐라:"
    echo "$out" | tail -25
  } >&2
  exit 2
fi

echo "✓ verify 통과 (typecheck + test)" >&2
exit 0
