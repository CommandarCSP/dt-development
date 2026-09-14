---
ruleId: unit-view-component
summary: "View 단위 테스트, props만으로 렌더링/콜백 검증, router/store wrapper 금지"
severity: important
appliesTo: ["src/components/view/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "View 테스트는 props 변형을 통한 시각/콜백 검증만 수행. (view-test-props-only와 짝)"
relatedRules: [view-test-props-only, pure-view-component]
---

# View Component 테스트

## 패턴

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PostCard } from '../PostCard';

const post = { id: 1, title: '제목', authorId: 2, body: '' };

test('title 렌더링', () => {
  render(<PostCard post={post} onClick={() => {}} />);
  expect(screen.getByText('제목')).toBeInTheDocument();
});

test('클릭 시 id로 onClick 호출', () => {
  const handle = vi.fn();
  render(<PostCard post={post} onClick={handle} />);
  fireEvent.click(screen.getByRole('article'));
  expect(handle).toHaveBeenCalledWith(1);
});
```

## 관련 규칙
- [[view-test-props-only]]
- [[pure-view-component]]
