---
ruleId: use-server-components
summary: "React Server Component 사용 가능 환경에서는 클라이언트 컴포넌트 남용 회피"
severity: suggestion
appliesTo: ["src/**/*.{tsx,ts}"]
condition: "framework: nextjs-app-router"
detection:
  - type: pattern-rule
    description: "클라이언트 컴포넌트에서 데이터 페칭이나 서버 전용 로직을 수행하는 경우 Server Component로 이동 고려. (이 검사는 Plan 2에서 구현)"
source: "vercel-labs/agent-skills/skills/react-best-practices"
placeholder: true
---

# 데이터 페칭은 Server Component에서

React Server Components(RSC)를 지원하는 환경(Next.js App Router 등)에서는
데이터 페칭과 서버 전용 연산을 Server Component에서 수행한다.

## 왜 중요한가

- 클라이언트 번들 크기를 줄여 초기 로딩 속도를 개선한다.
- 데이터베이스나 파일 시스템에 직접 접근하는 서버 로직을 클라이언트에 노출하지 않는다.
- Suspense와 함께 사용하면 streaming 렌더링으로 Time to First Byte(TTFB)를 단축한다.

## ❌ Incorrect

```tsx
// ClientComponent.tsx — 클라이언트에서 fetch
'use client';
useEffect(() => {
  fetch('/api/posts').then(r => r.json()).then(setPosts);
}, []);
```

## ✅ Correct

```tsx
// PostListPage.tsx — Server Component에서 직접 fetch
async function PostListPage() {
  const posts = await fetchPosts(); // 서버에서 직접 실행
  return <PostList posts={posts} />;
}
```

## 이 프로젝트에서의 적용

현재 dt-frontend는 Vite + React SPA로 RSC를 사용하지 않는다.
이 룰은 Next.js App Router로 마이그레이션하거나 새 프로젝트 시작 시 참조한다.
SPA 환경에서는 TanStack Query를 사용한 서버 상태 관리가 대안이다.
