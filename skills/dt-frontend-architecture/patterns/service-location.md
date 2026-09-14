---
ruleId: service-location
summary: "axios import는 src/services/** 한정, 외부 레이어는 fetcher 경유"
severity: important
appliesTo: ["src/**/*.{ts,tsx}"]
excludePathPatterns: ["src/services/**"]
detection:
  - type: forbidden-import
    matches: ["axios"]
    rationale: "axios import는 src/services/** 외부에서 금지 — apiClient를 통해서만 사용"
relatedRules: [fetcher-separation]
---

# axios / apiClient import는 services 레이어에서만

## 왜 중요한가
HTTP 클라이언트 의존을 한 레이어에 가두면 baseURL, interceptor, error 처리 등 횡단 관심사가 한 곳에 모인다. 다른 레이어가 axios를 직접 import하면 services 레이어를 우회하게 된다.

## ❌ Incorrect

```ts
// src/components/domain/PostList.tsx
import axios from 'axios';
```

## ✅ Correct

```ts
// src/components/domain/PostList.tsx
import { usePostListQuery } from '../../store/queries/posts/usePostListQuery';
// HTTP 호출은 services/posts/postFetcher.ts 안에서만
```

## 관련 규칙
- [[fetcher-separation]]
