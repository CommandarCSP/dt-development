---
ruleId: centralized-query-keys
summary: "queryKey 정의는 src/store/queries/keys.ts 단일 위치, Hook 파일 내 별도 keys export 금지"
severity: important
appliesTo: ["src/store/queries/**/use*Query.ts", "src/store/queries/**/use*Query.tsx"]
detection:
  - type: forbidden-pattern
    pattern: "export const [a-zA-Z]+Keys[ ]*="
    rationale: "queryKey는 src/store/queries/keys.ts에 중앙 정의 — Hook 파일에서 별도 export 금지"
relatedRules: [fetcher-separation]
---

# queryKey는 중앙 keys.ts에서만 정의

## 왜 중요한가
queryKey가 Hook 파일마다 흩어지면 invalidation 시 어떤 키들이 영향을 받는지 추적이 어렵다. 중앙 파일 하나에 모든 도메인 키를 두면 의존 관계가 한눈에 보이고 cross-domain invalidation도 쉬워진다.

## ❌ Incorrect

```ts
// src/store/queries/posts/usePostListQuery.ts
export const postKeys = {
  all: ['posts'] as const,
};
```

## ✅ Correct

```ts
// src/store/queries/keys.ts
export const postKeys = {
  all: ['posts'] as const,
  list: (params: { limit?: number } = {}) => ['posts', 'list', params] as const,
  detail: (id: number) => ['posts', 'detail', id] as const,
};

// src/store/queries/posts/usePostListQuery.ts
import { postKeys } from '../keys';
```

## 관련 규칙
- [[fetcher-separation]]
