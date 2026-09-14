---
ruleId: query-error-policy
summary: "react-query v5 에러 정책 — 폐기된 useErrorBoundary 옵션 금지(→ throwOnError). 경계로 던질지/로컬 처리할지 명시. 404는 장애 아닌 없음(경계 제외·페이지 없음 UI), 자동 재시도 기본 없음(retry: false 캐논)"
severity: important
appliesTo: ["src/store/**/*.{ts,tsx}", "src/business/**/*.{ts,tsx}"]
detection:
  - type: forbidden-pattern
    pattern: "useErrorBoundary\s*:"
    rationale: "react-query v4 useErrorBoundary 옵션은 v5에서 throwOnError로 대체됨 — 폐기 API 사용 금지"
relatedRules: [error-boundary-required, no-imperative-error-branch, server-vs-client-state]
---

# react-query 에러 정책을 명시한다 (v5)

`useQuery`/`useMutation`의 에러를 **경계로 던질지(throwOnError) 로컬에서 처리할지**를 명시한다.
던지면 [[error-boundary-required]]가 잡는다. 폐기된 v4 옵션(`useErrorBoundary`)은 쓰지 않는다.

## ❌ Incorrect

```ts
useQuery({ queryKey, queryFn, useErrorBoundary: true }); // ❌ v4 폐기 옵션
```

## ✅ Correct

```ts
// 경계로 위임 (전역/도메인 ErrorBoundary가 폴백)
useQuery({ queryKey, queryFn, throwOnError: true });

// 혹은 로컬에서 의도적으로 처리(가이드): throwOnError: false + UI에서 error 노출
useQuery({ queryKey, queryFn, throwOnError: false });
```

## 권장 기본값 (가이드, 강제 아님)

- 페이지 핵심 데이터: `throwOnError: true` → ApiErrorBoundary.
- 보조/위젯 데이터: `throwOnError: false` → 인라인 에러.
- `QueryClient` defaultOptions에 팀 기본 정책을 두고 쿼리별로 override.

## 404는 장애가 아니라 없음

404는 장애가 아니라 **없음**이다. `throwOnError`에서 notFound를 제외하고 페이지가 **없음 UI**를 렌더한다(문구는 페이지 소유). 키트 `classifyError`는 404를 `notFound` kind로 분류하고, `reportError`는 이를 캡처 제외(기대 오류)한다.

```ts
// 404는 경계로 던지지 않고 페이지가 없음 UI로 처리
useQuery({
  queryKey: postKeys.detail(id),
  queryFn,
  throwOnError: (error) => classifyError(error) !== 'notFound',
});
```

## 자동 재시도는 기본 없음 (retry: false 캐논)

자동 재시도는 에러 표면화를 늦추고(스피너 수 초) 경계의 재시도 버튼 UX와 중복된다. 키트 `queryClient`는 `defaultOptions.queries.retry: false`를 캐논으로 둔다 — 재시도 UX는 경계의 재시도 버튼이 담당. 알려진 불안정 엔드포인트만 per-query로 `retry`를 명시한다.

## 탐지 한계 (v1)

정규식은 폐기 옵션(`useErrorBoundary:`)만 강제 검출한다. `throwOnError` 명시 여부는
호출 형태가 다양해 자동검출하지 않고 본문 가이드로 둔다.

## 관련 규칙
- [[error-boundary-required]] — 던진 에러를 잡는 경계
- [[no-imperative-error-branch]] — 명령형 처리 금지
- [[server-vs-client-state]] — 서버 상태는 react-query
