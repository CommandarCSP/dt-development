---
ruleId: sentry-single-capture
summary: "Sentry 캡처는 단일 진입점(reportError)에서만 — 컴포넌트/서비스에서 captureException·captureMessage 직접 호출 금지"
severity: important
appliesTo: ["src/**/*.{ts,tsx}"]
excludePathPatterns: ["src/components/error/**"]
detection:
  - type: forbidden-pattern
    pattern: "Sentry\.capture(Exception|Message)\s*\("
    rationale: "캡처를 reportError 한 곳으로 모아 중복·누락과 컨텍스트 누락을 막는다. 경계/캐시 onError만 reportError를 호출한다."
relatedRules: [error-boundary-required, query-error-policy, no-imperative-error-branch]
---

# Sentry 캡처는 단일 진입점에서만

에러 보고는 `src/components/error/`의 `reportError` 한 곳에서만 Sentry로 캡처한다.
컴포넌트·훅·서비스가 `Sentry.captureException`/`captureMessage`를 직접 부르면
컨텍스트·태그·fingerprint 규약이 흩어지고 같은 에러가 중복 보고된다.

## ✅ Correct

```ts
// 경계/캐시 onError → reportError (단일 진입점)
new QueryCache({ onError: (error) => reportError(error) });
```

## ❌ Incorrect

```ts
// 컴포넌트에서 직접 캡처 — 금지
Sentry.captureException(error);
```

경계·폴백 키트 자체(`src/components/error/**`)는 제외된다(여기가 단일 진입점).
관련 설계: [Sentry 관측 계층](../references/sentry-observability.md).
