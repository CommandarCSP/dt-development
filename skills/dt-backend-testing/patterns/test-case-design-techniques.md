---
ruleId: test-case-design-techniques
summary: "경계값/동등분할/결정표/상태전이로 케이스 도출 — happy/error/edge를 명시적으로 분리"
severity: minor
appliesTo: ["src/**/__tests__/**/*.ts", "test/**/*.e2e.test.ts"]
detection: []
relatedRules: [test-writing-structure, coverage-rules]
---

# 테스트 케이스 설계 기법

## 왜 중요한가
"동작한다"만 검증하면 경계·예외에서 버그가 샌다. 체계적 기법으로 의미 있는 케이스를 도출한다.

| 기법 | BE 적용 예 |
|---|---|
| 경계값 | 페이지네이션 `limit=0/1/max/max+1`, 금액 `0/음수/최대` |
| 동등분할 | 유효/무효 요청 바디, 권한 있음/없음 |
| 결정표 | (인증됨 × 소유자 × 상태) 조합별 응답 코드 |
| 상태전이 | 주문 `created→paid→shipped`, 잘못된 전이는 409 |
| 에러 경로 | 검증 실패(400), 미존재(404), 충돌(409), 권한(403) |

happy path / error path / edge case를 별도 it()으로 명시 분리한다.

## 관련 규칙
- [[test-writing-structure]]
- [[coverage-rules]]
