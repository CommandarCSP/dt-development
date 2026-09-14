---
ruleId: integration-no-hook-mocking
summary: "통합 테스트에서 hook을 mock하면 통합 의미 소실 — 절대 금지"
severity: critical
appliesTo: ["src/components/domain/**/__tests__/**/*.{ts,tsx}", "src/pages/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: forbidden-call
    matches: ["vi.mock"]
    matchArguments: ["**/business/hooks/**", "**/store/queries/**", "**/store/stores/**"]
    rationale: "Integration 테스트가 hook을 mock하면 통합 검증이 무의미해짐"
relatedRules: [integration-domain]
---

# Integration 테스트는 hook을 mock하지 않는다

## 왜 중요한가
Domain Component나 Page의 integration 테스트의 목적은 "여러 레이어가 함께 동작하는가"를 검증하는 것입니다. Business Hook이나 Store Query를 mock하면 사실상 unit 테스트가 되어 통합 신뢰가 사라집니다.

대신 **MSW로 네트워크 레이어만 stub**하고 그 외 모든 모듈은 실제 코드를 사용합니다.

## ❌ Incorrect

```tsx
// src/components/domain/__tests__/PostList.test.tsx
import { vi } from 'vitest';

vi.mock('../../../business/hooks/posts/usePostListViewModel', () => ({
  usePostListViewModel: () => ({
    posts: [{ id: 1, title: '글', authorId: 1, body: '' }],
    isLoading: false,
    isError: false,
  }),
}));

test('렌더링', () => {
  render(<PostList limit={10} />);
  expect(screen.getByText('글')).toBeInTheDocument();
});
```

## ✅ Correct

```tsx
// src/components/domain/__tests__/PostList.test.tsx
import { server } from '../../../mocks/server';
import { http, HttpResponse } from 'msw';

test('렌더링', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 1, title: '글', body: '' }]),
    ),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PostList limit={10} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByText('글')).toBeInTheDocument();
});
```

## 관련 규칙
- [[integration-domain]]
