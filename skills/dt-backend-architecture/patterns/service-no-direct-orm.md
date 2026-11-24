---
ruleId: service-no-direct-orm
summary: "Service는 ORM(기본 Prisma) 직접 호출 금지, Repository 경유 (지속성 분리)"
severity: critical
appliesTo: ["src/**/*.service.ts"]
excludePathPatterns: ["$orm.allowedPaths", "src/**/cache.service.ts", "src/cache/**"]
detection:
  - type: forbidden-import
    matches: ["$orm.access"]
    rationale: "Service의 비즈니스 로직과 지속성(ORM)을 분리 — Repository를 통해서만 DB 접근"
requiresStack: [orm]
relatedRules: [repository-only-orm, controller-no-business-logic]
---

# Service는 ORM 직접 호출 금지

> 검사하는 import는 `stack.orm`에 따라 바뀐다(`docs/refs/stack-config.md` §4). 예시는 기본값 Prisma. TypeORM의 `@InjectRepository(Order) Repository<Order>`를 서비스에 바로 넣는 것도 이 규칙에 걸린다 — 저장소 클래스를 거친다.

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
- [[repository-only-orm]]
- [[controller-no-business-logic]] · 레이어별 책임은 `dt-backend-architecture` 「이 로직 어디에 둘까?」
