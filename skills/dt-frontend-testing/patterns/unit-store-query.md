---
ruleId: unit-store-query
summary: "Store Query 단위 테스트, MSW로 응답 stub, queryKey 파라미터별 캐시 분리 확인"
severity: important
appliesTo: ["src/store/queries/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "Store Query 테스트는 happy/error 케이스 + 같은 hook의 다른 파라미터 호출 시 캐시 분리 확인을 포함해야 한다."
relatedRules: [query-key-design, msw-handler-design]
---

# Store Query 테스트

## 왜 중요한가
queryKey가 파라미터를 정확히 반영하는지, 그리고 happy/error 분기가 모두 작동하는지를 검증해야 캐시 오염 사고를 막을 수 있습니다.

## 패턴

```tsx
// src/store/queries/posts/__tests__/usePostListQuery.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../mocks/server';
import { createQueryWrapper } from '../../../../test-utils/queryWrapper';
import { usePostListQuery } from '../usePostListQuery';

test('happy: data 반환', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () =>
      HttpResponse.json([{ id: 1, userId: 1, title: 'a', body: '' }]),
    ),
  );

  const { result } = renderHook(() => usePostListQuery({ limit: 10 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(1);
});

test('error: isError true', async () => {
  server.use(
    http.get('https://jsonplaceholder.typicode.com/posts', () => HttpResponse.error()),
  );

  const { result } = renderHook(() => usePostListQuery({ limit: 10 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => expect(result.current.isError).toBe(true));
});
```

## 관련 규칙
- [[query-key-design]]
- [[msw-handler-design]]
