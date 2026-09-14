---
ruleId: domain-no-direct-api
summary: "Domain Component는 axios/apiClient 직접 호출 금지, Business Hook(ViewModel) 경유"
severity: critical
appliesTo: ["src/components/domain/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["axios", "../../utils/apiClient", "../../../utils/apiClient", "**/utils/apiClient"]
    rationale: "Domain Component는 Business Hook을 통해서만 데이터에 접근"
relatedRules: [where-does-business-logic-go]
---

# Domain 컴포넌트는 API 직접 호출 금지

## 왜 중요한가
Domain Component는 ViewModel을 받아서 View에 조립하는 책임만 가집니다. API 호출이 Domain에 섞이면:
- 캐싱/에러/로딩이 일관되지 못함 (TanStack Query 우회)
- 테스트가 어려움 (네트워크 mocking이 Domain에 흩어짐)
- 같은 데이터를 여러 Domain이 중복으로 가져옴

## ❌ Incorrect

```tsx
// src/components/domain/PostList.tsx
import axios from 'axios';

export function PostList() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    axios.get('/posts').then((r) => setPosts(r.data));
  }, []);
  return posts.map((p) => <PostCard post={p} />);
}
```

## ✅ Correct

```tsx
// src/components/domain/PostList.tsx
import { usePostListViewModel } from '../../business/hooks/posts/usePostListViewModel';

export function PostList({ limit }: { limit: number }) {
  const { posts, isLoading } = usePostListViewModel({ limit });
  if (isLoading) return <p>로딩 중...</p>;
  return posts.map((p) => <PostCard post={p} />);
}
```

## 관련 규칙
- [[where-does-business-logic-go]]
