---
ruleId: adding-business-params
summary: "limit/sort 같은 비즈니스 파라미터는 Page에서 선언 → Business Hook param으로 전달, 내부 하드코딩 금지"
severity: minor
appliesTo: ["src/business/hooks/**/*.{ts,tsx}", "src/components/domain/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "limit/sort 같은 비즈니스 파라미터가 Page에서 선언되지 않고 Business Hook 내부에 하드코딩되면 위반."
relatedRules: [query-key-design]
---

# 비즈니스 파라미터는 Page가 선언, 레이어로 전파

## 왜 중요한가
"이 페이지는 10개"라는 결정은 Page의 비즈니스 요구사항입니다. Business Hook이나 Store Query 안에 하드코딩하면 같은 hook을 다른 페이지에서 재사용할 수 없습니다.

## ❌ Incorrect

```ts
// Business Hook이 limit을 내장 — 재사용 불가
export function usePostListViewModel() {
  const { data } = usePostListQuery({ limit: 10 });
  // ...
}
```

## ✅ Correct

```ts
// Business Hook 파라미터화
interface Params {
  limit: number;
}
export function usePostListViewModel({ limit }: Params) {
  const { data } = usePostListQuery({ limit });
  // ...
}

// Domain Component도 전파
export function PostList({ limit }: { limit: number }) {
  const { posts } = usePostListViewModel({ limit });
}

// Page가 선언
export function PostListPage() {
  return <PostList limit={10} />;
}
export function RecentPostsPage() {
  return <PostList limit={20} />;
}
```

파라미터가 늘어나면 `Params` 타입 하나만 수정하면 전 레이어에 반영됩니다.

## 관련 규칙
- [[query-key-design]]
