---
ruleId: pure-view-component
summary: "View는 props만 받는 순수 컴포넌트, hook/store/router 직접 호출 금지"
severity: critical
appliesTo: ["src/components/view/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["@tanstack/react-query", "zustand", "react-router-dom", "../../store/**", "../../business/**"]
    rationale: "View Component는 props만 받아 렌더링하는 순수 컴포넌트"
  - type: forbidden-call
    matches: ["useQuery", "useMutation", "useStore", "useNavigate", "useParams"]
    rationale: "View Component는 hook을 호출하지 않음"
relatedRules: [where-does-business-logic-go, interactive-a11y, list-empty-state]
---

# View 컴포넌트는 props만 받아 렌더링

## 왜 중요한가
View Component가 외부 상태나 라우터를 직접 의존하면:
- 어떤 화면에서나 재사용 불가
- 테스트가 어려움 (router/store 설정이 필요)
- 책임 분리가 깨져 Domain과 구분이 없어짐

## ❌ Incorrect

```tsx
// src/components/view/PostCard.tsx
import { useNavigate } from 'react-router-dom';
import { usePostUiStore } from '../../store/stores/postUiStore';

export function PostCard({ post }) {
  const navigate = useNavigate(); // 위반
  const { highlightId } = usePostUiStore(); // 위반
  return <div onClick={() => navigate(`/posts/${post.id}`)}>{post.title}</div>;
}
```

## ✅ Correct

```tsx
// src/components/view/PostCard.tsx
import type { KeyboardEvent } from 'react';

interface Props {
  post: Post;
  onClick: (id: number) => void;
  highlighted?: boolean;
}

export function PostCard({ post, onClick, highlighted }: Props) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(post.id);
    }
  }

  // View는 여전히 props만 받는 순수 컴포넌트 — 클릭 동작은 onClick prop으로 위임하되,
  // 비버튼 요소이므로 키보드 접근성 3종(role·tabIndex·onKeyDown)을 직접 갖춘다.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(post.id)}
      onKeyDown={handleKeyDown}
      style={{ background: highlighted ? '#ffd' : undefined }}
    >
      {post.title}
    </div>
  );
}
```

라우팅/Store 접근은 Domain Component가 담당합니다.

## 관련 규칙
- [[where-does-business-logic-go]]
- [[domain-no-direct-api]]
- [[interactive-a11y]]
- [[list-empty-state]]
