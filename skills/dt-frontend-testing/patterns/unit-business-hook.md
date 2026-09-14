---
ruleId: unit-business-hook
summary: "Business Hook 단위 테스트, MSW + queryWrapper, DTO→Model 변환과 상태 검증"
severity: important
appliesTo: ["src/business/hooks/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: forbidden-call
    matches: ["vi.mock"]
    matchArguments: ["**/store/queries/**"]
    rationale: "Business Hook 테스트도 Store Query를 mock하지 말고 MSW로 stub"
relatedRules: [integration-no-hook-mocking, msw-handler-design]
---

# Business Hook 테스트

## 패턴

```tsx
// src/business/hooks/posts/__tests__/usePostListViewModel.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import { createQueryWrapper } from '../../../../test-utils/queryWrapper';
import { usePostListViewModel } from '../usePostListViewModel';

test('DTO를 Post로 변환', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 7, title: 'a', body: 'b' }]),
    ),
  );

  const { result } = renderHook(() => usePostListViewModel({ limit: 10 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.posts).toEqual([{ id: 1, authorId: 7, title: 'a', body: 'b' }]);
});
```

## 관련 규칙
- [[integration-no-hook-mocking]]
- [[msw-handler-design]]
