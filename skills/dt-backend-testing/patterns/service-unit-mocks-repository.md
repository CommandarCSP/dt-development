---
ruleId: service-unit-mocks-repository
summary: "Service 단위 테스트는 Repository provider를 mock해 비즈니스 로직만 격리 검증"
severity: important
appliesTo: ["src/**/__tests__/**/*.unit.test.ts"]
detection: []
relatedRules: [integration-no-db-mocking, controller-integration-supertest]
---

# Service 단위 테스트는 Repository를 mock한다

## 왜 중요한가
단위 테스트는 빠르고 결정적이어야 한다. Service의 비즈니스 로직(계산/분기/조합)을 검증할 때는 `Test.createTestingModule`로 Repository를 가짜 provider로 주입해 DB 없이 로직만 격리한다. (실제 DB 검증은 integration 계층의 책임이다.)

## ✅ Correct

```ts
const repo = { create: jest.fn().mockResolvedValue({ id: '1', total: 30 }) };
const moduleRef = await Test.createTestingModule({
  providers: [OrdersService, { provide: OrdersRepository, useValue: repo }],
}).compile();
const service = moduleRef.get(OrdersService);

it('rejects empty orders', async () => {
  await expect(service.place({ items: [] })).rejects.toThrow();
});
```

## 관련 규칙
- [[integration-no-db-mocking]]
- [[controller-integration-supertest]]
