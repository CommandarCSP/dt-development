---
ruleId: service-no-http-context
summary: "Service는 HTTP 컨텍스트(@Req/@Res/express Request·Response) 접근 금지 — transport 무관"
severity: critical
appliesTo: ["src/**/*.service.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: forbidden-import
    matches: ["express"]
    rationale: "Service가 express Request/Response 타입에 의존하면 transport에 묶임"
  - type: forbidden-pattern
    pattern: "@(Req|Res|Body|Query|Param|Headers|Session|Ip)[ ]*[(]"
    rationale: "HTTP 파라미터 데코레이터는 Controller 전용 — Service로 새면 계층 경계 붕괴"
relatedRules: [controller-no-business-logic]
---

# Service는 HTTP 컨텍스트를 알지 못한다

## 왜 중요한가
Service는 HTTP/REST뿐 아니라 큐 컨슈머·스케줄러·CLI에서도 호출될 수 있어야 한다. `@Req`/`@Res`나 express `Request`/`Response`가 Service에 들어오면:
- transport(HTTP)에 결합되어 재사용 불가
- 응답을 Service가 직접 써버려 전역 인터셉터/필터를 우회
- 단위 테스트에 가짜 req/res를 만들어야 함

Controller가 요청에서 필요한 값만 뽑아 평범한 인자로 Service에 넘긴다.

## ❌ Incorrect

```ts
// src/orders/orders.service.ts
import { Request } from 'express';

@Injectable()
export class OrdersService {
  place(@Body() body: unknown, req: Request) { /* ... */ }
}
```

## ✅ Correct

```ts
// src/orders/orders.service.ts
@Injectable()
export class OrdersService {
  place(input: NewOrder, userId: string): Promise<Order> { /* ... */ }
}
```

## 관련 규칙
- [[controller-no-business-logic]]
