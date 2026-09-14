---
ruleId: integration-page
summary: "Page 통합 테스트는 MemoryRouter + MSW, 실 사용자 진입 시나리오 검증"
severity: important
appliesTo: ["src/pages/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "Page 테스트는 createMemoryRouter + RouterProvider + MSW로 라우팅 흐름까지 검증"
relatedRules: [integration-domain]
---

# Page Integration 테스트

```tsx
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { PostListPage } from '../PostListPage';

test('/posts 진입 시 목록 표시', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 1, title: '글', body: '' }]),
    ),
  );

  const router = createMemoryRouter(
    [{ path: '/posts', element: <PostListPage /> }],
    { initialEntries: ['/posts'] },
  );

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('글')).toBeInTheDocument();
});
```

## 관련 규칙
- [[integration-domain]]
