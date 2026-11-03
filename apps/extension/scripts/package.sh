#!/usr/bin/env bash
# Chrome 웹 스토어 업로드용 zip 생성. 배포에 필요한 파일만 포함.
# 실행: bash apps/extension/scripts/package.sh
set -euo pipefail

EXT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$EXT_DIR/manifest.json').version")"
OUT_DIR="$EXT_DIR/dist"
OUT="$OUT_DIR/joblog-extension-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT"

cd "$EXT_DIR"
# 아이콘 최신화(소스에서 재생성)
node scripts/make-icons.mjs >/dev/null

zip -r "$OUT" \
  manifest.json \
  popup.html \
  popup.js \
  content.js \
  icons \
  -x '*.DS_Store' >/dev/null

echo "✓ $OUT"
unzip -l "$OUT"
