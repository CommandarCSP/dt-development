---
ruleId: business-logic-purity
summary: "순수 비즈니스 함수는 <domain>Business.ts에 모으고 sibling 단위 테스트 필수"
severity: important
appliesTo: ["src/business/hooks/**/*Business.ts"]
detection:
  - type: requires-sibling-test
    testPath: "__tests__/{basename}.test.ts"
    rationale: "<domain>Business.ts는 순수 함수만 모은 모듈이므로 단위 테스트 필수"
relatedRules: [where-does-business-logic-go]
---

# 순수 비즈니스 함수는 `<domain>Business.ts`에 모으고 단위 테스트한다

## 왜 중요한가
ViewModel hook 파일(`use*ViewModel.ts`)은 query + transform + state를 조립하는 통합 단위라 테스트하려면 RTL + QueryClient + MSW 셋업이 필요하다.
반면 DTO→Model 변환, 정렬·필터·파생값 계산 같은 **순수 함수**는 React/Query 의존 없이 동작한다. 같은 파일에 두면 테스트가 무거워지고, 순수 함수 단독의 엣지 케이스 검증이 누락되기 쉽다.

## 컨벤션

1. 도메인의 순수 비즈니스 함수(transform, formatter, calculator, filter 등)는 모두 `src/business/hooks/<domain>/<domain>Business.ts`에 export
2. ViewModel hook은 이 함수들을 import해서 조립만 담당 (`useXxxViewModel.ts`)
3. `<domain>Business.ts`마다 `__tests__/<domain>Business.test.ts`를 작성 — **이 룰이 자동 검출**

## 파일 구조 예시

```
src/business/hooks/posts/
  postsBusiness.ts                 # 순수 함수 모음
  usePostListViewModel.ts          # hook (조립)
  usePostDetailViewModel.ts        # hook (조립)
  __tests__/
    postsBusiness.test.ts          # 단위 테스트 (필수)
    usePostListViewModel.test.ts   # 통합 테스트
    usePostDetailViewModel.test.ts # 통합 테스트
```

## ❌ Incorrect

```ts
// usePostListViewModel.ts
function toPost(dto) { ... }            // 내부에 묻혀 단위 테스트 불가
export function usePostListViewModel() {
  const { data } = usePostListQuery();
  return { posts: data?.map(toPost) ?? [] };
}
```

## ✅ Correct

```ts
// postsBusiness.ts
export function toPost(dto: PostDto): Post { ... }
// (필요시) export function sortByDate(...) { ... }

// usePostListViewModel.ts
import { toPost } from './postsBusiness';
export function usePostListViewModel() {
  const { data } = usePostListQuery();
  return { posts: data?.map(toPost) ?? [] };
}

// __tests__/postsBusiness.test.ts
describe('toPost', () => {
  it('userId를 authorId로 매핑한다', () => {
    expect(toPost({ id: 1, userId: 7, title: 'T', body: 'B' }))
      .toEqual({ id: 1, authorId: 7, title: 'T', body: 'B' });
  });
});
```

## 관련 규칙
- [[where-does-business-logic-go]]
