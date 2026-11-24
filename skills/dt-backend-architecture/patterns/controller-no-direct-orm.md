---
ruleId: controller-no-direct-orm
summary: "Controller는 ORM(기본 Prisma) 직접 호출 금지, Service→Repository 경유"
severity: critical
appliesTo: ["src/**/*.controller.ts"]
detection:
  - type: forbidden-import
    matches: ["$orm.access"]
    rationale: "Controller는 HTTP 경계만 담당 — 데이터 접근은 Service를 통해서만"
requiresStack: [orm]
relatedRules: [service-no-direct-orm, repository-only-orm]
---

# Controller는 ORM 직접 호출 금지

> 검사하는 import는 `stack.orm`에 따라 바뀐다(`docs/refs/stack-config.md` §4). 예시는 기본값 Prisma.

## 왜 중요한가
Controller는 요청을 검증(DTO)하고 Service에 위임한 뒤 응답 DTO로 변환하는 책임만 가진다. Prisma가 Controller에 들어오면:
- 비즈니스 로직/트랜잭션이 HTTP 핸들러에 섞여 테스트가 어려움
- 같은 쿼리가 여러 Controller에 중복됨
- 계층 경계가 무너져 Service/Repository를 우회

## ❌ Incorrect

```ts
// src/orders/orders.controller.ts
import { PrismaService } from '../prisma/prisma.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.order.findUnique({ where: { id } });
  }
}
```

## ✅ Correct

```ts
// src/orders/orders.controller.ts
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  findOne(@Param('id') id: string): Promise<OrderResponseDto> {
    return this.orders.findOne(id);
  }
}
```

## 관련 규칙
- [[service-no-direct-orm]]
- [[repository-only-orm]]
