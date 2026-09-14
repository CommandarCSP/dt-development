---
ruleId: controller-requires-integration-test
summary: "모든 Controller는 형제 통합 테스트(*.integration.test.ts) 필수 (Supertest+실DB)"
severity: important
appliesTo: ["src/**/*.controller.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts"]
detection:
  - type: requires-sibling-test
    testPath: "__tests__/{basename}.integration.test.ts"
    rationale: "Controller는 HTTP 경계 — Supertest+Testcontainers로 라우팅·검증·상태코드를 실제로 검증"
relatedRules: [service-requires-unit-test]
---

# Controller는 통합 테스트를 동반한다

## 왜 중요한가
Controller의 가치는 "라우팅 + DTO 검증 + Service 연동 + 상태코드"가 실제로 맞물려 동작하는지에 있다. 이는 mock이 아니라 HTTP를 통해(Supertest) 실제 Service·Repository·DB(Testcontainers)와 함께 검증해야 의미가 있다.

`OrdersController`(`orders.controller.ts`)는 `__tests__/orders.controller.integration.test.ts`를 가져야 한다.

## ✅ Correct

```ts
// src/orders/__tests__/orders.controller.integration.test.ts
import request from 'supertest';
// beforeAll: Testcontainers로 Postgres 기동, AppModule 부팅

it('POST /orders → 201 with created order', async () => {
  const res = await request(app.getHttpServer())
    .post('/orders')
    .send({ customerId: 'c1', total: 30 })
    .expect(201);
  expect(res.body).toMatchObject({ total: 30 });
});

it('POST /orders with invalid body → 400', async () => {
  await request(app.getHttpServer()).post('/orders').send({}).expect(400);
});
```

## 관련 규칙
- [[service-requires-unit-test]]
