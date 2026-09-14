---
ruleId: controller-no-business-logic
summary: "Controller는 검증·위임만 — 분기/계산/트랜잭션 등 비즈니스 로직 금지 (Service로)"
severity: important
appliesTo: ["src/**/*.controller.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: ast-rule
    description: "Controller 메서드는 DTO 검증 후 Service 호출 결과를 반환만 해야 함 — 메서드 본문의 분기/반복/계산은 Service로 이동 (v1: 수동 검토)"
    rationale: "비즈니스 로직은 Service에 집중 — Controller 비대화 방지"
relatedRules: [service-no-http-context, where-does-business-logic-go]
---

# Controller에 비즈니스 로직을 두지 않는다

## 왜 중요한가
Controller는 "요청을 받아 Service에 넘기고 결과를 응답으로 변환"하는 얇은 계층이어야 한다. 분기/계산/트랜잭션이 Controller에 쌓이면:
- HTTP 핸들러 없이는 로직을 테스트할 수 없음
- 동일 로직이 여러 엔드포인트에 복붙됨
- 트랜잭션 경계가 모호해짐

> v1에서는 정규식으로 단정하기 어려워 `ast-rule` 수동 검토 stub로 표시된다. 추후 ts-morph 기반 AST로 메서드 본문 복잡도를 강제한다.

## ❌ Incorrect

```ts
@Post()
async create(@Body() dto: CreateOrderDto) {
  if (dto.items.length === 0) throw new BadRequestException();
  let total = 0;
  for (const it of dto.items) total += it.price * it.qty; // 계산 = 비즈니스 로직
  return this.repo.create({ ...dto, total });
}
```

## ✅ Correct

```ts
@Post()
create(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {
  return this.orders.place(dto); // 계산/검증/트랜잭션은 Service 내부
}
```

## 관련 규칙
- [[service-no-http-context]]
- [[where-does-business-logic-go]]
