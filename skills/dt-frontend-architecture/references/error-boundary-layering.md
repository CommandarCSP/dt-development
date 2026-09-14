# 에러 경계 계층 (Error Boundary Layering)

dt-frontend 5-layer에 "에러 경계" 책임을 더한 SSOT. 에러는 **던지고**, 경계가 **선언적으로** 잡는다.
관련 룰: [[error-boundary-required]] · [[no-imperative-error-branch]] · [[query-error-policy]] · [[fallback-escalation]].

> 표준 라이브러리는 `react-error-boundary`(Sentry 비의존). 관측 도구(Sentry) 연동은 경계의 `onError` 단일 진입점에 hook한다.

## 1. 에러 분류

처리 방법을 정하려면 먼저 에러를 분류한다. 분류 함수 참조 구현: [`examples/error/classifyError.ts`](../examples/error/classifyError.ts).

| 종류 | 출처 | 복구 | 처리 경계 |
|---|---|---|---|
| `network` | 네트워크 단절/타임아웃 (axios `!error.response`) | 재시도 가능 | Api/Local — 재시도 버튼 |
| `notFound` | HTTP 404 | 해당 없음(장애 아닌 없음) | 페이지 — 없음 UI(경계 제외, 문구는 페이지 소유) |
| `api` | 서버 4xx/5xx 응답(404 제외) | 일부 가능 | Api(Domain) — 도메인 폴백 |
| `auth` | 401/403 | 재로그인 필요 | Root — 로그인 유도/리다이렉트 위임 |
| `runtime` | 렌더/로직 예외(비-axios) | 불가 | Root — 전역 에러 페이지 |

원칙: **자기 책임 밖 에러는 rethrow**해 상위로 위임한다([[fallback-escalation]]). 모든 에러를 가장 안쪽에서 삼키지 않는다.

## 2. 3계층 경계 매핑 (5-layer 위에)

```
RootErrorBoundary (App 최상단)
 └ ApiErrorBoundary (Domain Component 묶음)
    └ LocalErrorBoundary (페이지 블록)
       └ children
```

| 경계 | 위치 | 책임 | 폴백 |
|---|---|---|---|
| RootErrorBoundary | `App.tsx` 최상단 (Router 감싸기) | 런타임/예상외/auth 등 최종 캐치 | RootErrorPage(전역) |
| ApiErrorBoundary | Page가 Domain Component 묶음을 감쌈 | API/도메인 에러 폴백 + 재시도 | RetryErrorFallback |
| LocalErrorBoundary | 페이지 일부 블록 | 일부만 폴백(헤더/푸터 정상 유지) | LocalErrorSection |

Page는 자식을 최소 1개 경계로 감싼다([[error-boundary-required]]) — 보통 ApiErrorBoundary.

## 3. react-error-boundary + react-query 연계

`react-error-boundary`의 `ErrorBoundary`에 react-query 리셋을 연결해 "재시도"가 쿼리를 다시 굽도록 한다.

```tsx
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

export function ApiErrorBoundary({ children }: { children: React.ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={ApiFallback}
      onReset={reset}              // 재시도 시 react-query 에러 상태 리셋
      resetKeys={[location.key]}   // 라우트 변경 시 자동 리셋
      onError={reportError}        // 관측 훅 포인트
    >
      {children}
    </ErrorBoundary>
  );
}
```

쿼리 측은 [[query-error-policy]]에 따라 `throwOnError`로 경계에 던질지(핵심 데이터) 로컬 처리할지(보조 데이터) 명시한다.

## 4. onError 훅 포인트

모든 경계는 `onError={reportError}`로 단일 진입점을 호출한다. `reportError`([`examples/error/classifyError.ts`](../examples/error/classifyError.ts))는
기본은 콘솔 로깅이며, Sentry 연동 시 이 한 곳에 `Sentry.captureException(error, { contexts, tags, fingerprint })`를
연결하면 관측·책임소재 자동화가 배선된다. 컴포넌트마다 capture를 흩뿌리지 않는다.

## 5. 폴백 키트 (참조 구현)

참조 구현은 [`examples/error/`](../examples/error/) — 프로젝트에선 `src/components/error/`에 두고 재사용한다(ad-hoc 폴백 금지):

| 컴포넌트 | props | 용도 |
|---|---|---|
| `RetryErrorFallback` | `{ error, onRetry }` | Api 경계 기본 폴백(재시도 버튼=shadcn Button) |
| `LocalErrorSection` | `{ height?, onRetry }` | 블록 단위 인라인 폴백 |
| `RootErrorPage` | `{ onReset }` | 전역 에러 페이지 |
| `RootErrorBoundary` / `ApiErrorBoundary` / `LocalErrorBoundary` | `{ children }` | 경계 래퍼(Local은 `{ children, height? }`, 책임 밖 에러 rethrow) |

색·간격은 토큰(`bg-muted`/`text-muted-foreground`/`border-border` 등) 사용 — raw hex 금지([[no-hardcoded-design-values]]).
