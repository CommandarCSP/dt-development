---
ruleId: integration-domain
summary: "Domain 컴포넌트 통합 테스트, 실제 hook + MSW, hook mock 금지"
severity: important
appliesTo: ["src/components/domain/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: pattern-pair
    when: "\b(?:test|it)\("
    requireAll: ["\b(?:http|rest)\.(?:get|post|put|patch|delete|all)\(|server\.use\(|setupServer\(", "status:\s*[45]\d\d|HttpResponse\.error\(|\.networkError\(|mockRejected|\.rejects\b|isError"]
    forbid: "vi\.mock\([^)]*(?:business|store)"
    rationale: "Domain 테스트는 실제 hook + MSW 로 돈다 — MSW 핸들러가 없거나, 에러 응답 분기가 없거나, business·store 를 vi.mock 으로 바꿔 끼웠다"
  - type: manual
    description: "loading·data·error 세 분기를 모두 화면으로 확인하는지는 사람이 본다"
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
