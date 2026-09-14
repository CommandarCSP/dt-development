---
ruleId: repository-only-prisma
summary: "@prisma/client import는 Repository와 PrismaModule에서만 — 그 외 레이어 금지"
severity: critical
appliesTo: ["src/**/*.ts"]
excludePathPatterns: ["src/**/*.repository.ts", "src/prisma/**", "src/**/prisma.service.ts", "src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**", "test/**"]
detection:
  - type: forbidden-import
    matches: ["@prisma/client"]
    rationale: "Prisma 클라이언트/생성 타입은 Repository 계층에만 가둔다 — 상위 레이어는 도메인 Model만 사용"
relatedRules: [controller-no-direct-prisma, service-no-direct-prisma, dto-vs-entity]
---

# Prisma는 Repository 계층에서만

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
- [[controller-no-direct-prisma]]
- [[service-no-direct-prisma]]
- [[dto-vs-entity]]
