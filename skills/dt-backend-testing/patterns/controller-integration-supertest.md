---
ruleId: controller-integration-supertest
summary: "Controller 통합 테스트는 Supertest로 HTTP를 통해 라우팅·검증·상태코드를 검증"
severity: important
appliesTo: ["src/**/__tests__/**/*.integration.test.ts"]
detection: []
relatedRules: [controller-requires-integration-test, integration-no-db-mocking]
---

# Controller 통합 테스트는 Supertest로 HTTP를 친다

## 왜 중요한가
Controller의 가치는 라우팅 + DTO 검증(ValidationPipe) + Service 연동 + 상태코드가 실제로 맞물리는지에 있다. 메서드를 직접 호출하면 파이프/가드/필터가 동작하지 않아 의미가 없다. **Supertest로 실제 HTTP 요청**을 보내 검증한다.

## ✅ Correct

```ts
it('POST /orders with invalid body → 400', async () => {
  await request(app.getHttpServer()).post('/orders').send({}).expect(400);
});

it('GET /orders/:id missing → 404', async () => {
  await request(app.getHttpServer()).get('/orders/nope').expect(404);
});
```

## 관련 규칙
- [[controller-requires-integration-test]]
- [[integration-no-db-mocking]]
