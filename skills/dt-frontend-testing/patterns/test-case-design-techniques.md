---
ruleId: test-case-design-techniques
summary: "동등분할/경계값/결정테이블/상태전이/페어와이즈로 케이스 도출, 직관 의존 X"
severity: minor
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}", "e2e/**/*.spec.ts"]
detection: []
relatedRules: [unit-business-hook, unit-store-query, coverage-rules]
---

# 테스트 케이스 도출 기법

테스트는 "잘 짠 코드 한 줄"이 아니라 "어떤 입력을 어떤 결과로 검증할지" 선정이 핵심. 직관에 의존하지 말고 아래 5 기법 중 하나(또는 조합)를 골라 케이스를 도출한다.

## 1. 동등 분할 (Equivalence Partitioning)

입력 공간을 같은 결과를 내는 그룹으로 나누고 각 그룹에서 대표값 하나씩 골라 검증.

- **언제**: Business Hook의 변환 함수, 필터/정렬 같은 분기 적은 순수 함수
- **dt-frontend 예시 — `toFeedPost(dto)`**:
  - 유효 그룹: `imageUrl`이 있는 표준 DTO → 정상 매핑 검증
  - 무효 그룹은? — 우리는 DTO 스키마가 신뢰 가능 (서버 보장)이라 무효 그룹은 거의 없음. **DTO를 서버에서 받지 않은 경우** (예: localStorage 복원)가 있으면 무효 그룹 케이스 필요

## 2. 경계값 분석 (Boundary Value)

각 분할 그룹의 **경계**(min-1, min, max, max+1)를 별도 케이스로.

- **언제**: 분기 조건(`id > 0`, `limit <= 0`, 배열 빈/한 개/다수)
- **dt-frontend 예시 — `useUserDetailQuery(id)`**:
  - `id = 0` → enabled false (경계)
  - `id = -1` → enabled false (경계 밖)
  - `id = 1` → 정상 fetch
  - `id = 99999` (db에 없음) → 404 처리 검증

## 3. 결정 테이블 (Decision Table)

조건이 2개 이상 조합되는 경우 (NxM 매트릭스).

- **언제**: optimistic mutation, 여러 쿼리 상태 조합
- **dt-frontend 예시 — `useFollowToggleMutation`**:

  | follow | 서버 응답 | 기대 결과 |
  |---|---|---|
  | true | 204 | 캐시 추가, invalidate, 최종 cache 포함 |
  | true | 500 | 롤백, 원래 cache 유지 |
  | false | 204 | 캐시 제거, invalidate |
  | false | 500 | 롤백 |

  4 케이스 모두 테스트로 작성 (우리 현 테스트는 3 케이스 — 추가 1건 여유).

## 4. 상태 전이 (State Transition)

상태 머신처럼 동작하는 hook의 모든 전이 경로 검증.

- **언제**: useQuery 라이프사이클, multi-step form
- **dt-frontend 예시 — `useFeedQuery`**:

  ```
  idle → loading → success
                ↘ error
  success → (invalidate) → loading → success
                                  ↘ error
  ```

  최소 케이스:
  - 초기 fetch 성공
  - 초기 fetch 실패 (MSW 500)
  - invalidate 후 재성공
  - invalidate 후 실패

## 5. 페어와이즈 (Pairwise)

3+ 파라미터 조합이 폭발할 때 모든 "쌍"이 한 번씩 나타나도록 축소 (Combinatorial reduction).

- **언제**: View 컴포넌트의 props 매트릭스(예: `isFollowing × isPending × hasError`)
- **dt-frontend 예시 — `UserCard`**:
  - 전수 8조합 대신 페어와이즈로 4~6조합으로 줄여도 모든 쌍 커버
  - 단, 8조합이 그리 많지 않으면 전수 권장. 페어와이즈는 props 5+에서 의미

## 케이스 도출 워크플로우

1. **공개 인터페이스 파악**: 함수 시그니처 / hook 반환 타입 / props
2. **분할**: 입력 공간을 유효/무효 + 분기별 그룹
3. **경계 추출**: 각 그룹의 min/max
4. **조합 매트릭스**: 2+ 파라미터면 결정 테이블, 3+면 페어와이즈 고려
5. **상태 흐름**: 비동기/멀티 단계면 전이 그래프
6. **케이스 ID 부여**: TC-001, TC-002 ... → 테스트 이름으로 매핑

## 안티패턴

- "랜덤하게 5개 케이스 작성" — 커버리지는 차도 결정적이지 않음
- "happy path만 검증" — 경계와 에러 누락
- "한 테스트에 모든 케이스 합침" — 한 테스트 = 한 동작 원칙 위반 ([[test-anti-patterns]] 참조)

## 관련 규칙
- [[unit-business-hook]]
- [[unit-store-query]]
- [[coverage-rules]]
- [[test-anti-patterns]]
