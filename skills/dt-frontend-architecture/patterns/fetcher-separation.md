---
ruleId: fetcher-separation
summary: "Query Hook은 apiClient 직접 import 금지, services/<domain>/Fetcher 함수만 사용"
severity: critical
appliesTo: ["src/store/queries/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["axios", "**/utils/apiClient*", "**/services/apiClient*", "../apiClient", "../../apiClient", "../../../apiClient"]
    rationale: "Query Hook은 apiClient를 직접 호출하지 않음 — services/<domain>/Fetcher만 import"
relatedRules: [service-location, centralized-query-keys]
---

# Query Hook은 Fetcher를 import한다

## 왜 중요한가
Query Hook이 직접 axios/apiClient를 호출하면 같은 엔드포인트를 여러 곳에서 재구현하게 되고, 캐시 외 위치(route loader, prefetch script 등)에서 동일 호출을 공유하기 어렵다.

## ❌ Incorrect

```tsx
// src/store/queries/posts/usePostListQuery.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/apiClient';

export function usePostListQuery() {
  return useQuery({
    queryKey: postKeys.list(),
    queryFn: async () => (await apiClient.get('/posts')).data,
  });
}
```

## ✅ Correct

```tsx
// src/store/queries/posts/usePostListQuery.ts
import { useQuery } from '@tanstack/react-query';
import { fetchPostList } from '../../../services/posts/postFetcher';
import { postKeys } from '../keys';

export function usePostListQuery() {
  return useQuery({
    queryKey: postKeys.list(),
    queryFn: fetchPostList,
  });
}
```

## 관련 규칙
- [[service-location]]
- [[centralized-query-keys]]
