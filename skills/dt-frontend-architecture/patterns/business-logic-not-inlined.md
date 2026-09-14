---
ruleId: business-logic-not-inlined
summary: "ViewModel hook 파일(use*ViewModel.ts)에 순수 transform/계산 함수를 인라인 정의 금지 — <domain>Business.ts로 추출"
severity: important
appliesTo: ["src/business/hooks/**/use*ViewModel.ts", "src/business/hooks/**/use*ViewModel.tsx"]
detection:
  - type: forbidden-pattern
    pattern: "^(export )?function (?!use)[a-zA-Z]"
    rationale: "ViewModel 파일의 모듈 레벨 함수 선언(예: function toPost(dto){...})은 순수 비즈니스 로직이 인라인된 신호 — <domain>Business.ts로 추출하고 import해 조립만"
  - type: forbidden-pattern
    pattern: "^const (to|from|format|sort|filter|calc|parse|build|group|map|merge|normalize)[A-Z][a-zA-Z]* ?="
    rationale: "ViewModel 파일의 모듈 레벨 transform/계산 const(예: const toPost = ...)는 순수 함수 인라인 — <domain>Business.ts로 추출"
relatedRules: [business-logic-purity, where-does-business-logic-go]
---

# ViewModel에 순수 로직을 인라인하지 않는다 (Business.ts로 추출)

## 왜 중요한가
`business-logic-purity`는 `<domain>Business.ts`가 **존재할 때** sibling 단위 테스트를 강제한다. 하지만 순수 함수를 아예 ViewModel 안에 인라인해 `<domain>Business.ts`를 **만들지 않으면** 그 룰이 매칭할 대상이 없어 조용히 통과한다. 이 룰은 그 **부재(누락)를 잡는 짝**이다 — ViewModel 파일에 모듈 레벨 순수 함수가 보이면 위반으로 표시한다.

## 무엇을 잡나
`src/business/hooks/<domain>/use*ViewModel.ts`에서:
- 모듈 레벨 함수 선언 `function toX(...) {}` (hook `use*` 제외)
- 모듈 레벨 transform/계산 const `const toX = ...` / `const sortX = ...` 등

→ 이런 게 있으면 "순수 로직이 인라인됨 → `<domain>Business.ts`로 추출" 권고.

## ❌ Incorrect (use*ViewModel.ts)
```ts
function toPost(dto: PostDto): Post { ... }   // ← 모듈 레벨 인라인 (위반)
export const usePostListViewModel = () => {
  const { data } = usePostListQuery();
  return { posts: data?.map(toPost) ?? [] };
};
```

## ✅ Correct
```ts
// postsBusiness.ts
export function toPost(dto: PostDto): Post { ... }

// usePostListViewModel.ts
import { toPost } from './postsBusiness';
export const usePostListViewModel = () => {
  const { data } = usePostListQuery();
  return { posts: data?.map(toPost) ?? [] };
};
```

## 한계 (휴리스틱)
정규식 기반이라 hook 내부에 정의된 이벤트 핸들러(들여쓰기됨)는 잡지 않고, 모듈 레벨(들여쓰기 0) 선언만 잡는다. 드물게 오탐이 있으면 리뷰어가 판정한다(severity: important — 머지 차단 아님, 추출 권고).

## 관련 규칙
- [[business-logic-purity]] — 추출된 Business.ts에 sibling 테스트 강제 (이 룰의 짝)
- [[where-does-business-logic-go]]
