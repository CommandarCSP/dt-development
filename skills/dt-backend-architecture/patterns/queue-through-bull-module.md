---
ruleId: queue-through-bull-module
summary: "Service는 bullmq/bull 직접 import 금지 — 주입된 큐 producer 경유"
severity: important
appliesTo: ["src/**/*.service.ts"]
excludePathPatterns: ["src/queue/**", "src/**/*.processor.ts", "src/**/*.producer.ts", "src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: forbidden-pattern
    pattern: "new[ ]+(Queue|Worker|QueueEvents)[ ]*[(]"
    rationale: "큐 인스턴스 직접 생성 금지 — @InjectQueue로 주입받아 사용 (타입 import는 허용)"
relatedRules: [redis-through-cache-service]
---

# 큐는 BullMQ 모듈을 통해서만

## 왜 중요한가
큐 연결과 잡 정의를 큐 모듈에 모으면 재시도/백오프/동시성 설정이 일관된다. Service가 `bullmq`를 직접 import하면:
- Redis 연결이 산발적으로 생성됨
- 잡 이름/페이로드 계약이 흩어짐
- 테스트에서 큐를 가짜로 만들기 어려움

Service는 `@InjectQueue`로 주입받은 큐 또는 producer 추상화만 사용한다.

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
import { Queue } from 'bullmq';
const q = new Queue('orders');
```

## ✅ Correct

```ts
// src/orders/orders.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq'; // 타입만 — 인스턴스는 DI로 주입

@Injectable()
export class OrdersService {
  constructor(@InjectQueue('orders') private readonly queue: Queue) {}
}
```

> 참고: 타입 전용 import가 필요하면 producer 모듈에서 래핑하는 것을 권장. 본 룰은 `new Queue()` 직접 생성을 막는 데 초점이 있다.

## 관련 규칙
- [[redis-through-cache-service]]
