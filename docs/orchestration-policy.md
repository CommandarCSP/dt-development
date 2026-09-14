# 오케스트레이션 서브에이전트 정책 (SSOT)

dt-development 오케스트레이터 스킬(여러 작업을 분배·조율하는 스킬)이 공통으로 따르는 실행 정책.

## 원칙 1 — 병렬 기본 + 자동 추천 + 시작 시 1회 확인
작업 단위 의존성을 분석해 모드를 추천하고, 시작 시 1회 확인한다(기본 병렬).
- 독립(서로 다른 파일/경로만 수정, 공유 상태 없음) → **병렬 추천**
- 강결합(한 단위가 다른 단위 산출물을 입력으로 필요/공유 의존) → **순차 추천**

AskUserQuestion 템플릿:
- header: "실행 방식"
- question: "이 작업은 N개 단위로 나뉩니다(추천: <병렬|순차> — <근거>). 어떻게 실행할까요?"
- options: `병렬 (추천)` / `순차` / `자동(추천대로)`

답이 없거나 자동이면 추천 모드. 기본값은 병렬.

## 원칙 2 — 순차 = 직렬 서브에이전트
순차를 선택해도 각 단위를 서브에이전트로 격리해 **한 번에 하나씩** dispatch한다(병렬성만 끔).
사소한 단일 편집을 제외하고 비격리 메인 인라인 처리 금지. (참고: superpowers subagent-driven-development)

## 원칙 3 — 리뷰는 항상 격리 (불변, 선택 무관)
모든 리뷰 작업을 **전용 review 서브에이전트**에서 수행한다 — `review.mjs` 실행 + diff 읽기 + 위반 해석 + repair 필요 판단.
- 메인(오케스트레이터)은 **verdict만** 반환받는다: `{ critical: N, violations: [file:rule...], repairTargets: [...], coverage, verdict: PASS|NEEDS_REPAIR }`.
- repair는 **담당 코드 서브에이전트 재dispatch**로 수행한다. 메인이 직접 코드를 수정하지 않는다.
- 병렬/순차 사용자 선택과 **무관하게 항상** 적용(사용자가 끌 수 없음).
- `/dt-review`·`/dt-be-review` 단독 실행 시에도, 오케스트레이션 내부 호출 시에도 동일.

## 원칙 4 — 에이전트 미지원 시 폴백
런타임이 서브에이전트(Task/Agent)를 제공하지 않으면 인라인 실행으로 degrade하고, 그 사실을 사용자에게 1줄로 고지한다.

## 적용 스킬
dt-frontend-scaffold / dt-backend-scaffold / dt-spec-generate-spec / dt-bespec-generate-spec /
dt-implement / dt-be-implement / dt-audit (오케스트레이터) · dt-frontend-review / dt-backend-review (항상 격리).
