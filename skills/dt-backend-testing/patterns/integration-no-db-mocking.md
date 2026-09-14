---
ruleId: integration-no-db-mocking
summary: "통합 테스트에서 Prisma/Repository를 mock하면 통합 의미 소실 — 실제 DB(Testcontainers) 사용"
severity: critical
appliesTo: ["src/**/__tests__/**/*.integration.test.ts", "test/**/*.e2e.test.ts"]
detection:
  - type: forbidden-call
    matches: ["jest.mock", "vi.mock"]
    matchArguments: ["**/*.repository", "**/prisma**", "**/prisma.service", "@prisma/client"]
    rationale: "통합/E2E 테스트가 Repository나 Prisma를 mock하면 실제 쿼리·제약·트랜잭션 검증이 무의미해짐"
relatedRules: [repository-integration-real-db, testcontainers-lifecycle]
---

# 통합 테스트는 DB/Repository를 mock하지 않는다

## 왜 중요한가
통합/E2E 테스트의 목적은 "Controller→Service→Repository→DB가 실제로 함께 동작하는가"를 검증하는 것이다. Repository나 Prisma를 mock하면 사실상 unit 테스트가 되어 통합 신뢰가 사라진다. Kent C. Dodds의 "Don't mock what you don't own" 원칙대로, DB는 **Testcontainers로 실제 Postgres를 띄워** 검증한다.

## ❌ Incorrect

```ts
// src/orders/__tests__/orders.controller.integration.test.ts
jest.mock('../orders.repository'); // 통합 검증이 무의미해짐
```

## ✅ Correct

```ts
// beforeAll: Testcontainers로 실제 Postgres 기동 → Prisma migrate → AppModule 부팅
it('POST /orders persists and returns the order', async () => {
  const res = await request(app.getHttpServer())
    .post('/orders').send({ customerId: 'c1', total: 30 }).expect(201);
  const inDb = await prisma.order.findUnique({ where: { id: res.body.id } });
  expect(inDb).not.toBeNull();
});
```

## 관련 규칙
- [[repository-integration-real-db]]
- [[testcontainers-lifecycle]]
