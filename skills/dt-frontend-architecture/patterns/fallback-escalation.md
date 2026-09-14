---
ruleId: fallback-escalation
summary: "로컬 폴백은 자기 책임 밖 에러를 rethrow해 상위 경계로 위임 — 모든 에러를 같은 자리에서 삼키지 않는다"
severity: minor
appliesTo: ["src/components/error/**/*.{ts,tsx}", "src/**/*Fallback.{tsx}"]
detection:
  - type: ast-rule
    description: "local fallback should rethrow errors outside its responsibility (manual review)"
relatedRules: [error-boundary-required, no-imperative-error-branch]
---

# 폴백은 책임 밖 에러를 위로 던진다 (escalation)

LocalErrorBoundary의 fallback은 자신이 다룰 수 있는 에러(예: 특정 도메인 API 실패)만
복구/표시하고, 그 외(치명적 런타임, 인증 만료 등)는 **rethrow**해 상위(Api→Root) 경계로 위임한다.
모든 에러를 가장 안쪽에서 삼키면 전역 처리가 무력화된다.

## ✅ Correct

```tsx
function LocalSectionFallback({ error, resetErrorBoundary }: FallbackProps) {
  if (!isDomainRecoverable(error)) throw error; // 책임 밖 → 상위 경계로
  return <RetryErrorFallback error={error} onRetry={resetErrorBoundary} />;
}
```

## 탐지 (v1)

자동검출 불가 → **수동검토(ast-rule stub)**. review 리포트에 "수동 확인" 항목으로 표기된다.
에러 분류 기준은 [에러 경계 계층](../references/error-boundary-layering.md) 참조.

## 관련 규칙
- [[error-boundary-required]] — 경계 계층
- [[no-imperative-error-branch]] — 명령형 처리 금지
