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

**팀 설정이 있으면 묻지 않는다.** `.dt.json`의 `team.execution`이 `parallel`이나 `sequential`이면 위 질문을 건너뛰고 그 방식으로 실행한다. 사용자에게는 "팀 설정(team.execution)에 따라 <병렬|순차>로 실행합니다" 한 줄로 알린다. `ask`(기본값)면 위대로 묻는다. 단 `parallel`이어도 강결합 단위는 순차로 돌리고 그 이유를 알린다(정확성이 설정보다 앞선다).

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
- 오케스트레이션 안에서는 언제나 격리한다. **예외: 사용자가 `/dt-review`·`/dt-be-review`를 직접 부른 단독 실행**은 보고서 전문을 보려는 것이라, 메인에서 스크립트를 돌려 출력을 그대로 보이고 해석·수리 판단은 하지 않는다(절차: 각 리뷰 스킬 "단독 실행 절차").

## 원칙 4 — 에이전트 미지원 시 폴백
런타임이 서브에이전트(Task/Agent)를 제공하지 않으면 인라인 실행으로 degrade하고, 그 사실을 사용자에게 1줄로 고지한다.
인라인으로 돌 때도 **원칙 5의 반환 형식을 그대로** 만든 뒤 다음 단계로 넘긴다 — 실행 방식이 달라도 주고받는 모양은 같아야 한다.

## 원칙 5 — 반환 봉투 (에이전트 → 조율자)
에이전트는 산출물을 **파일로 쓰고**, 조율자에게는 아래 봉투만 돌려준다. 에이전트는 두 종류다.

**작업형** — 스펙·계획·구현·분석·집필·추적 에이전트
(definition-author · spec-author · bespec-author · plan-author · fe-builder · be-builder · e2e-author · guide-analyst · guide-author · handbook-analyst · handbook-tracer · handbook-author)
```
{ status: done | draft | blocked,          // done=완결 · draft=미해소 남음(needsDecision 또는 TODO) · blocked=진행 불가(이유는 summary)
  artifacts: [<쓴 파일 경로>],
  needsDecision: [<원칙 6 항목>],            // 없으면 []
  summary: "<한 줄>",
  ...역할별 필드 }                           // units · writingLint · coverage · gate · layersDone · surface 등 — 각 에이전트 파일에 정의
```
스펙·정의서·플랜 작성 에이전트(definition-author · spec-author · bespec-author · plan-author)는 역할별 필드로 `assumptions: [{ id, what, why, reflectsTo }]`도 돌려준다 — 묻지 않고 가정하고 진행한 자리다. 무엇을 묻고 무엇을 가정하는지는 `docs/refs/askquestion-principle.md` "빈틈 찾기와 묻기 기준"이 정한다. 조율자는 완료 보고에 가정 목록을 보인다(원칙 7).

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
- 결정을 어디에 오래 남기는가(재실행 때 다시 묻지 않게)는 원칙 9가 정한다.

## 원칙 7 — 조율자의 책임
- dispatch → 봉투 수신 → needsDecision 처리(원칙 6) → 필요하면 재dispatch → 다음 단계. 이 순서를 지킨다.
- 사용자에게 묻는 것은 조율자(메인 세션)만 한다. 에이전트 쪽 문서에 "사용자에게 묻는다"가 있으면 needsDecision으로 바꿔 읽는다.
- 봉투의 `summary`와 역할별 필드(`writingLint` 등)를 사용자 보고에 한 줄씩 옮긴다.
- `assumptions`가 있으면 "가정 N건"과 목록을 보이고, 사용자가 바꾸는 항목은 `answers`로 받아 같은 에이전트를 재dispatch한다. 가정을 숨기지 않는다.
- `status: blocked`면 다음 단계로 넘기지 않고 이유와 선택지를 사용자에게 보인다.

## 원칙 8 — 팀 설정 읽기 (`.dt.json`)
조율자는 시작할 때 공통 설정을 한 번 읽는다: `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" <projectRoot>`. 키의 뜻·기본값은 `docs/refs/config-schema.md`가 정한다. 설정 파일이 없으면 모두 기본값이고 지금 동작과 같다.
- `warnings`가 있으면 사용자에게 한 줄씩 보이고, 기본값으로 계속한다.
- **`team.execution`** — 원칙 1의 실행 방식 질문을 대신한다.
- **`team.models`** — 에이전트를 dispatch할 때, 그 에이전트 티어(`planner`·`builder`·`reviewer` — `scripts/lib/config.mjs`의 `AGENT_TIERS`)의 값이 있으면 Agent 도구의 `model`로 넘긴다. `null`이면 넘기지 않아 에이전트 파일의 `model`을 쓴다. 인라인 degrade(원칙 4)에서는 적용하지 않는다.
- **`team.locale`** — 산출물 언어. 지금은 `ko`만 지원한다. 로더가 다른 값을 경고하고 `ko`로 바꿔 주므로, 조율자는 그 경고를 보이고 한국어로 진행한다.
- **`team.requiredMcp`** — 이 스킬이 쓰는 MCP가 목록에 있으면, 실제 작업 전에 그 MCP 도구가 연결돼 있는지 확인한다. 없으면 그만두지 않고 묻는다: "연결하고 다시 시도 / 이 소스 없이 진행 / 중단". 목록에 없는 MCP는 지금처럼 각 스킬의 사전 점검을 따른다.

## 원칙 9 — 결정 기록 (TP · PD)
사람 결정은 걸리는 범위에 따라 남는 곳이 다르다(`docs/policies/TP-001-decision-records.md`).

| 범위 | 남는 곳 | 예 |
|---|---|---|
| 한 화면·한 리소스 | 그 산출물의 절(`reflectsTo`) | "이 목록은 최신순" |
| 프로젝트 전체·다음 실행에도 | **프로젝트 결정 PD** `docs/decisions/PD-NNN-*.md` | "삭제는 전부 휴지통 방식", "스타일은 SCSS 모듈", 규칙 끄기의 근거 |
| 팀의 모든 프로젝트 | **팀 정책 TP** 플러그인 `docs/policies/TP-NNN-*.md` | "Jira 서브태스크 이름 규칙" |

- **읽기 — 시작할 때.** 스펙·정의서·플랜·구현 조율자는 `node "${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs" list <projectRoot> --json`으로 채택된 PD·TP를 읽어, 작성 에이전트에 `decisions`(id·제목·범위·파일 경로)로 넘긴다. 에이전트는 이것을 **고정 입력**으로 쓴다 — PD가 정한 것은 묻지 않고, 근거에 `PD-NNN`을 적는다. 새 소스가 PD와 어긋나면 조용히 덮지 않고 needsDecision으로 "PD를 바꿀지" 올린다. 만료된 결정(`expired: true`)은 그대로 따르되 사용자에게 다시 검토할지 한 줄로 묻는다.
- **쓰기 — 답을 받은 뒤.** 조율자는 needsDecision 답 가운데 **여러 단위나 다음 실행에도 걸리는 것**을 골라 PD 초안을 제안한다("이 답을 프로젝트 결정으로 남길까요?"). 승인하면 `dt-decision` 스킬 new 절차로 쓴다. 한 단위에만 걸리는 답은 제안하지 않는다. 판단이 애매하면 묻지 않고 산출물에만 남긴다.
- **규칙 끄기.** 스택 설정(`.dt-frontend.json`·`.dt-backend.json`)의 `overrides.<키>`는 `{ "value": …, "decisionRef": "PD-NNN" }`(또는 `"PD-NNN"`)으로 근거를 가리킨다. 풀 리뷰는 근거가 없거나 유효하지 않은 override를 Critical(`override-decision-ref`)로, 만료된 근거를 Important로 낸다. 빌더의 Phase 게이트(partial)는 이것으로 막지 않는다 — 사람 결정은 빌더가 만들 수 없다.
- 인라인 degrade(원칙 4)에서도 같다.

## 원칙 10 — 막혔을 때는 그만두지 않고 선택지를 낸다
입력이 없거나, 도구가 연결 안 됐거나, 앞 단계 산출물이 없으면 **안내문 한 줄로 끝내지 않는다.** 맞는 선택지를 골라 AskUserQuestion으로 묻는다(서브에이전트 안이면 `status: blocked` + needsDecision).
- **복구** — 고치고 다시 시도(연결·권한·경로 다시 입력). 자유 값은 Other로 받는다.
- **우회** — 빠진 채로 진행하고 결과를 `status: draft`로 표시한다(무엇이 빠졌는지 산출물에 적는다).
- **앞 단계 스킬을 이어서 실행** — 같은 세션에서 그 스킬을 돌리고, 끝나면 원래 스킬의 같은 자리로 돌아온다(P3 한 흐름). 돌아올 때 사용자 입력을 다시 받지 않는다.
- **중단** — 이유와 다음에 할 일을 함께 보인다.

정말 멈춰야 하는 곳(진행하면 데이터가 망가지거나 잘못된 산출물이 생기는 곳, 할 일이 없는 곳)은 문서의 그 줄에 `<!-- hard-stop: 사유 -->`를 단다. 그래도 이유와 다음 할 일은 보인다. 구조 테스트가 사유 없는 멈춤을 잡는다.

## 적용 스킬
- **오케스트레이터(원칙 1~10):** dt-devspec / dt-spec-generate-spec / dt-bespec-generate-spec / dt-implement / dt-be-implement / dt-frontend-scaffold / dt-backend-scaffold / dt-fullstack / dt-audit / dt-guide / dt-handbook
- **판정형 에이전트를 부르는 스킬(원칙 3·5·7):** dt-frontend-review / dt-backend-review(reviewer) · dt-ko / dt-explain / dt-worklog-sync / dt-confluence-doc / dt-guide / dt-handbook(ko-writing-reviewer)
