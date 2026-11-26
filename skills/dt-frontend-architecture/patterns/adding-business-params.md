---
ruleId: adding-business-params
summary: "limit/sort 같은 비즈니스 파라미터는 Page에서 선언 → Business Hook param으로 전달, 내부 하드코딩 금지"
severity: minor
appliesTo: ["src/business/hooks/**/*.{ts,tsx}", "src/store/**/*.{ts,tsx}"]
detection:
  - type: forbidden-pattern
    pattern: "\b(?:limit|pageSize|perPage|size|sort|sortBy|order|orderBy)\??\s*:\s*(?:\d+|'[^'\n]*'|\"[^\"\n]*\")(?!\s*\|)"
    rationale: "Business Hook·Store Query 안에 limit·sort 값을 직접 적었다 — 값은 Page 가 정하고 파라미터로 받는다(같은 hook 을 다른 페이지가 다른 값으로 쓴다). 기본값은 매개변수 기본값(`{ limit = 10 }`)으로 둔다"
  - type: manual
    description: "Domain Component 가 값을 직접 적는지, Page 에서 hook 까지 파라미터가 끊기지 않고 전달되는지는 사람이 본다 — Page 는 값을 적는 곳이라 같은 검사를 걸 수 없다"
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
