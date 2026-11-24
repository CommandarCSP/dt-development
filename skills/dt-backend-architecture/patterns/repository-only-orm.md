---
ruleId: repository-only-orm
summary: "ORM(기본 Prisma) import는 Repository와 ORM 설정 자리에서만 — 그 외 레이어 금지"
severity: critical
appliesTo: ["src/**/*.ts"]
excludePathPatterns: ["src/**/*.repository.ts", "$orm.allowedPaths", "src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**", "test/**"]
detection:
  - type: forbidden-import
    matches: ["$orm.imports"]
    rationale: "ORM 클라이언트/생성 타입은 Repository 계층에만 가둔다 — 상위 레이어는 도메인 Model만 사용"
requiresStack: [orm]
relatedRules: [controller-no-direct-orm, service-no-direct-orm, dto-vs-entity]
---

# ORM은 Repository 계층에서만

> 검사하는 import와 허용 자리는 스택 설정 `stack.orm`(prisma·typeorm·drizzle)에 따라 바뀐다 — `docs/refs/stack-config.md` §4. 예시는 기본값 Prisma. TypeORM이면 `*.entity.ts`·`migrations/`·`*.module.ts`(`TypeOrmModule.forFeature`)도 허용 자리다.

## 왜 중요한가
`@prisma/client`를 한 계층(Repository)에만 가두면 ORM 교체·쿼리 최적화·트랜잭션 경계가 한 곳에 모인다. 상위 레이어가 Prisma가 생성한 모델 타입을 직접 쓰면:
- DB 스키마 변경이 Controller/Service까지 파급
- 도메인 Model과 DB row가 구분되지 않음
- 직렬화 시 내부 컬럼이 그대로 응답에 노출

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
import { Order } from '@prisma/client'; // 상위 레이어가 Prisma 타입에 의존
```

## ✅ Correct

```ts
// src/orders/orders.repository.ts  ← 유일하게 허용되는 위치
import { PrismaClient } from '@prisma/client';
// 상위 레이어는 contracts의 도메인 Model 타입만 import
```

## 관련 규칙
- [[controller-no-direct-orm]]
- [[service-no-direct-orm]]
- [[dto-vs-entity]]
