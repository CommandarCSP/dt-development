---
ruleId: no-imperative-error-branch
summary: "에러를 명령형으로 처리 금지 — fetcher/컴포넌트에서 navigate('/error')·history.push('/error')로 라우팅하지 말고 ErrorBoundary에 위임"
severity: important
appliesTo: ["src/**/*.{ts,tsx}"]
excludePathPatterns: ["src/components/error/**"]
detection:
  - type: forbidden-pattern
    pattern: "(?:navigate|history\.push|router\.push|location\.assign)\(\s*['\x22\x60]/(?:error|500|error-page)"
    rationale: "에러 발생 시 에러 페이지로 명령형 라우팅 금지 — 선언적 ErrorBoundary 폴백으로 처리"
relatedRules: [error-boundary-required, query-error-policy]
---

# 에러는 선언적 경계로, 명령형 분기로 처리하지 않는다

에러가 났을 때 코드 곳곳에서 `navigate('/error')`로 보내거나 컴포넌트 본문에서
`if (isError) return <Fallback/>`로 분기하면 처리 지점이 흩어지고 중복된다.
에러는 **던지고**, 경계가 **선언적으로** 잡는다([[error-boundary-required]]).

## ❌ Incorrect

```ts
// services/postFetcher.ts (인터셉터/페처에서 라우팅)
if (err.response?.status >= 500) {
  history.push('/error'); // ❌ 명령형 에러 라우팅
}
```

```tsx
function PostList() {
  const { isError } = usePostListQuery();
  if (isError) return <ErrorFallback />; // ❌ 본문 명령형 분기 (가이드: 경계로)
}
```

## ✅ Correct

```tsx
// query는 throwOnError로 던지고([[query-error-policy]]), 경계가 잡는다
<ApiErrorBoundary>
  <PostList />
</ApiErrorBoundary>
```

## 탐지 범위

정규식은 **에러 페이지로의 명령형 라우팅**(`navigate/history.push/router.push/location.assign('/error'...)`)만
강제 검출한다. `if (isError) return <Fallback/>` 형태는 로딩/빈 상태와 구분이 어려워 본문 가이드로 둔다(과검출 회피).
`src/components/error/**`(경계/폴백 키트 자체)는 제외.

## 관련 규칙
- [[error-boundary-required]] — 경계 존재 강제
- [[query-error-policy]] — 던질지/로컬 처리할지 정책
