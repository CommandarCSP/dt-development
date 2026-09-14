---
ruleId: validation-at-boundary
summary: "요청 DTO는 class-validator 데코레이터로 경계에서 검증 — 검증은 Controller 경계에서만"
severity: important
appliesTo: ["src/**/dto/*.request.dto.ts", "src/**/dto/create-*.dto.ts", "src/**/dto/update-*.dto.ts"]
detection:
  - type: required-pattern
    description: "request DTO must carry class-validator decorator (validation at boundary)"
    rationale: "검증을 경계(요청 DTO)에 모으면 Service는 검증된 입력을 가정할 수 있음"
relatedRules: [dto-no-prisma-import]
---

# 검증은 경계(요청 DTO)에서

## 왜 중요한가
검증을 요청 DTO + 전역 `ValidationPipe`(whitelist: true)에 모으면:
- Service/Repository는 이미 검증된 입력을 신뢰할 수 있어 방어 코드가 줄어듦
- 잘못된 요청이 비즈니스 로직에 도달하기 전에 400으로 차단
- 검증 규칙이 한 곳(DTO)에 선언적으로 모임

속성을 가진 요청 DTO는 최소 하나의 `class-validator` 데코레이터를 가져야 한다.

## ❌ Incorrect

```ts
// src/orders/dto/create-order.dto.ts
export class CreateOrderDto {
  customerId: string; // 검증 없음 — 어떤 값이든 통과
  total: number;
}
```

## ✅ Correct

```ts
// src/orders/dto/create-order.dto.ts
import { IsString, IsPositive } from 'class-validator';

export class CreateOrderDto {
  @IsString() customerId: string;
  @IsPositive() total: number;
}
```

## 관련 규칙
- [[dto-no-prisma-import]]
