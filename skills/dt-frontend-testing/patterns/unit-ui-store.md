---
ruleId: unit-ui-store
summary: "Zustand UI Store 단위 테스트, 초기값/setter/reset 상태 전이 검증"
severity: minor
appliesTo: ["src/store/stores/**/__tests__/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "UI Store 테스트는 초기값, setter 동작, 리셋(필요 시) 모두 커버"
relatedRules: [server-vs-client-state]
---

# UI Store 테스트

## 패턴

```ts
import { act } from '@testing-library/react';
import { usePostUiStore } from '../postUiStore';

test('초기값 list', () => {
  expect(usePostUiStore.getState().viewMode).toBe('list');
});

test('setViewMode("grid") 후 grid', () => {
  act(() => usePostUiStore.getState().setViewMode('grid'));
  expect(usePostUiStore.getState().viewMode).toBe('grid');
});
```

## 관련 규칙
- [[server-vs-client-state]]
