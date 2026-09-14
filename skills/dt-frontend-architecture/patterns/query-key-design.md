---
ruleId: query-key-design
summary: "queryKey는 변경되는 모든 파라미터를 포함하는 팩토리로 정의 (캐시 분리 보장)"
severity: critical
appliesTo: ["src/store/queries/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "queryKey 팩토리는 파라미터를 받는 경우 그 파라미터를 key에 포함해야 한다. useQuery 호출 시 queryKey가 정적 문자열이고 queryFn이 변수를 사용하면 위반."
relatedRules: [adding-business-params]
---

# queryKey에 파라미터 포함

## 왜 중요한가
TanStack Query 캐시는 queryKey로 구분됩니다. 파라미터가 다른데 같은 key를 쓰면 캐시 충돌이 발생해 잘못된 데이터가 보입니다.

## ❌ Incorrect

```ts
// limit이 달라도 같은 캐시 → 잘못된 데이터
export const postKeys = {
  all: ['posts'] as const,
};

export function usePostListQuery({ limit }: { limit: number }) {
  return useQuery({
    queryKey: postKeys.all, // 파라미터 누락
    queryFn: () => apiClient.get(`/posts?_limit=${limit}`),
  });
}
```

## ✅ Correct

```ts
export const postKeys = {
  all: ['posts'] as const,
  lists: () => [...postKeys.all, 'list'] as const,
  list: (params: { limit: number }) => [...postKeys.lists(), params] as const,
  details: () => [...postKeys.all, 'detail'] as const,
  detail: (id: number) => [...postKeys.details(), id] as const,
};

export function usePostListQuery({ limit }: { limit: number }) {
  return useQuery({
    queryKey: postKeys.list({ limit }), // 파라미터 포함
    queryFn: () => apiClient.get(`/posts?_limit=${limit}`),
  });
}
```

## 관련 규칙
- [[adding-business-params]]
