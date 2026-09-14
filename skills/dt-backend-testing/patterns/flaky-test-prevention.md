---
ruleId: flaky-test-prevention
summary: "고정 sleep(setTimeout) 금지, 컨테이너/앱 readiness를 await, 결정적 시드 데이터 사용"
severity: important
appliesTo: ["src/**/__tests__/**/*.ts", "test/**/*.e2e.test.ts"]
detection: []
relatedRules: [testcontainers-lifecycle, integration-no-db-mocking]
---

# Flaky 테스트 방지

## 왜 중요한가
타이밍에 의존하는 테스트는 CI에서 간헐적으로 실패해 신뢰를 무너뜨린다. 고정 `setTimeout` sleep 대신 실제 준비 상태를 await하고, 시드 데이터는 결정적으로 만든다.

| 안티패턴 | 교정 |
|---|---|
| `await new Promise(r => setTimeout(r, 500))` | 컨테이너/앱/잡 완료를 명시적으로 await |
| 랜덤/현재시각 의존 데이터 | 고정 시드 + 명시적 타임스탬프 |
| 테스트 순서 의존 | `afterEach` truncate로 상태 격리 |
| 공유 가변 전역 | 테스트별 독립 픽스처 |

## 관련 규칙
- [[testcontainers-lifecycle]]
- [[integration-no-db-mocking]]
