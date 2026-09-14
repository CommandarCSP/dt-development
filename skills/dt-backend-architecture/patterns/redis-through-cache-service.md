---
ruleId: redis-through-cache-service
summary: "Redis 클라이언트(ioredis/redis/cache-manager) import는 src/cache/** 한정 — 외부는 cache service 경유"
severity: critical
appliesTo: ["src/**/*.ts"]
excludePathPatterns: ["src/cache/**", "src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**", "test/**"]
detection:
  - type: forbidden-import
    matches: ["ioredis", "redis", "@nestjs/cache-manager", "cache-manager"]
    rationale: "Redis 접근을 cache 모듈 한 곳에 가둔다 — 키 컨벤션/TTL/직렬화를 일관되게"
relatedRules: [centralized-cache-keys]
---

# Redis는 cache service를 통해서만

## 왜 중요한가
Redis 클라이언트를 cache 모듈 한 곳에 가두면 키 네이밍·TTL·직렬화·장애 폴백이 한 곳에 모인다. 서비스마다 `new Redis()`를 만들면:
- 연결이 산발적으로 늘어남
- 키 충돌·TTL 불일치
- 캐시 무효화 추적 불가

상위 레이어는 주입된 `CacheService` 추상화에만 의존한다.

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
import Redis from 'ioredis';
const redis = new Redis();
```

## ✅ Correct

```ts
// src/orders/orders.service.ts
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OrdersService {
  constructor(private readonly cache: CacheService) {}
}
```

## 관련 규칙
- [[centralized-cache-keys]]
