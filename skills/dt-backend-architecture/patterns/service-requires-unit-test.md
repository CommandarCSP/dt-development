---
ruleId: service-requires-unit-test
summary: "모든 Service는 형제 단위 테스트(*.unit.test.ts) 필수"
severity: important
appliesTo: ["src/**/*.service.ts"]
excludePathPatterns: ["src/**/prisma.service.ts", "src/**/cache.service.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
detection:
  - type: requires-sibling-test
    testPath: "__tests__/{basename}.unit.test.ts"
    rationale: "Service는 비즈니스 로직의 핵심 — Repository를 mock한 단위 테스트로 로직을 격리 검증"
relatedRules: [controller-requires-integration-test]
---

# Service는 단위 테스트를 동반한다

## 왜 중요한가
Service는 비즈니스 로직이 집중되는 계층이므로 가장 많은 단위 테스트가 필요하다. Repository를 mock(`Test.createTestingModule`)해 로직만 격리 검증하면 빠르고 결정적인 테스트가 된다.

`OrdersService`(`orders.service.ts`)는 `__tests__/orders.service.unit.test.ts`를 가져야 한다.

## ✅ Correct

```ts
// src/orders/__tests__/orders.service.unit.test.ts
import { Test } from '@nestjs/testing';
import { OrdersService } from '../orders.service';
import { OrdersRepository } from '../orders.repository';

describe('OrdersService', () => {
  it('places an order and computes total', async () => {
    const repo = { create: jest.fn().mockResolvedValue({ id: '1', total: 30 }) };
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: OrdersRepository, useValue: repo }],
    }).compile();
    const service = moduleRef.get(OrdersService);
    await expect(service.place(/* dto */)).resolves.toMatchObject({ total: 30 });
  });
});
```

## 관련 규칙
- [[controller-requires-integration-test]]
