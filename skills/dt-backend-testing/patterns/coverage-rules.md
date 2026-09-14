---
ruleId: coverage-rules
summary: "비즈니스 코드 80%+ (DTO/entity 제외), critical 영역(service/repository) 85% 권장, 어서션 품질 우선"
severity: critical
appliesTo: ["jest.config.*", "package.json"]
detection:
  - type: ast-rule
    description: "jest coverage threshold가 비즈니스 경로(service/repository) 기준 80 미만이거나, service/repository가 collectCoverageFrom에서 빠지면 위반 (v1: 수동 검토)"
relatedRules: [integration-no-db-mocking, test-case-design-techniques]
---

# 커버리지 기준

## 왜 중요한가
커버리지는 목적이 아니라 "비즈니스 로직이 검증됐는가"의 대리 지표다. DTO/entity 같은 선언적 코드는 제외하고, 로직이 모이는 Service/Repository에 집중한다.

- 신규 비즈니스 코드: **80%+** (`.dt-backend.json`의 `coverage.newCodeThreshold`)
- Service/Repository(critical): **85% 권장**
- 제외: `*.dto.ts`, `*.entity.ts`, `*.module.ts`, `main.ts`, 마이그레이션
- **어서션 품질 우선** — 커버리지 숫자만 채우는 빈 테스트 금지

## jest 설정 예시

```js
// jest.config.js
module.exports = {
  collectCoverageFrom: ['src/**/*.{service,repository}.ts'],
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: { global: { lines: 80 } },
};
```

> diff 기반 검증은 `dt-backend-review`가 `jest --coverage`로 HEAD/BASE를 비교해 수행한다.

## 관련 규칙
- [[integration-no-db-mocking]]
- [[test-case-design-techniques]]
