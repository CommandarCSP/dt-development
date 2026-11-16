---
name: dt-spec-generate-spec
description: Use when the user runs /dt-spec to build SDD spec documents for a page. Orchestrates Pre-flight Check (Figma MCP — Figma 소스가 있을 때만), CollectProjectContext, 소스별 어댑터 병렬 분석 (AnalyzeFigmaFrame / AnalyzeDocument), 2단계 머지, AskMissingRequirement, then converts raw data to EARS patterns (6 patterns) and writes requirements.md/design.md/tasks.md/layout-skeleton.md to docs/specs/pages/<page>/. Handles re-run scenarios with diff-then-confirm (no auto-overwrite).
---

# GeneratePageDevSpec

> 설계: `docs/specs/2026-06-01-dt-spec-multi-source-design.md` — 본문의 "dt-spec 설계 §N"은 이 문서의 절을 가리킨다.

> **FE·BE 공용 단계의 원본은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md`이다** — 실행 모드(§2)·정의서 게이트(§3)·헤더와 역참조(§4)·변경 전파(§5)·상향 정합(§6)·상태 공통 조건(§7)·저장·재실행 정책(§8)·능동 요약 알림(§9). 이 스킬은 그 문서를 먼저 읽고, 아래 FE 전용 단계를 더한다(단위=페이지, 워커=`spec-author`, `unitRef`=`dt-spec/<page>`).

dt-spec의 오케스트레이터. 전체 워크플로 [0]~[7]을 수행하고 4개 산출물을 저장한다.

## 책임 (dt-spec 설계 §3)

- Pre-flight Check (Figma MCP 연결/권한/node 조회 — Figma 소스가 있을 때만)
- 입력 수집 — 다중 소스 locator 파싱 + 소스 해석 레이어 [A]
- 4개 스킬 오케스트레이션 (소스 어댑터 병렬 분배 + 2단계 머지)
- `templates/*.tmpl` 기반 산출물 빌드
- raw → EARS 변환 (dt-spec 설계 §7-2 라벨 체계)
- 일관성 검증
- 파일 저장 (재실행 정책 적용 — dt-spec 설계 §8-4)

## 입력

- positional locators (N개): Figma URL / Figma nodeId / 파일 경로(.md/.pdf) / URL(Notion·Confluence·일반 https) — 각 locator에 `@role` 선택적 부착 (Figma만 의미)
- `--source <locator>[@role]` (옵셔널 — 명시 수단. 자동감지가 틀릴 때 `type:locator` prefix 사용)
- `--api-doc <path>` (옵셔널)
- `--design-system-node-id <id>` (옵셔널)
- `--only requirements|design|tasks|layout-skeleton` (옵셔널 — 재실행 시 부분 갱신, dt-spec 설계 §8-4)

## 출력

`docs/specs/pages/<page-kebab>/`에 4개 markdown 저장 + `docs/project-context.md` 갱신.

## askQuestion 작성 원칙

이 스킬과 하위 스킬의 모든 AskUserQuestion은 ① 왜 묻는지 배경(페이지·요소명 포함) ② 답이 어느 산출물(requirements/design/tasks)에 어떻게 반영되는지 ③ 각 옵션 `description`에 구체적 의미·결과·예시를 담는다. **짧은 질문 한 줄 + 라벨만 있는 옵션은 금지.** 전체 규칙과 예시는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`를 Read해 적용한다.

## 실행 모드

`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §2를 따른다 — 기본은 조율자가 §0 게이트만 하고 `spec-author`를 dispatch(`{ pages, sources, args, gateResult }`), 서브에이전트가 없으면 inline. **여러 페이지면 `pages` 목록을 한 spec-author에 넘겨** 크로스페이지 상호작용(네비·공유상태·**액션→리액션 정합**)을 한 시야에서 잡고 `docs/specs/interactions.md`의 FE 절을 산출한다. 워커는 아래 [1]~[7]을 페이지마다 따른다. `spec-author` 정의는 `${CLAUDE_PLUGIN_ROOT}/agents/spec-author.md`.

## 절차 (dt-spec 설계 §7-1 워크플로 [0]~[7])

### §0. 정의서 게이트 (소프트)

`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §3을 그대로 따른다(스코프 해소 → `checkDefinitionGate.mjs` → consume·none·needsNormalization·corrupt·versionTooHigh 분기 → IF 합의 상태 사용). FE에서 다른 점은 아래 하나다.
- **§0-b 소스∩어댑터 교차(G1):** 입력 소스 타입 ∩ FE 어댑터(figma/document)가 **공집합**이면(예: OpenAPI yaml만 — 드묾) 스텁이 빈 껍데기라 산출하지 않는다. 대신 AskUserQuestion(원칙 10): "`/dt-devspec`을 지금 이어서 실행 — 끝나면 이 스펙으로 돌아온다" / "화면 소스(Figma·문서)를 지금 추가" / "중단". (부분집합은 FE의 IF 출처=Figma가 읽히면 IF 손실 없음 — BE와 달리 partial 마커 불요.)

### [0] Pre-flight Check · [1] 입력 수집 + 소스 해석 · [1-재실행] 소스 복원

`${CLAUDE_PLUGIN_ROOT}/skills/dt-spec-generate-spec/references/source-intake.md`를 Read해 그대로 따른다 — Figma MCP 사전 점검(Figma 소스가 있을 때만), 소스 파싱·타입 자동감지·콘텐츠 로드(Confluence는 `docs/refs/atlassian-mcp.md`), Figma 역할(@role)·카디널리티(design·wireframe 각 1개), 부분 로드 실패, figmaFileKey, 페이지 이름, 재실행 시 헤더 sources 복원·union·union 기준 카디널리티.

### [2] 프로젝트 컨텍스트 수집/조회

`CollectProjectContext` 호출 → `projectContext` 객체 얻음. (세션 내 1회)

> 실행 모드는 `../../docs/orchestration-policy.md` 원칙 1을 따른다 — 소스 2개 이상이면 시작 시 병렬/순차를 1회 확인(기본 병렬). 순차 선택 시 어댑터를 직렬 서브에이전트로 분석.

### [3] 소스 분석 (어댑터 분배, 병렬) (dt-spec 설계 §3·§6)

union된 `ResolvedSource[]`를 각 소스의 타입/역할에 따라 어댑터로 분배한다. Task 도구로 **병렬** dispatch:

| 소스 | 어댑터 | 출력 영역 |
|---|---|---|
| `figma@design` | `AnalyzeFigmaFrame(nodeId, designSystemNodeId, projectContext)` | uiTree / components / semanticUIElements / apiCandidates / designTokens / **layoutTree** |
| `figma@wireframe` | `AnalyzeFigmaFrame(nodeId, projectContext)` | pageMeta / userStories / scenarios / businessRules / edgeCases |
| `markdown` / `pdf` / `web` | `AnalyzeDocument(resolvedSource, projectContext)` | 의도/흐름/규칙/API 후보 + 구조 추론 (`_inferred`). designTokens / layoutTree는 항상 undefined. |

각 어댑터는 부분 `ExtractionResult`를 반환한다 (동일 IR 계약; 채울 수 있는 필드만 채움).

### [3-merge] 머지 2단계 (dt-spec 설계 §5-2)

#### (a) 순수 구조 머지 — `scripts/mergeExtractionResults.mjs`

부분 ExtractionResult 배열을 순수 함수로 머지한다:

1. **정확 키 일치 → 병합**: 같은 식별자(components by name, semanticUIElements by id, apiCandidates by endpoint|featureName)면 하나로 합치고 양쪽 `_provenance` 누적.
2. **필드 단위 처리**:
   - 한쪽만 값, 다른 쪽 빈 → **채움(null 보완)**. 머지의 유일한 자동 채택.
   - 양쪽 값이 있고 다름 → `_conflicts`에 적재 (자동 선택 **금지**).
   - 양쪽 값이 같음 → 그대로.
3. **`_inferred` 소거**: 병합 항목 중 한쪽이라도 실제 소스 `_provenance`가 있으면 결과의 `_inferred` 제거 (항목 단위). `_provenance`에 inferred 출처 흔적은 남긴다. **이 소거는 (a) 정확 키 병합 시점 + [4] ask-missing의 동일요소 병합 확정 직후, 두 시점에서 적용한다** — 키가 달라 (a)에서 못 합쳐진 figma 실제항목 + 문서 inferred항목은 사용자 확정 병합 때 비로소 한 항목이 되므로, 그 순간 `_inferred`를 재소거해야 부당한 `[inferred]` 라벨·draft 트리거를 막는다 (dt-spec 설계 §5-2 (a) 3항).
4. **자유텍스트 영역** (businessRules/userStories/scenarios/edgeCases): 식별자 없으므로 무조건 union.
5. **시각 값** (designTokens / layoutTree): figma@design 어댑터만 기여 → 충돌 없음. 기존 [3.5] 토큰 merge 그대로.

#### (b) LLM 정합 패스 — (a) 직후 즉시 수행

순수 머지가 못 잡는 두 경우를 정합한다:

**① 크로스소스 동일요소 정렬** (서로 다른 소스에 id가 다른 같은 요소):
- `scripts/alignmentCandidates.mjs` 호출: role 완전 일치 + label 토큰 자카드 유사도 ≥ 0.5인 UI 항목 쌍을 후보로 생성 (결정적 사전필터).
- 나(LLM)가 후보쌍을 검토해 "같은 요소인가?" 판정 → 같음으로 판정된 쌍을 `_possibleDuplicates`에 추가. **자동 병합 안 함** — ask-missing이 사용자에게 확인.
- 크로스소스 쌍에만 적용.

**② 자유텍스트 모순/중복 탐지** (businessRules/userStories/scenarios/edgeCases):
- 한 영역에 항목 2개 이상이면 소스 무관하게 수행 (단일 문서 내부 모순도 탐지).
- 근접 중복 → `_possibleDuplicates`.
- 상호 모순 (예: "비로그인 조회 가능" vs "조회는 로그인 필수") → `_conflicts`.

결과: `_conflicts` + `_possibleDuplicates`가 채워진 머지된 `ExtractionResult` 1개.

**머지 결과 키**: `{ uiTree, components, semanticUIElements, apiCandidates, designTokens, layoutTree, pageMeta, userStories, scenarios, businessRules, edgeCases, _sources, _conflicts, _possibleDuplicates }`. `layoutTree`가 없으면(문서 전용) [7-4] 스켈레톤이 구조 스켈레톤 또는 스텁 분기로 이동한다.

### [3.5] 디자인 토큰을 project-context.md에 merge

**(이 단계는 figma@design 소스가 있을 때만 수행한다. 없으면 건너뜀.)**

`AnalyzeFigmaFrame.designTokens` (colors/typography/spacing/radius/**shadow**)를 `projectContext.designTokens` (CollectProjectContext가 반환한 메모리)와 비교해 `docs/project-context.md`의 `## 디자인 토큰` 섹션에 누적한다. **전역 토큰의 단일 저장 위치는 project-context.md**이며 페이지별 design.md엔 박지 않는다(중복 제거). 이 project-context 토큰이 이후 `materialize-tokens.mjs`로 `globals.css @theme`가 되는 테마 충실도의 출발점이다.

절차:

1. **3-way 비교**: AnalyzeFigmaFrame.designTokens(이번 페이지) ↔ projectContext.designTokens(누적).
   - **신규**: project-context에 없는 토큰 → 추가 후보.
   - **충돌**: 같은 이름인데 값이 다름 (예: `primary: #5659FF` ↔ `primary: #5C5FFF`) → 사용자 확인 후보.
   - **동일**: 무시 (변경 없음).

2. **신규 토큰 일괄 확인** (있을 때만): AskUserQuestion 으로 `multiSelect: true`. 원칙은 `dt-spec-ask-missing` "askQuestion 작성 원칙" 따른다.
   - `header`: "토큰 추가"
   - `question`: "이 페이지에서 새 디자인 토큰 N개를 발견했습니다. project-context.md `## 디자인 토큰`에 어떤 항목을 누적할까요? (선택한 항목만 추가됩니다)"
   - options: 신규 항목 각각 (예: `"primary: #5659FF"` / description `"디자인 색 토큰 — 페이지 ##:## 추출"`). 4개 초과 시 카테고리별 분할.

3. **충돌 토큰** (있을 때만): 항목별 AskUserQuestion.
   - `header`: "토큰 충돌"
   - `question`: "토큰 `primary`의 값이 project-context.md에는 `#5659FF`로, 이 페이지에는 `#5C5FFF`로 다릅니다. 어떻게 처리할까요? 선택은 `docs/project-context.md`에 반영됩니다."
   - options: label `"기존 유지"`(description `"project-context.md 값 유지, 페이지 토큰은 무시"`) / label `"Figma 값으로 갱신"`(description `"이번 페이지 값으로 덮어쓰기"`) / label `"새 이름으로 추가"`(description `"예: primary-dark 같은 별개 토큰으로 추가"`) / label `"건너뛰기"`(description `"이 충돌은 처리하지 않고 다음으로"`)

4. **자동 덮어쓰기 금지**. 사용자 확인 없이 기존 값을 바꾸지 않는다.

5. 확정된 결과로 `projectContext.designTokens`(메모리) 갱신 + `docs/project-context.md`의 `## 디자인 토큰` 섹션**만** 재직렬화해 저장(다른 절, 특히 BE 절은 글자 그대로 둔다 — 파일 전체를 다시 쓰지 않는다). 직렬화 형식은 `dt-spec-collect-project-context` SKILL.md의 "designTokens 직렬화 형식" 참조 (재실행 시 파싱과 호환).

6. **부분 갱신 모드와의 관계** (`--only requirements|design|tasks|layout-skeleton`): 디자인 토큰 merge는 요구사항 갱신과 독립이므로 어떤 `--only` 모드에서도 항상 수행한다 (작은 부가 작업).

### [3.6] 에셋 매니페스트 저장 (에셋 충실도)

**(figma@design 소스가 있을 때만.)** `AnalyzeFigmaFrame.assets[]`(Step 1 `download_assets`로 `docs/specs/assets/<page>/`에 이미 저장된 실제 파일)를 `design.md`의 `## 에셋 매니페스트` 섹션에 표로 직렬화한다:

| 컬럼 | 내용 |
|---|---|
| node id | Figma 노드 id |
| 로컬 경로 | `assets/<page>/<file>` (design.md 기준 상대경로) |
| 용도/의미 | `usage`(예: hero 이미지 / 메뉴 아이콘 / 앱 로고) |
| format | svg \| png \| jpg |

- 에셋은 **project-context가 아니라 페이지 스코프**이므로 design.md에 둔다(토큰과 반대). 공유 로고 등 전역 에셋은 `usage`에 `(전역)` 표기.
- `assets[]`가 비어있으면 섹션에 `(없음 — 이 페이지에 수거된 에셋 없음)` 표기.
- 다운로드 실패로 `incomplete` 마킹된 에셋은 표에 `(미수거 — 재실행/권한 필요)`로 남겨 침묵 누락 금지.
- 구현 단계(dt-implement)가 이 매니페스트로 실제 파일을 `src`에 배선한다.

### [4] 충돌·중복후보·API 필요 지점 식별 + AI 후보 검토

`AskMissingRequirement` 호출. 머지 결과의 `_conflicts` + `_possibleDuplicates`를 함께 전달한다.

- **`_conflicts` 해소**: 필드 충돌은 소스별 값을 제시하고 선택 확인. 자유텍스트 모순은 두 규칙을 제시하고 채택/병합/삭제 확인. 사용자가 선택한 결과는 `[user-resolved]` 라벨로 기록.
- **`_possibleDuplicates` 해소**: "이 둘이 같은 요소인가요?" → 같음(병합, `_inferred` 재소거) / 다름(둘 다 유지).
- **API 후보 검토**: design doc 6절 [4-2] (a)(b)(c) 흐름. 결과: `resolvedApiCandidates` (각 후보에 `source` 라벨).

사용자가 [4]를 중간 중단해 미해소 `_possibleDuplicates`가 남으면, draft 산출물에 중복 후보 양쪽을 모두 표기하고 각각에 `<!-- 미확정 중복후보: <상대 ref> -->` 주석을 달아 미확정 상태를 명시한다.

### [5] EARS 형식 askQuestion으로 값 채우기

`AskMissingRequirement`가 계속 진행 (design doc 6절 [5]).

### [6] 나머지 필드 보강

`AskMissingRequirement`가 계속 진행 (design doc 6절 [6]).

### [6.5] UI 구조 0개 빌드 게이트 (dt-spec 설계 §7-2 case3)

**[3-merge] 완료 후, [7] 산출물 빌드 진입 전에** 이 게이트를 실행한다.

머지 결과의 `components`와 `semanticUIElements`가 **모두 비어 있으면** (순수 API/정책 문서, UI 단서 없음), 산출물 빌드 전에 사용자에게 확인한다:

- `header`: "UI 정보 없음"
- `question`: "이 문서로는 UI 레이아웃을 잡을 수 없습니다(화면/요소 단서가 없는 API·정책 명세로 보임). API 명세만을 위한 spec(requirements 데이터 명세 + design 데이터 모델)을 뽑을까요?"
- options:
  - label `"API 명세 spec 생성"`(description `"layout-skeleton은 스텁(UI 구조 없음 안내)으로 두고, requirements·design의 API·데이터 부분만 채워 나머지 산출물은 정상 빌드"`)
  - label `"중단"`(description `"화면 설명이 포함된 문서나 Figma 노드를 추가해 다시 실행. 어떤 산출물도 생성하지 않음"`)

"중단" 선택 시 → 어떤 산출물도 생성하지 않고 종료.
"API 명세 spec 생성" 선택 시 → layout-skeleton.md를 스텁으로 빌드하고 나머지는 정상 진행 (아래 [7-4] 3-way case 3 참조).

구조가 있으면(0이 아니면) 이 게이트를 건너뛰고 [7]로 진행한다.

### [7] 산출물 빌드

#### [7-1] raw → EARS 변환

각 raw 항목을 EARS 패턴으로 분류한다. **6패턴 분류표 + "Complex 자동 결합 금지" + "FR 아님 — 별도 슬롯 배치" 규칙**은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/ears-patterns.md` §1을 Read해 적용한다(인라인 degrade 시에도 같은 문서를 읽어 동일 동작).

#### [7-2] 출처 라벨 전파

라벨 종류와 전파 규칙은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/ears-patterns.md` §2를 Read해 적용한다.

#### [7-2.5] 역참조 emit (변경 전파 입력)
`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §4 — **requirements.md의 FR 줄이 기본**이고 design.md API 표 행에도 단다. 머리 IF 리스트의 모든 IF가 적어도 한 FR에서 가리켜져야 한다.

#### [7-3] 산출물 빌드

각 파일에 대해:

1. 템플릿 로드 (`templates/requirements.md.tmpl` 등).
2. 헤더는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §4대로 `buildSpecHeader`로 만들어 헤더 블록을 통째 치환한다(`definitionVersion`은 §0이 consume일 때만, `definitionPath`·`definitionIfIds`=이 페이지가 소비한 IF).
4. 본문 placeholder 치환:
   - `{{PAGE_NAME}}` — 사용자가 정한 또는 페이지 노드명에서 추출
   - 산출물별 본문 슬롯 — 아래 [7-4]

#### [7-4] 본문 채움

`${CLAUDE_PLUGIN_ROOT}/skills/dt-spec-generate-spec/references/artifact-bodies.md`를 Read해 그대로 따른다 — requirements(라우팅·네비게이션 필수, FR 형식, 에러 상태 FR은 문구를 발명하지 않음)·design(논리 수준까지 — 물리 배치는 scaffold 소관)·tasks(관찰 가능한 완료 기준만)·layout-skeleton(정밀·구조·스텁 3-way, 스텁/구조 → 정밀 전환 규칙).

#### [7-5] EARS 변환 검증

- [ ] 모든 FR이 6가지 패턴 중 하나로 분류되었는가
- [ ] EARS 키워드(WHEN/WHILE/WHERE/IF/THEN/THE SYSTEM SHALL) 사용이 패턴 정의와 일치하는가
- [ ] Complex 항목이 자동 결합되지 않았는가 (사용자 명시 source 확인)
- [ ] tasks.md의 각 Task가 requirements.md의 FR과 1:N 매핑되는가 (FR ID 참조 무결성)

위반 → 사용자 보고 + 수정 옵션. 위반 항목은 주제별로 묶어(한 번에 최대 4개 — 원칙 6) 묻되 **어떤 검증이 왜 실패했는지 + fix/skip의 결과**를 명시한다. 예 — `header` "검증 위반 2/3", `question` "FR-7이 EARS 6패턴 중 어디에도 매핑되지 않았습니다 (WHEN/WHILE/IF 등 키워드 없음). 지금 고칠까요? skip하면 이 문서는 `status: draft`로 저장되어 다른 도구가 경고합니다." / options: label `"수정 (fix)"`(description `"[7-4]로 돌아가 FR-7의 EARS 패턴을 보정"`) / label `"건너뛰기 (skip)"`(description `"draft 상태로 남김 — 추후 보강"`). 모든 위반이 fix 완료 시 [7-6]로. 하나라도 skip 시 [7-6]에서 `status: draft`로 기록.

#### [7-5.5] 완성도 스윕 (구멍 방지 — fe-spec-checklist)

산출물을 다 지은 뒤, `${CLAUDE_PLUGIN_ROOT}/docs/refs/fe-spec-checklist.md`의 각 항목(C1~)을 스펙과 대조한다. **해당사항이 있는데 빠졌거나 확정 불가**면 조용히 넘기거나 지어내지 말고 **AskUserQuestion**(inline) / **needsDecision**(dispatched=spec-author)으로 처리 방향을 묻는다(질문 품질은 `askquestion-principle.md`). 명백히 해당 없으면 스킵(과질문 금지). 이 체크리스트는 **성장형**이라 실행 시점의 최신 항목을 따른다 — 항목이 늘수록 스펙이 더 검증된 형태로 완성된다. 미해소 항목이 남으면 [7-6]에서 `status: draft`.

#### [7-6] 상태 결정

`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §7의 공통 조건을 먼저 본다 — `node "${CLAUDE_PLUGIN_ROOT}/scripts/validateSpec.mjs" docs/specs/pages/<page>/*.md`에 오류가 있으면 finalized가 될 수 없다.

- 모두 통과 → `status: finalized`
- `status: draft` 트리거 (다음 중 하나):
  - **[7-5.5] 완성도 스윕에서 미해소로 남은 체크리스트 항목 존재**
  - 사용자가 [5] 또는 [6] askQuestion 중간 중단
  - AskMissingRequirement 출력의 `status === 'draft'` (필수 필드 미충족 후보 존재)
  - [7-5] 검증 위반 중 사용자가 fix를 거부한 항목 존재
  - 머지 결과에 **`_inferred` 항목이 산출물에 포함됨** (AI 추론 골격)
  - **일부 소스 로드 실패** 후 사용자가 "나머지 소스로 계속" 선택
  - [4]를 중간 중단해 **미해소 `_possibleDuplicates`가 남음** ([4]에서 양쪽 후보에 `<!-- 미확정 중복후보 -->` 주석 부착)

#### [7-7] 파일 저장 — 재실행 정책

`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §8을 따른다(자동 덮어쓰기 금지, `--only`면 그 파일만). FE 예외: 스텁·구조 스켈레톤은 layoutTree를 확보하면 diff-then-confirm 예외로 통째 교체할 수 있다 — `${CLAUDE_PLUGIN_ROOT}/skills/dt-spec-generate-spec/references/artifact-bodies.md` 「스텁/구조 → 정밀 전환 규칙」.

## 상향 정합 (deep-read ↔ 정의서 IF diff) — 게이트 + 쓰기 (T2~T8)

`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §6 — **이 스킬은 FE이므로 `deepRead`=Figma deep-read, `unitRef`=`dt-spec/<page>`**. §0이 `consume`(generated)일 때만 적용.

## 완료 후

최종 답변에는 **항상** 다음 세 가지를 포함한다 (생략 금지):

### (1) 산출물 위치 안내
```
docs/specs/pages/<page-kebab>/
  ├── requirements.md     (status: <finalized|draft>)
  ├── design.md           (status: <finalized|draft>)
  ├── tasks.md            (status: <finalized|draft>)
  └── layout-skeleton.md  (status: <finalized|draft>)
```
(status는 [7-6]에서 결정된 실제 값을 표기. draft면 그 이유를 1줄로 덧붙인다.)

### (2) 각 산출물이 무엇인지 설명 — **매 실행마다 항상 반환**

생성된 4개 문서가 각각 "무엇에 대한 내용인지"를 사용자가 바로 이해하도록 아래 형식으로 항상 설명한다. `--only`로 일부만 갱신했더라도 4개 문서의 역할 설명은 모두 포함한다 (사용자가 전체 체계를 파악하도록).

- **requirements.md** — "무엇을(WHAT)". 사용자 스토리 + EARS 패턴 기능 요구사항(FR) + 비기능 요구 + 접근 권한 + UI 요소 + 데이터 명세. 각 FR에 출처 라벨(`ai-confirmed`/`user-added` 등)과 EARS 패턴 라벨(`Event-driven` 등)이 붙는다.
- **design.md** — "어떻게(HOW, 논리 수준만)". 아키텍처(기술 스택 적용) + 데이터 모델/API 계약 + 컴포넌트 **책임** 구조 + 시퀀스(성공/실패 분기) + FR↔책임 매핑. 물리적 폴더/파일/5-layer 배치는 적지 않음(후속 scaffold 소관).
- **tasks.md** — "무엇이 되면 끝(검증 가능한 완료 기준)". 각 FR을 충족하는 Task와 acceptance criteria. 구체 구현/테스트 절차는 적지 않음.
- **layout-skeleton.md** — "어떻게 그릴지(시각 구조)". Figma 프레임을 inline style + placeholder 주석으로 충실 재현한 tsx 스켈레톤. 코딩 에이전트가 프로젝트 컨벤션으로 변환.

이때 **이번 페이지에서 실제로 담긴 핵심 내용**(예: FR 개수, 주요 API, 결정/주의 사항)을 함께 1~2줄로 요약해 추상 설명에 그치지 않게 한다.

### (3) 다음 단계 안내
```
이제 본인이 선택한 AI 도구(Claude Code, Cursor, 미래의 dt-scaffold 등)로
이 산출물을 전달해 코드 생성을 진행하실 수 있습니다.
```

### (4) 능동 요약 알림 — 매 산출/standalone 종료 시
`${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md` §9의 형식으로 한 줄 덧붙인다.

## 단일 출처 참조

- **체크리스트 단일 출처**: dt-spec 설계 §7-1 [4-2] (c) — `AskMissingRequirement`가 처리
- **라벨 정의 단일 출처**: `${CLAUDE_PLUGIN_ROOT}/docs/refs/ears-patterns.md` — 출처 라벨(`ai-confirmed`/`ai-edited`/`user-added`/`[inferred]`/`[user-resolved]`) + 패턴 라벨(`Event-driven` 등) + EARS 6패턴 분류표
- **소스 해석 단일 출처**: `scripts/parseSources.mjs` — 타입 자동감지 우선순위 + 카디널리티 검증
- **머지 (a) 단일 출처**: `scripts/mergeExtractionResults.mjs` — 정확 키 union + `_conflicts` + `_inferred` 소거
- **정합 사전필터 단일 출처**: `scripts/alignmentCandidates.mjs` — role 일치 + label 자카드 유사도 후보 생성
- **FE·BE 공용 단계 단일 출처**: `${CLAUDE_PLUGIN_ROOT}/docs/refs/spec-pipeline.md`
