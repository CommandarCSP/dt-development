---
ruleId: repository-integration-real-db
summary: "Repository 테스트는 실제 Postgres(Testcontainers)에서 쿼리·제약·트랜잭션을 검증"
severity: important
appliesTo: ["src/**/__tests__/**/*.repository.integration.test.ts", "src/**/__tests__/**/*.integration.test.ts"]
detection:
  - type: forbidden-pattern
    pattern: "jest\.mock\(\s*['"]@prisma\/client|mockDeep<\s*PrismaClient|createMock<\s*Prisma|PrismaService\s*,\s*useValue"
    rationale: "통합 테스트에서 Prisma 를 mock 하면 쿼리·제약·트랜잭션을 검증하지 못한다 — Testcontainers 실 DB 를 쓴다"
relatedRules: [integration-no-db-mocking, testcontainers-lifecycle]
---

# Repository는 실제 DB에서 검증한다

## 왜 중요한가
Repository는 Prisma 쿼리·유니크 제약·FK·트랜잭션을 다룬다. 이를 mock하면 정작 검증해야 할 것(실제 SQL 동작)을 검증하지 못한다. Testcontainers로 실제 Postgres를 띄우고 `prisma migrate deploy` 후 쿼리를 검증한다.

## ✅ Correct

```ts
it('enforces unique email', async () => {
  await repo.create({ email: 'a@x.com' });
  await expect(repo.create({ email: 'a@x.com' })).rejects.toThrow(/unique/i);
});
```

## 관련 규칙
- [[integration-no-db-mocking]]
- [[testcontainers-lifecycle]]
