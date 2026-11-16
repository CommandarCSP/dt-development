#!/usr/bin/env bash
# 고정 예제: React 프로젝트 + 로그인 화면 요구사항 문서(에러 문구는 일부러 적지 않는다 — 지어내는지 본다)
set -euo pipefail
cat > package.json <<'JSON'
{ "name": "eval-fe", "private": true, "type": "module",
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0", "@tanstack/react-query": "^5.0.0", "zustand": "^5.0.0", "react-router": "^7.0.0" },
  "devDependencies": { "vite": "^7.0.0", "tailwindcss": "^4.0.0", "@tailwindcss/vite": "^4.0.0", "vitest": "^3.0.0", "msw": "^2.0.0", "@playwright/test": "^1.50.0", "typescript": "^5.6.0" } }
JSON
mkdir -p docs/req src
cat > docs/req/login.md <<'MD'
# 로그인 화면

- 경로는 `/login`. 로그인하지 않은 사용자만 들어온다.
- 이메일 입력, 비밀번호 입력, "로그인" 버튼이 있다.
- 두 입력이 모두 채워져야 버튼이 눌린다.
- 버튼을 누르면 `POST /api/auth/login`에 `{ email, password }`를 보낸다.
  - 200이면 응답의 `accessToken`을 저장하고 `/dashboard`로 이동한다.
  - 401이면 화면에 에러를 보여 주고 비밀번호 입력을 비운다.
- "회원가입" 링크를 누르면 `/signup`으로 간다.
MD
