---
ruleId: test-writing-structure
summary: "AAA(Arrange/Act/Assert), 명확한 네이밍, 한 테스트=한 동작, 픽스처는 Builder로"
severity: minor
appliesTo: ["src/**/__tests__/**/*.ts", "test/**/*.e2e.test.ts"]
detection: []
relatedRules: [test-case-design-techniques, service-unit-mocks-repository]
---

# 테스트 작성 구조

## 왜 중요한가
일관된 구조는 테스트를 읽기 쉽고 디버깅 가능하게 만든다.

- **AAA**: Arrange(준비) → Act(실행) → Assert(검증)를 시각적으로 분리
- **네이밍**: `should_<결과>_when_<조건>` 또는 행위 서술 (`POST /orders with invalid body → 400`)
- **한 테스트 = 한 동작**: 하나의 it()은 하나의 행위/결과만 검증
- **픽스처는 Builder/팩토리**로 — 의미 있는 값만 노출, 나머지는 기본값

## ✅ Correct

```ts
it('computes total from line items', async () => {
  // Arrange
  const dto = anOrder().withItems([{ price: 10, qty: 3 }]).build();
  // Act
  const result = await service.place(dto);
  // Assert
  expect(result.total).toBe(30);
});
```

## 관련 규칙
- [[test-case-design-techniques]]
- [[service-unit-mocks-repository]]
