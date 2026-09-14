---
ruleId: integration-domain
summary: "Domain 컴포넌트 통합 테스트, 실제 hook + MSW, hook mock 금지"
severity: important
appliesTo: ["src/components/domain/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "Domain Component 테스트는 실제 hook + MSW 사용. loading/data/error 분기 모두 커버."
relatedRules: [integration-no-hook-mocking]
---

# Domain Component Integration 테스트

```tsx
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { server } from '../../../mocks/server';
import { PostList } from '../PostList';

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

test('data 분기', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 1, title: '글', body: '' }]),
    ),
  );
  wrap(<PostList limit={10} />);
  expect(await screen.findByText('글')).toBeInTheDocument();
});

test('error 분기', async () => {
  server.use(http.get('https://jsonplaceholder.typicode.com/posts', () => HttpResponse.error()));
  wrap(<PostList limit={10} />);
  expect(await screen.findByText(/오류/)).toBeInTheDocument();
});
```

## 관련 규칙
- [[integration-no-hook-mocking]]
