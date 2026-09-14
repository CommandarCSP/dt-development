---
ruleId: view-test-props-only
summary: "View 테스트는 props만 — store/router import 금지 (테스트 무의미해짐)"
severity: critical
appliesTo: ["src/components/view/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["@tanstack/react-query", "zustand", "react-router-dom", "**/store/**", "**/business/**"]
    rationale: "View 테스트는 props만 주입"
relatedRules: [pure-view-component]
---

# View 테스트는 props만

## 왜 중요한가
View 컴포넌트가 외부 의존성이 없는 순수 컴포넌트이므로 테스트도 동일하게 외부 의존 없이 props만 주입합니다. router/store를 import하면 그 자체로 View의 순수성이 깨졌다는 신호입니다.

## ❌ Incorrect

```tsx
// src/components/view/__tests__/PostCard.test.tsx
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

test('렌더링', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <PostCard post={post} onClick={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
});
```

## ✅ Correct

```tsx
// src/components/view/__tests__/PostCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from '../PostCard';

test('post.title을 보여주고 onClick이 id로 호출된다', () => {
  const handleClick = vi.fn();
  render(<PostCard post={{ id: 7, title: '제목', authorId: 1, body: '' }} onClick={handleClick} />);

  expect(screen.getByText('제목')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('article'));
  expect(handleClick).toHaveBeenCalledWith(7);
});
```

## 관련 규칙
- [[pure-view-component]]
