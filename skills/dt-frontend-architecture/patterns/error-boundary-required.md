---
ruleId: error-boundary-required
summary: "Page는 자식을 최소 1개 ErrorBoundary로 감싼다 — 렌더 중 throw를 선언적으로 잡아 폴백 UI로 (react-error-boundary)"
severity: important
appliesTo: ["src/pages/**/*.{tsx}"]
detection:
  - type: required-pattern
    description: "page must wrap children in an error boundary"
relatedRules: [no-imperative-error-branch, query-error-policy, fallback-escalation, pure-view-component]
---

# Page는 ErrorBoundary로 자식을 감싼다

페이지 렌더 경로에서 던져진 에러(데이터 throw 포함)는 **선언적 ErrorBoundary**가 잡아
폴백 UI로 전환한다. 컴포넌트 본문에서 `if (isError) return <Fallback/>`로 분기하지 않는다([[no-imperative-error-branch]]).

## 계층 매핑 (5-layer ↔ 경계)

| 경계 | 위치 | 책임 |
|---|---|---|
| RootErrorBoundary | App/최상단 | 런타임/예상외 에러 최종 캐치 → 전역 에러 페이지 |
| ApiErrorBoundary | Domain Component 묶음 | API/도메인 에러 폴백 + 재시도(react-query reset 연계) |
| LocalErrorBoundary | 페이지 블록 | 일부만 폴백(나머지 영역 정상) |

흐름: `Root → Api(Domain) → Local → children`. 하위 fallback은 책임 외 에러를 rethrow해 상위로 위임([[fallback-escalation]]). 상세 분류·코드는 [에러 경계 계층](../references/error-boundary-layering.md).

## 표준 라이브러리

`react-error-boundary`(Sentry 비의존)를 기본 채택 — `<ErrorBoundary FallbackComponent={...} onReset={...} resetKeys={[...]}>`.
react-query 연계: `useQueryErrorResetBoundary().reset`을 `onReset`에, `useLocation().key`를 `resetKeys`에 둔다.

## ❌ Incorrect

```tsx
export function PostListPage() {
  return <div><PostList /></div>; // 경계 없음 — throw 시 화면 전체 백지
}
```

## ✅ Correct

```tsx
export function PostListPage() {
  return (
    <ApiErrorBoundary>
      <PostList />
    </ApiErrorBoundary>
  );
}
```

## 탐지 한계 (v1)

required-pattern 휴리스틱: page 파일이 JSX를 렌더하는데 `ErrorBoundary` 요소/`withErrorBoundary` HOC가
보이지 않으면 플래그. JSX 없는 모듈(상수/헬퍼)은 면제. 경계의 *적절한 계층 선택*은 수동 판단.

## 관련 규칙
- [[no-imperative-error-branch]] — 명령형 에러 분기 금지
- [[query-error-policy]] — react-query 에러를 경계로 던질지 정책
- [[fallback-escalation]] — 폴백의 rethrow 위임
- [[pure-view-component]] — 경계/폴백은 Domain 레이어 배치
