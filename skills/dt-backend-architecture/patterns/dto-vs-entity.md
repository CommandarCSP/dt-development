---
ruleId: dto-vs-entity
summary: "Controller는 응답으로 DTO만 노출 — raw Entity/Prisma 모델 반환 금지"
severity: important
appliesTo: ["src/**/*.controller.ts"]
detection:
  - type: forbidden-import
    matches: ["@prisma/client", "**/entities/*.entity", "**/entities/**"]
    rationale: "Controller가 Entity/Prisma 모델을 직접 다루면 내부 표현이 외부 계약으로 새어나감"
relatedRules: [dto-no-prisma-import, repository-only-prisma]
---

# Controller는 DTO를 노출하고 Entity를 노출하지 않는다

## 왜 중요한가
Entity/도메인 Model은 내부 표현이고 DTO는 외부 계약이다. Controller가 Entity를 그대로 받아 반환하면:
- 직렬화 시 내부 필드가 노출(over-exposure)
- 응답 형태가 DB 스키마에 종속
- 버전 관리·필드 deprecation이 어려움

Controller는 Service가 돌려준 도메인 Model을 응답 DTO로 매핑해 내보낸다(또는 Service가 DTO를 반환).

## ❌ Incorrect

```ts
// src/orders/orders.controller.ts
import { OrderEntity } from './entities/order.entity';

@Get(':id')
findOne(@Param('id') id: string): Promise<OrderEntity> { // 내부 Entity 노출
  return this.orders.findEntity(id);
}
```

## ✅ Correct

```ts
// src/orders/orders.controller.ts
import { OrderResponseDto } from './dto/order-response.dto';

@Get(':id')
findOne(@Param('id') id: string): Promise<OrderResponseDto> {
  return this.orders.findOne(id);
}
```

## 관련 규칙
- [[dto-no-prisma-import]]
- [[repository-only-prisma]]
