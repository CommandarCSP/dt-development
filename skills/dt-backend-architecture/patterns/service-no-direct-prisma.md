---
ruleId: service-no-direct-prisma
summary: "Service는 PrismaClient 직접 호출 금지, Repository 경유 (지속성 분리)"
severity: critical
appliesTo: ["src/**/*.service.ts"]
excludePathPatterns: ["src/**/prisma.service.ts", "src/prisma/**", "src/**/cache.service.ts", "src/cache/**"]
detection:
  - type: forbidden-import
    matches: ["@prisma/client", "**/prisma.service", "**/prisma/prisma.service"]
    rationale: "Service의 비즈니스 로직과 지속성(Prisma)을 분리 — Repository를 통해서만 DB 접근"
relatedRules: [repository-only-prisma, where-does-business-logic-go]
---

# Service는 Prisma 직접 호출 금지

## 왜 중요한가
Service는 유스케이스/비즈니스 로직을 담는 계층이다. Prisma를 직접 부르면:
- 단위 테스트에서 Repository를 mock할 수 없어 실제 DB가 필요해짐 (느리고 깨지기 쉬움)
- 쿼리 디테일이 비즈니스 로직과 뒤섞임
- 동일 조회가 Repository와 Service에 중복

지속성은 Repository에 캡슐화하고 Service는 그 인터페이스에만 의존한다.

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}
  async place(dto: CreateOrderDto) {
    return this.prisma.order.create({ data: dto });
  }
}
```

## ✅ Correct

```ts
// src/orders/orders.service.ts
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}
  async place(dto: CreateOrderDto): Promise<Order> {
    return this.repo.create(toNewOrder(dto));
  }
}
```

## 관련 규칙
- [[repository-only-prisma]]
- [[where-does-business-logic-go]]
