#!/usr/bin/env bash
# JobLog 검증 게이트 — Stop 훅에서 호출된다.
# apps/ 또는 packages/ 가 바뀐 턴이면 typecheck + lint + test 를 돌리고,
# 실패하면 종료코드 2로 턴 종료를 막아(= 루프를 한 바퀴 더) Claude가 고치게 만든다.
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

# git이 없거나 소스 변경이 없는 턴이면(순수 대화 등) 검증을 건너뛴다.
if command -v git >/dev/null 2>&1; then
  changed="$( { git diff --name-only HEAD; git diff --name-only --cached; git ls-files --others --exclude-standard; } 2>/dev/null )"
  if ! printf '%s\n' "$changed" | grep -qE '^(apps|packages)/'; then
    exit 0
  fi
fi

run() {
  local label="$1"
  shift
  local out
  if ! out="$("$@" 2>&1)"; then
    {
      echo "✗ ${label} 실패 — 끝내기 전에 고쳐라:"
      printf '%s\n' "$out" | tail -25
    } >&2
    exit 2
  fi
}

echo "▶ JobLog verify: typecheck + lint + test" >&2
run "타입체크" pnpm -r --if-present -s typecheck
run "린트" pnpm -r --if-present -s lint
run "테스트" pnpm --filter @joblog/api -s test
echo "✓ verify 통과 (typecheck + lint + test)" >&2
echo "  (포맷은 게이트에 없음 — 필요하면 'pnpm format')" >&2
exit 0
