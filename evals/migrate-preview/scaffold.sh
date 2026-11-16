#!/usr/bin/env bash
# 고정 예제: 플러그인 형식이 아닌 project-context(영어 제목) — 기본은 미리보기라 파일이 바뀌면 안 된다
set -euo pipefail
cat > package.json <<'JSON'
{ "name": "eval-migrate", "private": true, "dependencies": { "react": "^19.0.0" } }
JSON
mkdir -p docs
cat > docs/project-context.md <<'MD'
# Project Context

## Overview
사진 공유 앱.

## Tech Stack
- React 19
- Styling: SCSS modules
MD
