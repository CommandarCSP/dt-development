---
ruleId: controller-no-business-logic
summary: "Controller는 검증·위임만 — 분기/계산/트랜잭션 등 비즈니스 로직 금지 (Service로)"
severity: important
appliesTo: ["src/**/*.controller.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: forbidden-pattern
    pattern: "\bfor\s*\(|\bwhile\s*\(|\.reduce\s*\(|\bswitch\s*\("
    rationale: "Controller 에 반복·누적 계산·분기 묶음(for·while·reduce·switch)이 있다 — Service 로 옮긴다"
  - type: manual
    description: "if 분기가 업무 규칙인지(옮길 것) 단순 응답 변환인지는 사람이 본다 — 기계로 가르면 오탐이 많다"
    rationale: "비즈니스 로직은 Service에 집중 — Controller 비대화 방지"
relatedRules: [service-no-http-context, service-no-direct-orm]
---

# Controller에 비즈니스 로직을 두지 않는다

## 왜 중요한가
Controller는 "요청을 받아 Service에 넘기고 결과를 응답으로 변환"하는 얇은 계층이어야 한다. 분기/계산/트랜잭션이 Controller에 쌓이면:
- HTTP 핸들러 없이는 로직을 테스트할 수 없음
- 동일 로직이 여러 엔드포인트에 복붙됨
- 트랜잭션 경계가 모호해짐

> 기계 검사: `*.controller.ts`에 `for`·`while`·`.reduce(`·`switch`가 있으면 위반이다. `if` 분기가 업무 규칙인지는 리뷰어가 본다.

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
- [[service-no-direct-orm]] · 레이어별 책임은 `dt-backend-architecture` 「이 로직 어디에 둘까?」
