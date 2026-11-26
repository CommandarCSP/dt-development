---
ruleId: unit-view-component
summary: "View 단위 테스트, props만으로 렌더링/콜백 검증, router/store wrapper 금지"
severity: important
appliesTo: ["src/components/view/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: manual
    description: "View 테스트가 props 를 바꿔 가며 화면·콜백만 검증하는지는 사람이 본다. 기계로 볼 수 있는 부분(store·router·business import 금지)은 짝 규칙 view-test-props-only 가 검사한다 — 같은 검사를 두 번 걸지 않는다"
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
