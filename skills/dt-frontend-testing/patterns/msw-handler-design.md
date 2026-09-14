---
ruleId: msw-handler-design
summary: "MSW handler는 src/mocks/handlers.ts 단일 위치, 테스트별 server.use로 override"
severity: important
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: forbidden-call
    matches: ["setupServer"]
    rationale: "각 테스트마다 setupServer를 새로 만들지 말고 src/mocks/server.ts의 공유 server를 사용 + server.use()로 case별 override"
relatedRules: []
---

# MSW handler는 중앙에서 관리

## 왜 중요한가
테스트마다 setupServer를 새로 만들면 lifecycle이 흩어집니다. 공유 server를 두고 케이스별 `server.use()`로 override하는 패턴이 표준입니다.

## ❌ Incorrect

```ts
// test 파일 내부에서 매번 setupServer
import { setupServer } from 'msw/node';
import { http } from 'msw';

const server = setupServer(http.get('/posts', () => HttpResponse.json([])));
beforeAll(() => server.listen());
afterAll(() => server.close());
```

## ✅ Correct

```ts
// src/mocks/server.ts (공유)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);

// src/setupTests.ts (lifecycle 통합)
import { server } from './mocks/server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 테스트에서 case override
test('빈 응답', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () => HttpResponse.json([])),
  );
  // ...
});
```

## 관련 규칙
(없음)
