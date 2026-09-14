---
ruleId: centralized-cache-keys
summary: "캐시 키 팩토리는 cache-keys.ts 단일 위치 — 다른 파일에서 별도 CacheKeys export 금지"
severity: important
appliesTo: ["src/**/*.ts"]
excludePathPatterns: ["src/**/cache-keys.ts", "src/cache/**", "src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: forbidden-pattern
    pattern: "export const [a-zA-Z]+CacheKeys?[ ]*="
    rationale: "캐시 키는 cache-keys.ts에 중앙 정의 — 무효화 추적과 키 충돌 방지"
relatedRules: [redis-through-cache-service]
---

# 캐시 키는 중앙 cache-keys.ts에서만 정의

## 왜 중요한가
캐시 키가 파일마다 흩어지면 무효화 시 어떤 키가 영향을 받는지 추적이 어렵고 키 충돌이 발생한다. 중앙 파일 하나에 도메인별 키 팩토리를 두면 의존 관계가 한눈에 보인다(FE의 `centralized-query-keys`와 동일 철학).

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
export const orderCacheKeys = {
  detail: (id: string) => `orders:detail:${id}`,
};
```

## ✅ Correct

```ts
// src/cache/cache-keys.ts
export const orderCacheKeys = {
  detail: (id: string) => `orders:detail:${id}`,
  list: (q: ListQuery) => `orders:list:${JSON.stringify(q)}`,
};

// src/orders/orders.service.ts
import { orderCacheKeys } from '../cache/cache-keys';
```

## 관련 규칙
- [[redis-through-cache-service]]
