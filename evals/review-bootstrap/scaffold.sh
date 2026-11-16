#!/usr/bin/env bash
# 고정 예제: 스택 설정(.dt-frontend.json)이 없는 React 프로젝트 + Domain Component 가 axios 를 직접 부르는 위반 파일.
# 위반 파일은 커밋해 둔다 — --base 없는 full 리뷰는 프로젝트 전체를 본다.
set -euo pipefail
cat > package.json <<'JSON'
{ "name": "eval-review", "private": true, "type": "module",
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0", "@tanstack/react-query": "^5.0.0", "zustand": "^5.0.0", "axios": "^1.7.0" },
  "devDependencies": { "vite": "^7.0.0", "vitest": "^3.0.0", "typescript": "^5.6.0" } }
JSON
git init -q
mkdir -p src/components/domain
cat > src/components/domain/UserCard.tsx <<'TSX'
import axios from 'axios';
import { useEffect, useState } from 'react';

export function UserCard({ id }: { id: number }) {
  const [name, setName] = useState('');
  useEffect(() => { axios.get(`/api/users/${id}`).then((r) => setName(r.data.name)); }, [id]);
  return <div>{name}</div>;
}
TSX
git -c user.name=eval -c user.email=eval@example.com add -A
git -c user.name=eval -c user.email=eval@example.com commit -qm init
