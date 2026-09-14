---
ruleId: where-does-business-logic-go
summary: "Business Hook=ViewModel 가공, Store Query=fetching, View=렌더링 — 레이어 책임 위반 금지"
severity: important
appliesTo: ["src/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "Business Hook이 JSX를 반환하거나 DOM 요소를 import하면 위반. Store Query가 ViewModel 변환을 수행하면 위반."
relatedRules: [dto-vs-viewmodel, server-vs-client-state]
---

# 비즈니스 로직은 Business Hook 레이어에

## 왜 중요한가
"이 로직 어디에 둘까"가 흩어지면 코드베이스가 일관성을 잃습니다. 5레이어 아키텍처에서 변환·결합·UI 가공 로직의 정착지는 Business Hook입니다.

## ❌ Incorrect

```ts
// Store Query에서 변환까지 — 책임 혼합
export function usePostListQuery() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data } = await apiClient.get('/posts');
      return data.map((d) => ({ id: d.id, title: d.title, authorId: d.userId })); // ViewModel 가공
    },
  });
}
```

```tsx
// Domain Component에서 변환 — 책임 혼합
export function PostList() {
  const { data } = usePostListQuery();
  const posts = data?.map((d) => ({ id: d.id, authorId: d.userId })); // 가공
  return posts.map((p) => <PostCard post={p} />);
}
```

## ✅ Correct

```ts
// Store Query: 응답을 그대로
export function usePostListQuery() {
  return useQuery({
    queryKey: postKeys.all,
    queryFn: () => apiClient.get<PostDto[]>('/posts').then((r) => r.data),
  });
}

// Business Hook: 변환
function toPost(dto: PostDto): Post {
  return { id: dto.id, title: dto.title, authorId: dto.userId };
}
export function usePostListViewModel() {
  const { data, isLoading } = usePostListQuery();
  return { posts: data?.map(toPost) ?? [], isLoading };
}

// Domain Component: 받아서 조립만
export function PostList() {
  const { posts, isLoading } = usePostListViewModel();
  // ...
}
```

## 관련 규칙
- [[dto-vs-viewmodel]]
- [[server-vs-client-state]]
