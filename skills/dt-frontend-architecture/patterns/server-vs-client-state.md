---
ruleId: server-vs-client-state
summary: "서버 데이터는 TanStack Query, UI 상태는 Zustand — 역할 절대 섞지 않음"
severity: important
appliesTo: ["src/store/stores/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "Zustand store가 API 응답 데이터를 저장하면 위반 (서버 데이터는 TanStack Query에). 반대로 Store Query가 UI 토글 상태를 캐싱하면 위반."
relatedRules: [where-does-business-logic-go]
---

# Server 상태는 TanStack Query, Client 상태는 Zustand

## 왜 중요한가
역할 분리가 모호하면:
- 서버 데이터를 Zustand에 직접 넣으면 캐싱/재검증/낙관 업데이트가 모두 깨짐
- UI 토글을 Query 캐시에 넣으면 stale time/refetch 정책이 의미 없어짐

## ❌ Incorrect

```ts
// Zustand에 서버 데이터
export const usePostStore = create((set) => ({
  posts: [], // 서버 데이터를 Zustand에
  fetchPosts: async () => {
    const { data } = await axios.get('/posts');
    set({ posts: data });
  },
}));
```

## ✅ Correct

```ts
// 서버 데이터: TanStack Query
export function usePostListQuery() {
  return useQuery({
    queryKey: postKeys.all,
    queryFn: () => apiClient.get('/posts').then((r) => r.data),
  });
}

// UI 상태: Zustand
export const usePostUiStore = create<{ viewMode: 'list' | 'grid'; setViewMode: (m: 'list' | 'grid') => void }>((set) => ({
  viewMode: 'list',
  setViewMode: (viewMode) => set({ viewMode }),
}));
```

## 관련 규칙
- [[where-does-business-logic-go]]
