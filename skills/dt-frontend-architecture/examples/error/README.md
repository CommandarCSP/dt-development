# 에러 경계 + 폴백 키트 (참조 구현)

dt-frontend 선언적 에러 처리(계층형 ErrorBoundary)의 참조 구현.
에러는 **던지고** 경계가 **선언적으로** 잡는다 — 컴포넌트 본문 `if (isError) return <Fallback/>`나
`navigate('/error')` 같은 명령형 처리 금지. 전체 설계:
[에러 경계 계층](../../references/error-boundary-layering.md).

> 이 파일들은 **참조 구현 예시**다. 실제 프로젝트에선 `src/components/error/`에 배치한다.

## 구성

| 파일 | 역할 |
|---|---|
| `RootErrorBoundary` | App 최상단 경계 — 예상외/위임 에러 최종 캐치 (App 최상단에 배선) |
| `ApiErrorBoundary` | Domain Component 묶음 경계 — react-query reset 연계 + 재시도 |
| `LocalErrorBoundary` | 페이지 블록 경계 — 책임 밖(auth/runtime) 에러는 상위로 rethrow |
| `RetryErrorFallback` | Api 경계 기본 폴백 (재시도 버튼) |
| `LocalErrorSection` | 블록 단위 인라인 폴백 (나머지 영역 정상) |
| `RootErrorPage` | 전역 에러 페이지 |
| `classifyError` | 에러 분류 (kind 산출) |
| `reportError` | 경계·캐시 오류의 Sentry 캡처 단일 진입점 (분류→level/tag/fingerprint) |
| `httpMeta` | axios 구조에서 status/method/route 추출 + id 마스킹 |
| `sentry.config` | Sentry.init — PII 미수집·기대오류 필터·샘플링 |
| `queryClient` | QueryCache/MutationCache onError→reportError 배선 |
| `breadcrumbs` | 얇은 커스텀 브레드크럼 헬퍼(사용자 의도) |

## 사용

```tsx
// Page — Domain Component 묶음을 Api 경계로 감싼다 (error-boundary-required)
export function PostListPage() {
  return (
    <ApiErrorBoundary>
      <PostList limit={10} />
    </ApiErrorBoundary>
  );
}
```

```ts
// 쿼리는 정책을 명시해 경계로 던진다 (query-error-policy)
useQuery({ queryKey: postKeys.list({ limit }), queryFn, throwOnError: true });
```

## 관측 연동

Sentry 캡처는 `reportError.ts`에 구현 완료. 두 촉킹포인트(ErrorBoundary `onError` + QueryCache/MutationCache `onError`)가 모두 `reportError`로 합류한다. `reportError`에서 `classifyError`의 kind를 받아 level/tag/fingerprint를 산출하고 `Sentry.captureException`을 호출한다. 산발 캡처 금지([[sentry-single-capture]]). 배선은 이미 적용된 상태다.
