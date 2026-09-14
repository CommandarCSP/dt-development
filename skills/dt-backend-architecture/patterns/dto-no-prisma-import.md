---
ruleId: dto-no-prisma-import
summary: "DTO는 Prisma/Entity import 금지 — 순수 wire 계약(class-validator)만"
severity: critical
appliesTo: ["src/**/dto/*.ts"]
detection:
  - type: forbidden-import
    matches: ["@prisma/client", "**/entities/**", "**/*.entity"]
    rationale: "DTO는 외부 계약(요청/응답 형태)이며 DB 모델과 분리되어야 함"
relatedRules: [dto-vs-entity]
---

# DTO는 Prisma/Entity에 의존하지 않는다

## 왜 중요한가
DTO는 API의 입출력 계약이다. DB 엔티티나 Prisma 모델을 그대로 끌어오면:
- 스키마 변경이 곧 API 계약 변경이 되어 클라이언트가 깨짐
- 내부 컬럼(비밀번호 해시, 내부 상태)이 의도치 않게 노출
- 검증 규칙(class-validator)이 DB 타입과 충돌

DTO는 자체 필드 + `class-validator` 데코레이터로만 정의하고, Entity↔DTO 변환은 Mapper가 담당한다.

## ❌ Incorrect

```ts
// src/orders/dto/order-response.dto.ts
import { Order } from '@prisma/client';
export class OrderResponseDto extends Order {} // DB 모델을 그대로 노출
```

## ✅ Correct

```ts
// src/orders/dto/order-response.dto.ts
export class OrderResponseDto {
  @IsString() id: string;
  @IsNumber() total: number;
}
```

## 관련 규칙
- [[dto-vs-entity]]
