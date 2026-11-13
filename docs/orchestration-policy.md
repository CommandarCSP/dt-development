# 오케스트레이션 서브에이전트 정책 (SSOT)

dt-development 오케스트레이터 스킬(여러 작업을 분배·조율하는 스킬)이 공통으로 따르는 실행 정책.
근거: `docs/specs/2026-06-11-orchestration-subagent-policy-design.md`.

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
- **리뷰어 dispatch와 수리 루프는 조율자(메인 세션)만 한다.** 서브에이전트는 다른 서브에이전트를 부를 수 없다. 작업형 에이전트 안에서는 스크립트 게이트(`gate.mjs` — tsc·테스트·규칙 검사)만 돌고, 걸린 것은 스스로 고친다. 해석이 필요한 판정(화면·리소스 간 정합, 디자인 충실도, 커버리지, 수리 필요 여부)은 빌더가 반환한 뒤 조율자가 부른 reviewer가 한다.
- 순서: 빌더 dispatch → 봉투(`gateResult`·`baseRef`) 수신 → reviewer(`mode:full`) dispatch → `NEEDS_REPAIR`면 `source: code` 항목만 `repairTargets`로 같은 빌더 재dispatch(**최대 1회**) → reviewer 재판정 → 그래도 실패면 사용자 보고·중단. `source: spec | plan` 항목은 빌더로 못 고치니 사용자에게 보고하고 앞 단계로 되돌릴지 묻는다.
- 수리 1회는 원칙 6의 질문 왕복 상한(2회)과 따로 센다.
- 병렬/순차 사용자 선택과 **무관하게 항상** 적용(사용자가 끌 수 없음).
- `/dt-review`·`/dt-be-review` 단독 실행 시에도, 오케스트레이션 내부 호출 시에도 동일.

## 원칙 4 — 에이전트 미지원 시 폴백
런타임이 서브에이전트(Task/Agent)를 제공하지 않으면 인라인 실행으로 degrade하고, 그 사실을 사용자에게 1줄로 고지한다.
인라인으로 돌 때도 **원칙 5의 반환 형식을 그대로** 만든 뒤 다음 단계로 넘긴다 — 실행 방식이 달라도 주고받는 모양은 같아야 한다.

## 원칙 5 — 반환 봉투 (에이전트 → 조율자)
에이전트는 산출물을 **파일로 쓰고**, 조율자에게는 아래 봉투만 돌려준다. 에이전트는 두 종류다.

**작업형** — 스펙·계획·구현·분석·집필·추적 에이전트
(definition-author · spec-author · bespec-author · plan-author · fe-builder · be-builder · guide-analyst · guide-author · handbook-analyst · handbook-tracer · handbook-author)
```
{ status: done | draft | blocked,          // done=완결 · draft=미해소 남음(needsDecision 또는 TODO) · blocked=진행 불가(이유는 summary)
  artifacts: [<쓴 파일 경로>],
  needsDecision: [<원칙 6 항목>],            // 없으면 []
  summary: "<한 줄>",
  ...역할별 필드 }                           // units · writingLint · coverage · gate · layersDone · surface 등 — 각 에이전트 파일에 정의
```

**판정형** — 코드·글·구현을 판정만 하고 고치지 않는 에이전트
(reviewer · ko-writing-reviewer · auditor)
```
{ verdict: <에이전트별 값>,                  // reviewer·ko-writing-reviewer: PASS | NEEDS_REPAIR · auditor: findings 유무
  findings: [<에이전트별 항목>],             // reviewer 는 repairTargets 를 findings 로도 읽는다
  summary: "<한 줄>",
  ...판정별 고유 필드 }                       // critical · coverage · changeRatio 등
```
판정형은 사람 결정을 묻지 않는다. 판정이 애매하면 해당 항목에 `needsHuman: true`(또는 신뢰도 표시)를 달고, 사람 확인은 조율자가 한다.

## 원칙 6 — 사람 결정 요청(needsDecision)과 답
에이전트는 **사용자에게 직접 묻지 않는다.** 사람이 정해야 할 것은 needsDecision 항목으로 올린다.
```
{ id: "<단위>-<짧은 키>",                    // 예: "login-auth-flow" — 답을 돌려줄 때 짝을 맞추는 열쇠
  topic: "<무엇에 대한 결정인가 — 한 줄>",
  question: "<사용자에게 보일 질문 문장>",
  options: [{ label, description }],         // 2~4개. label 은 짧게, description 은 고르면 무엇이 달라지는지
  recommended: "<options 중 하나의 label>" | null,
  evidence: "<왜 이 질문이 생겼나 — 파일:줄·원문 인용>",
  reflectsTo: "<답이 반영될 산출물·절>" }
```
- 질문을 잘 쓰는 법(선택지 구성·근거 제시)은 `docs/refs/askquestion-principle.md` 를 따른다.
- **조율자**가 한 라운드의 needsDecision을 모아 묻는다.
  - 같은 `topic`은 하나로 합친다.
  - AskUserQuestion 한 번에 최대 4개씩 묶는다.
  - `recommended` 선택지는 맨 앞에 두고 label 끝에 "(권장)"을 붙인다.
- 답은 같은 에이전트를 **재dispatch**하며 넘긴다:
  ```
  answers: [{ id, choice: "<고른 label>" | "other", note?: "<자유 입력·보충>" }]
  ```
  에이전트는 `answers`에 있는 `id`를 다시 묻지 않는다.
- **왕복 상한 2회.** 같은 단위에서 needsDecision → 답 → 재dispatch를 두 번 해도 남은 항목이 있으면, 에이전트는 `status: draft`로 마감한다. 조율자는 남은 항목을 사용자에게 목록으로 보고하고 다음 단계로 넘길지 묻는다.
- 결정을 어디에 오래 남기는가(재실행 때 다시 묻지 않게)는 결정 기록 체계(로드맵 GEN-21·GEN-30)가 정한다. 그 전까지는 각 산출물의 해당 절에 반영된 것이 기록이다.

## 원칙 7 — 조율자의 책임
- dispatch → 봉투 수신 → needsDecision 처리(원칙 6) → 필요하면 재dispatch → 다음 단계. 이 순서를 지킨다.
- 사용자에게 묻는 것은 조율자(메인 세션)만 한다. 에이전트 쪽 문서에 "사용자에게 묻는다"가 있으면 needsDecision으로 바꿔 읽는다.
- 봉투의 `summary`와 역할별 필드(`writingLint` 등)를 사용자 보고에 한 줄씩 옮긴다.
- `status: blocked`면 다음 단계로 넘기지 않고 이유와 선택지를 사용자에게 보인다.

## 적용 스킬
- **오케스트레이터(원칙 1~7):** dt-devspec / dt-spec-generate-spec / dt-bespec-generate-spec / dt-implement / dt-be-implement / dt-frontend-scaffold / dt-backend-scaffold / dt-fullstack / dt-audit / dt-guide / dt-handbook
- **판정형 에이전트를 부르는 스킬(원칙 3·5·7):** dt-frontend-review / dt-backend-review(reviewer) · dt-ko / dt-explain / dt-worklog-sync / dt-confluence-doc / dt-guide / dt-handbook(ko-writing-reviewer)
