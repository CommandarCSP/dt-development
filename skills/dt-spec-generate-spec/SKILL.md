---
name: dt-spec-generate-spec
description: Use when the user runs /dt-spec to build SDD spec documents for a page. Orchestrates Pre-flight Check (Figma MCP — Figma 소스가 있을 때만), CollectProjectContext, 소스별 어댑터 병렬 분석 (AnalyzeFigmaFrame / AnalyzeDocument), 2단계 머지, AskMissingRequirement, then converts raw data to EARS patterns (6 patterns) and writes requirements.md/design.md/tasks.md/layout-skeleton.md to docs/specs/pages/<page>/. Handles re-run scenarios with diff-then-confirm (no auto-overwrite).
---

# GeneratePageDevSpec

dt-spec의 오케스트레이터. 전체 워크플로 [0]~[7]을 수행하고 4개 산출물을 저장한다.

## 책임 (design doc(2026-06-01) §3)

- Pre-flight Check (Figma MCP 연결/권한/node 조회 — Figma 소스가 있을 때만)
- 입력 수집 — 다중 소스 locator 파싱 + 소스 해석 레이어 [A]
- 4개 스킬 오케스트레이션 (소스 어댑터 병렬 분배 + 2단계 머지)
- `templates/*.tmpl` 기반 산출물 빌드
- raw → EARS 변환 (design doc(2026-06-01) §7-2 라벨 체계)
- 일관성 검증
- 파일 저장 (재실행 정책 적용 — design doc(2026-06-01) §8-4)

## 입력

- positional locators (N개): Figma URL / Figma nodeId / 파일 경로(.md/.pdf) / URL(Notion·Confluence·일반 https) — 각 locator에 `@role` 선택적 부착 (Figma만 의미)
- `--source <locator>[@role]` (옵셔널 — 명시 수단. 자동감지가 틀릴 때 `type:locator` prefix 사용)
- `--api-doc <path>` (옵셔널)
- `--design-system-node-id <id>` (옵셔널)
- `--only requirements|design|tasks|layout-skeleton` (옵셔널 — 재실행 시 부분 갱신, design doc(2026-06-01) §8-4)

## 출력

`docs/specs/pages/<page-kebab>/`에 4개 markdown 저장 + `docs/project-context.md` 갱신.

## askQuestion 작성 원칙

이 스킬과 하위 스킬의 모든 AskUserQuestion은 ① 왜 묻는지 배경(페이지·요소명 포함) ② 답이 어느 산출물(requirements/design/tasks)에 어떻게 반영되는지 ③ 각 옵션 `description`에 구체적 의미·결과·예시를 담는다. **짧은 질문 한 줄 + 라벨만 있는 옵션은 금지.** 전체 규칙과 예시는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`를 Read해 적용한다.

## 실행 모드 (컨텍스트 경제 — 격리 워커 + needsDecision HITL)

이 스킬은 **얇은 조율자**다. 무거운 작업(소스 분석·머지·빌드)은 일회성 워커 `spec-author`(agents/)가 **자기 컨텍스트에서** 끝내고 포인터+요약만 돌려주게 하여, 조율자(메인 세션) 컨텍스트가 페이지마다 부풀지 않게 한다. 모드는 `../../docs/orchestration-policy.md` 원칙 1·4를 따른다.

- **dispatched (기본 — 서브에이전트 가용 시):**
  1. 조율자가 **§0 정의서 게이트만** 직접 수행한다(스코프 해소·consume/standalone·최소 정의서 생성 여부 등 *시작 전 사용자 결정*은 메인에만 있는 사용자 채널로 묻는다).
  2. `Task`로 `spec-author`를 dispatch — `{ pages, sources, args(--only/--api-doc/--scope), gateResult }` 전달. **여러 페이지면 페이지별로 병렬 dispatch하지 말고 `pages` 목록을 한 spec-author에 넘겨 홀리스틱하게** 짓게 한다 — 그래야 크로스페이지 상호작용(네비·공유상태·**액션→리액션 정합**)을 한 시야에서 잡고 `docs/specs/interactions.md`를 산출한다(페이지별 격리가 놓치던 부분). spec-author는 아래 [1]~[7] 절차를 페이지마다 따르되 사람 결정은 `needsDecision`으로 모아 반환하고 중간물을 `.dt-spec/<page>/`에 영속화한다.
  3. 조율자는 워커의 반환 `{ units[], interactions, needsDecision[], writingLint, summary }`만 받는다(무거운 원자료는 워커 컨텍스트에 격리). `needsDecision`이 비어있지 않으면 **조율자가 AskUserQuestion**(askquestion-principle.md)으로 묻고 → 답과 함께 spec-author를 **재dispatch**(워커는 `.dt-spec/<page>/progress.md`에서 이어서 재개). 비면 완료 보고. 완료 보고의 summary 끝에 `한글 lint: 고침 N·유지 M`(writingLint)을 한 줄로 보인다.
- **inline degrade (원칙 4 — 서브에이전트 미지원 시):** 조율자가 아래 [0]~[7]을 **직접** 수행(현행 동작). AskUserQuestion도 직접. 워커를 안 거칠 뿐 **같은 절차·같은 산출**.

> 두 모드는 **아래 [1]~[7] 동일 절차**를 따른다(분기 없음). 차이는 "누가 실행하고 어디서 묻느냐"(격리 여부)뿐 — 정확성 문제가 아니라 컨텍스트 경제 문제. `spec-author` 정의는 `${CLAUDE_PLUGIN_ROOT}/agents/spec-author.md`.

## 절차 (design doc(2026-06-01) §7-1 워크플로 [0]~[7])

### §0. 정의서 게이트 (소프트)

**먼저 스코프를 해소**(아래 "§0-스코프 해소")한 뒤 `checkDefinitionGate.mjs`를 `{ projectRoot, scope }`로 호출해 판정(`kind`)을 받고 분기한다(scope 미해소면 `scope` 생략 = bare `definition.md`). **게이트는 판정만, 수락/거절 결정은 여기서 사용자에게 묻는다.** 자동으로 다른 스킬을 호출하지 않는다 — 사용자가 다음 스킬을 직접 실행한다.

**§0-스코프 해소 (다중 스코프 — 어느 정의서를 소비?):** `parseDefinitionSources.discoverDefinitions({ projectRoot })`로 `definition*.md`를 발견한 뒤 다음 **우선순위**로 해소(위에서부터 — 먼저 맞으면 종료):
1. **명시 인자 `--scope <slug>` (최우선)** — 헤더 기록과 **달라도 `--scope`가 이긴다**(잘못 바인딩 교정 통로). 적용 후 leaf 헤더 `scope`를 그 값으로 갱신.
2. **헤더 scope** — `--scope` 없고 leaf 헤더에 `<!-- scope: <slug> -->`가 있으면 → 그 스코프 정의서.
3. **레거시 면제** — scope 헤더·`--scope` 둘 다 없는데 `<!-- basedOnDefinition: N -->`이 있으면 → bare `definition.md`(기존 leaf; basedOnDefinition이 bare 기준으로 찍힘). **질문 안 함.** 잘못 바인딩 시 탈출구 = 1번 `--scope`로 교정.
4. **단일** — `definition*.md`가 정확히 1개면 그걸 사용(스코프 유무 무관).
5. **다중·미지정** — `AskUserQuestion`으로 "이 페이지는 어느 스코프?"를 **1회 질문**(자동 추정 금지). 답을 `buildSpecHeader`의 `scope` 필드로 leaf 헤더에 기록(재실행 시 2번에서 회피).

- **`consume`**: 정의서 소비. `authorKind:'generated'`면 IF 3분기(`확정`=lock / `미해소`=스펙화 스킵 / 그 외=보강); `authorKind:'hand-authored'`면 값 전부 잠정(§3 재확인 시드로만). `migrate:'in-memory'`면 읽기 전용 흡수(정의서 직접 수정 금지). `status:'draft'`면 "미해소 N건, 계속?" 확인 + **미해소 IF 스펙화 스킵 + 참조 SP/기능 자리에 `<!-- skipped: IF-n (미해소) -->` 마커 emit**. consume일 때 `definitionVersion`+`definitionPath`(leaf→정의서 상대경로)+`definitionIfIds`(이 페이지가 소비한 IF)를 [7-3] `buildSpecHeader`로 넘겨 **신규격** `<!-- basedOnDefinition: <상대경로>@v<N> | IF-a,IF-b -->` emit(dt-devspec 「마커 규격」 절 참조) — **이 줄이 Task 6 쓰기측 규약이자 Task 4 `extractBasedOnDefinition`(변경 전파)의 입력**이다(손 주석 주입 금지). FE 페이지 spec은 본문 `from:` 마커가 없으므로 이 IF 리스트가 `computeImpacted` 전파의 유일한 결속이다 — **IF 리스트 누락 금지**.
- **§0-b 소스∩어댑터 교차(G1):** 입력 소스 타입 ∩ FE 어댑터(figma/document)가 **공집합**이면(예: OpenAPI yaml만 — 드묾) 스텁이 빈 껍데기 → 스텁 생략·미산출 종료 + `/dt-devspec` 라우팅. (부분집합은 FE의 IF 출처=Figma가 읽히면 IF 손실 없음 — BE와 달리 partial 마커 불요.)
- **`none`**(정의서 없음): "최소 정의서 만들까요?" **수락**이면 **헤더 없는(hand-authored) 골격 스텁**(추론 IF/SP 전부 `협의중`) 작성 + `/dt-devspec` 안내 — *`Generated by dt-devspec` 마커를 leaf가 달지 않는다*(마커 사칭 금지; 다음 실행에서 hand-authored로 재진입). **거절**이면 standalone(`buildSpecHeader`에 `definitionSOT:'none'`).
- **`needsNormalization`**(대충 손작성): "`/dt-devspec`으로 정규화할까요?" **수락**=산출물 없이 종료(사용자가 `/dt-devspec` 후 재실행). **거절**=standalone(`definitionSOT:'unstructured'`) **+ 대충 정의서 상단에 `<!-- NOT-SOT: unstructured, used as hint by dt-spec/<page> -->` 비파괴 주석을 diff-then-confirm으로 1줄 추가**(idempotent — 이미 있으면 skip; 나중 `/dt-devspec` D12 정규화 복구의 단서이자 거절 재감지 신호 — 헤더 `definitionSOT`와 더불어 재안내 트리거).
- **`corrupt`**: "정의서 깨짐 — `/dt-devspec` 재생성" 안내 후 미산출 종료(standalone 강등 금지).
- **`versionTooHigh`**: "플러그인 업그레이드 필요" 안내 후 미산출 종료.
- 데이터 명세를 *추론*하지 말고 정의서의 **IF-n을 합의 상태에 따라** 사용한다:
  - **확정(agreed) IF** → lock. 그대로 인용한다. 재추론·임의 변경 금지.
  - **협의중(tentative) IF** → 잠정 계약이므로 leaf가 deep-read로 **보강·구체화 가능**. 보강 결과는 아래 "## 상향 정합"으로 정의서에 환류한다.
- 자기 담당(FE/공통) SP/IF만 스펙화하고 BE 전용 항목은 스킵한다.
- > 산출 직전 상향 정합·최종 정합 시 diff의 대조 차원은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/upward-alignment.md` §대조 차원을 따른다(응답 shape 필드·정렬 규약 누락까지 — IF 행 존재만 보지 말 것).

### [0] Pre-flight Check — CONDITIONAL (Figma 소스가 있을 때만)

**Figma 소스가 1개도 없으면 이 단계를 완전히 건너뛴다.** 문서 전용 실행(markdown/pdf/web만 입력)에서는 Figma MCP 체크가 필요 없다.

Figma 소스가 1개 이상이면 순서대로 확인:

1. Figma MCP 서버 연결 확인
   - 시도: `mcp__plugin_figma_figma__get_metadata("1:1")` (임시 호출)
   - 실패 → "Figma MCP가 연결되지 않았습니다. `/mcp`로 연결 상태를 확인해주세요." + 중단.
2. Figma 액세스 토큰 확인 (MCP 서버가 인증 에러 반환 시) → 안내 + 중단.
3. 파일 접근 권한 확인 (위 호출이 401/403 반환 시) → "Figma 파일 공유 권한을 확인해주세요" + 중단.
4. 각 figma@design 소스의 nodeId 조회 가능:
   - `mcp__plugin_figma_figma__get_metadata(nodeId)` → 실패 시 "node id를 확인해주세요" + 중단.
5. 각 figma@wireframe 소스의 nodeId 조회 가능 → 동일 검사.
6. `designSystemNodeId` (있다면) 조회 가능 → 실패 시 경고만 + 계속 (사용자 confirm).

### [1] 입력 수집 + 소스 해석 (design doc(2026-06-01) §4)

#### 소스 파싱 + 타입 자동감지

`scripts/parseSources.mjs`를 호출해 positional 인자와 `--source` 플래그를 `ResolvedSource[]`로 변환한다.

타입 자동감지 우선순위 (위에서 아래, 첫 매칭):

| 순위 | 패턴 | 타입 |
|---|---|---|
| 1 | `--source type:...` 또는 locator prefix 명시 | (명시값) |
| 2 | `figma.com/...` URL | `figma` |
| 3 | 확장자 `.md` `.markdown` `.txt` | `markdown` |
| 4 | 확장자 `.pdf` | `pdf` |
| 5 | `notion.so/...` `*.atlassian.net/...` | `web` |
| 6 | 기타 `http(s)://...` | `web` |
| 7 | `^\d+:\d+$` (순수 노드 id) | `figma` |

자동감지 실패 → "소스 타입을 알 수 없습니다: `<locator>`. figma 노드, .md/.pdf 경로, 또는 URL을 넣어주세요" + 중단.
소스 0개 (positional·--source 모두 없음) → 사용법 안내 + 중단.

#### 소스별 콘텐츠 로드

각 타입에 맞게 콘텐츠를 로드한다:

- **markdown**: `Read` 도구로 파일 읽기.
- **pdf**: `Read` 도구로 읽기 (`pages` 파라미터로 멀티페이지 추출).
- **web (Notion)**: `notion-fetch` MCP 도구 사용.
- **web (Atlassian/Confluence)**: `mcp__claude_ai_Atlassian__fetch` 또는 `mcp__claude_ai_Atlassian__getConfluencePage` 사용.
- **web (일반 URL)**: `WebFetch` 도구 사용.
- **figma**: 노드 참조만 보관 (실제 로드는 AnalyzeFigmaFrame 어댑터가 MCP로 수행).

#### Figma 역할(@role) 처리

| 입력 | 처리 |
|---|---|
| Figma 노드, `@role` 명시 (`235:1412@design`) | 명시값 사용, 질문 안 함 |
| Figma 노드, 역할 미지정 | **항상 AskUserQuestion으로 확인** (design doc(2026-06-01) §2 결정 9) |
| 문서 소스 (md/pdf/web) | 역할 불필요 — 질문 안 함 |

역할 미지정 Figma 노드가 있을 때 AskUserQuestion 예:
- `header`: "Figma 노드 역할 지정"
- `question`: "다음 Figma 노드들의 역할을 지정해주세요. 역할에 따라 어떤 어댑터로 분석할지 결정됩니다 — design은 화면 레이아웃·컴포넌트·디자인 토큰 추출, wireframe은 흐름·시나리오·비즈니스 규칙 추출에 쓰입니다. 잘못 지정하면 해당 산출물(requirements.md/design.md/layout-skeleton.md)에 빠진 정보가 생깁니다. 노드 목록: [nodeId-1], [nodeId-2]. 추천: 첫 번째=design, 두 번째=wireframe."
- options: label `"첫 번째=design, 두 번째=wireframe (추천)"`(description `"[nodeId-1]을 UI 시각 추출(design)로, [nodeId-2]를 흐름·규칙 추출(wireframe)로 사용"`) / label `"반대로 지정"`(description `"[nodeId-1]=wireframe, [nodeId-2]=design"`) / label `"직접 지정"`(description `"각 노드의 역할을 직접 입력"`)

#### 카디널리티 검증

design 최대 1개, wireframe 최대 1개. 위반 시 에러:
- design 2개 → "Figma 디자인 노드는 1개만 지원합니다. 한 화면이 여러 프레임으로 나뉘어 있으면 **그 프레임들을 감싸는 상위 프레임 노드 id**를 주세요(상위 노드로 우회)." + 중단.

#### 부분 로드 실패 처리 (design doc(2026-06-01) §4-5)

단일 소스 로드 실패(파일 없음 / fetch 401 / MCP 미연결):
- 해당 소스 보고 + AskUserQuestion: `header` "소스 로드 실패", `question` "[소스 locator] 로드에 실패했습니다(이유: <에러>). 나머지 소스로만 계속 진행할까요? 계속 선택 시 이 소스가 빠진 상태로 스펙이 생성되며 `status: draft`로 저장됩니다. 빠진 소스가 design 노드라면 layout-skeleton.md가 구조 스켈레톤 또는 스텁이 됩니다.", options: label `"나머지 소스로 계속"`(description `"실패 소스를 제외하고 진행. 산출물 헤더에 (load-failed) 노트로 표시, status: draft 강제"`) / label `"중단"`(description `"소스를 수정한 후 다시 실행")`.
- **계속 선택 시**: `status: draft` 강제 + 해당 소스에 `loadFailed: true` 마킹 (헤더 sources에 `(load-failed)` 노트로 기록).
- **전체 소스 로드 실패** (유효 소스 0개) → "모든 소스 로드에 실패했습니다" + 중단.

#### figmaFileKey 파생

Figma URL(`figma.com/design/:fileKey/...`)이 있으면 fileKey를 파싱한다. fileKey는 `AnalyzeFigmaFrame` 호출 인자로 전파하고, **산출물 헤더 `sources` 줄에 `figmaFileKey`와 design nodeId를 함께 기록한다** — 구현/충실도 검증 단계가 에셋을 재조회(asset URL 만료 시)하고 디자인과 대조할 수 있도록. (이전엔 미기록이었으나, 에셋·테마 충실도를 위해 fileKey를 durable하게 남긴다.)

예 (page 이름 확정):
- `header`: "페이지 이름"
- `question`: "산출물이 저장될 디렉토리명을 정합니다. Figma 페이지 노드명에서 'SCR_FLE_01'을 추출했는데, `docs/specs/pages/<이름>/`의 <이름>으로 쓸까요? (kebab-case로 변환: scr-fle-01)"
- options: label `"scr-fle-01 사용"`(description `"추출된 이름 그대로 디렉토리 생성"`) / label `"직접 입력"`(description `"다른 이름을 지정"`)

### [1-재실행] 재실행 시 소스 복원 (design doc(2026-06-01) §7-1-재실행)

대상 페이지 디렉토리(`docs/specs/pages/<page-kebab>/`)가 이미 존재하면 재실행으로 판단하고 아래를 수행한다.

#### 기존 헤더 sources 복원

기존 산출물 헤더를 `parseSpecHeader`로 파싱해 sources를 복원한다.

**specVersion 1.0 자동 마이그레이션**: 옛 `figmaPageNodeId=<id>` → `figma:<id>@design`, `figmaUxWireframeNodeId=<id>` → `figma:<id>@wireframe`으로 무손실 매핑한다. **복원된 Figma 소스는 "이미 역할이 결정된 것"으로 간주 — 역할 재질문 안 함** (결정 9 예외).

#### 소스 union

복원 sources와 이번 명령의 새 sources를 union한다:
- 같은 locator → 새 입력이 갱신 (업데이트).
- 다른 locator → 추가.

#### union 기준 카디널리티 검증 (Critical)

카디널리티는 **union 결과** 기준으로 검증한다. 복원 figma design + 새 figma design = 2개 → 에러:
"이미 design 노드가 있습니다(헤더 복원). 교체하려면 기존을 제거하거나 `--only`로 부분 갱신하세요" + 중단.

신규 소스가 기존 소스를 조용히 교체하지 않는다.

`--only <artifact>` 부분 갱신 시에도 동일하게 복원하고 union하되, 산출물 빌드는 지정 artifact만 수행한다.

### [2] 프로젝트 컨텍스트 수집/조회

`CollectProjectContext` 호출 → `projectContext` 객체 얻음. (세션 내 1회)

> 실행 모드는 `../../docs/orchestration-policy.md` 원칙 1을 따른다 — 소스 2개 이상이면 시작 시 병렬/순차를 1회 확인(기본 병렬). 순차 선택 시 어댑터를 직렬 서브에이전트로 분석.

### [3] 소스 분석 (어댑터 분배, 병렬) (design doc(2026-06-01) §3·§6)

union된 `ResolvedSource[]`를 각 소스의 타입/역할에 따라 어댑터로 분배한다. Task 도구로 **병렬** dispatch:

| 소스 | 어댑터 | 출력 영역 |
|---|---|---|
| `figma@design` | `AnalyzeFigmaFrame(nodeId, designSystemNodeId, projectContext)` | uiTree / components / semanticUIElements / apiCandidates / designTokens / **layoutTree** |
| `figma@wireframe` | `AnalyzeFigmaFrame(nodeId, projectContext)` | pageMeta / userStories / scenarios / businessRules / edgeCases |
| `markdown` / `pdf` / `web` | `AnalyzeDocument(resolvedSource, projectContext)` | 의도/흐름/규칙/API 후보 + 구조 추론 (`_inferred`). designTokens / layoutTree는 항상 undefined. |

각 어댑터는 부분 `ExtractionResult`를 반환한다 (동일 IR 계약; 채울 수 있는 필드만 채움).

### [3-merge] 머지 2단계 (design doc(2026-06-01) §5-2)

#### (a) 순수 구조 머지 — `scripts/mergeExtractionResults.mjs`

부분 ExtractionResult 배열을 순수 함수로 머지한다:

1. **정확 키 일치 → 병합**: 같은 식별자(components by name, semanticUIElements by id, apiCandidates by endpoint|featureName)면 하나로 합치고 양쪽 `_provenance` 누적.
2. **필드 단위 처리**:
   - 한쪽만 값, 다른 쪽 빈 → **채움(null 보완)**. 머지의 유일한 자동 채택.
   - 양쪽 값이 있고 다름 → `_conflicts`에 적재 (자동 선택 **금지**).
   - 양쪽 값이 같음 → 그대로.
3. **`_inferred` 소거**: 병합 항목 중 한쪽이라도 실제 소스 `_provenance`가 있으면 결과의 `_inferred` 제거 (항목 단위). `_provenance`에 inferred 출처 흔적은 남긴다. **이 소거는 (a) 정확 키 병합 시점 + [4] ask-missing의 동일요소 병합 확정 직후, 두 시점에서 적용한다** — 키가 달라 (a)에서 못 합쳐진 figma 실제항목 + 문서 inferred항목은 사용자 확정 병합 때 비로소 한 항목이 되므로, 그 순간 `_inferred`를 재소거해야 부당한 `[inferred]` 라벨·draft 트리거를 막는다 (design doc(2026-06-01) §5-2 (a) 3항).
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

5. 확정된 결과로 `projectContext.designTokens`(메모리) 갱신 + `docs/project-context.md`의 `## 디자인 토큰` 섹션을 재직렬화해 저장. 직렬화 형식은 `dt-spec-collect-project-context` SKILL.md의 "designTokens 직렬화 형식" 참조 (재실행 시 파싱과 호환).

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

### [6.5] UI 구조 0개 빌드 게이트 (design doc(2026-06-01) §7-2 case3)

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
정의서 항목을 스펙화할 때, 해당 FR/IF 옆에 출처 역참조를 써넣는다:
- 예) `### FR-2: 파일 검색 ... <!-- from: SP-1 -->`
- API 표 행 끝에 `<!-- from: IF-1 -->`
이 역참조가 `definitionPropagation.computeImpacted`의 입력이 되어, 정의서 변경 시 영향받는 FR/IF를 정밀 산출한다. emit하지 않으면 변경 전파가 작동하지 않는다.

#### [7-3] 산출물 빌드

각 파일에 대해:

1. 템플릿 로드 (`templates/requirements.md.tmpl` 등).
2. `scripts/buildSpecHeader.mjs#buildSpecHeader({ generatedAt, status, sources, definitionVersion, definitionPath, definitionIfIds })`로 헤더 블록 생성. `sources`는 `ResolvedSource[]` — `[{type, locator, role?, loadFailed?}]` 배열. `definitionVersion`은 **§0 게이트가 반환한 값을 그대로 넘긴다**(§0이 `consume`일 때만 definitionVersion 전달; standalone이면 definitionSOT — §0 규칙). `definitionPath`=leaf→정의서 상대경로, `definitionIfIds`=이 페이지가 소비한 IF id 배열. **이 함수가 PLUGIN_VERSION과 specVersion='1.1'을 직접 주입**한다. loadFailed가 true인 소스는 헤더에 `(load-failed)` 노트로 표시된다. `definitionVersion`+`definitionPath` 전달 시 마지막 줄에 신규격 `<!-- basedOnDefinition: <상대경로>@v<N> | IF 리스트 -->`가 자동 추가된다(`definitionPath` 없이 `definitionVersion`만 주면 구 정수형 — 하위호환).
3. 템플릿의 헤더 영역(`<!-- Generated by ... -->`부터 **첫 빈 줄 직전까지 연속된 `<!-- ... -->` 주석 줄 전체** = 헤더 블록의 종료 경계)을 buildSpecHeader 출력 문자열로 **헤더 블록 통째 치환**(고정 줄 수에 의존하지 않는다 — [7-3] Step 2와 동일). 헤더 내부 개별 placeholder 치환은 **사용하지 않는다** (이중 치환 방지).
4. 본문 placeholder 치환:
   - `{{PAGE_NAME}}` — 사용자가 정한 또는 페이지 노드명에서 추출
   - 산출물별 본문 슬롯 — 아래 [7-4]

#### [7-4] 본문 채움

**requirements.md 슬롯 매핑**:
- `{{USER_STORIES}}` ← userStories (bullet 리스트로 나열; 소스 무관, 머지 결과 사용)
- `{{NON_FUNCTIONAL_REQUIREMENTS}}` ← 성능/접근성/i18n/반응형 정책을 AskUserQuestion으로 수집 (Ubiquitous EARS 또는 bullet). 질문 예 — `header` "비기능 요구", `question` "이 페이지의 성능·접근성·다국어·반응형 정책이 있나요? requirements.md 비기능 요구사항 절에 기록됩니다 (없으면 선택 안 함)", `multiSelect: true`, options: label `"성능 목표"`(description `"예: 목록 1초 내 렌더, 이미지 lazy-load"`) / label `"접근성 기준"`(description `"예: WCAG AA, 키보드 내비게이션"`) / label `"다국어(i18n)"`(description `"예: 한/영 지원, 날짜 로케일"`) / label `"반응형"`(description `"예: 모바일 우선, 360~1920px"`)
- `{{ACCESS_CONTROL}}` ← pageMeta.accessControl 그대로 (예: `guest_only`)
- `{{UI_ELEMENTS}}` ← semanticUIElements를 `- <id> (<role>)` 형식 bullet으로
- `{{DATA_SPECIFICATIONS}}` ← resolvedDataSchema의 endpoint별 request/response 표기
- `{{ROUTING_NAVIGATION}}` ← **필수 — 라우팅/네비게이션은 모든 페이지 스펙의 1급 요소**(정의서·외부 문서 동봉 여부와 무관하게 dt-spec이 단독으로 항상 산출). 채우는 내용:
  - **라우트**: 이 페이지의 경로 + params. 홈/진입점 성격이면 `/`(index). 소스에 경로 표기가 없으면 ask-missing 네비게이션 점검(Step 3.5)에서 사용자에게 확인.
  - **진입점**: 이 페이지로 들어오는 경로. 다른 페이지가 아직 스펙화 안 됐으면 `TODO: 진입점 미정`으로 명시(침묵 금지).
  - **나가는 네비게이션**: 이 페이지 요소 클릭 → 어느 라우트로. 각 항목은 위 [7-1] 표의 "네비게이션 트리거" = Event-driven이므로 `{{FUNCTIONAL_REQUIREMENTS}}`에 FR로도 emit하고, 여기엔 `요소 → 경로` 요약을 모아 적는다(FR과 라우팅 섹션 양쪽 표기).
  - **게이트**: Figma/AI는 레이아웃만 추출하고 클릭→이동은 못 잡으므로, 소스에서 네비게이션을 하나도 못 건졌으면 **반드시 ask-missing Step 3.5로 1회 질문**한다. 그래도 비면 `{{ROUTING_NAVIGATION}}`에 `TODO: 네비게이션 미정`을 남기고 `status: draft`로 저장(조용한 누락 금지).
- `{{FUNCTIONAL_REQUIREMENTS}}`:

각 FR을 다음 형식으로 작성:
```markdown
### FR-N: <요약>  `[<source-label>] [<pattern-label>]`
<EARS 키워드> ...
```

예 (Event-driven):
```markdown
### FR-2: 로그인 제출  `[ai-confirmed] [Event-driven]`
**WHEN** 사용자가 유효한 인증 정보로 로그인 버튼을 클릭하면
**THE SYSTEM SHALL** POST /api/auth/login으로 인증하고
**AND** 성공 시 /dashboard로 리다이렉트한다
```

예 (추론):
```markdown
### FR-3: 로그인 폼 구조  `[inferred] [Ubiquitous]`
**THE SYSTEM SHALL** 이메일·비밀번호 입력 필드와 로그인 버튼을 표시한다
```

**에러 상태 FR 작성 규칙**: 에러 경계(공용 에러 키트 폴백)가 렌더하는 상태는 구체 문구를 발명하지 않는다. 동작+접근성 시맨틱(예: `role="alert"`)으로 기술하고 문구는 에러 키트 캐논(`dt-frontend-architecture` `examples/error`의 `RetryErrorFallback` 등)을 참조로 위임한다. 소스(기획서·Figma 주석)에 실제 문구가 있을 때만 `[전용 문구]` 표시와 함께 기재(이 경우 전용 폴백 구현 대상). 적용 범위는 **에러 상태만** — 빈 상태 문구는 페이지 소유라 스펙 정의 허용, 로딩은 동작만.

```markdown
# ❌ 문구 발명
### FR-9: 목록 로드 실패  `[inferred] [Unwanted]`
**IF** 목록 조회가 실패하면 **THE SYSTEM SHALL** "오류가 발생했습니다."를 표시한다

# ✅ 시맨틱 + 캐논 위임
### FR-9: 목록 로드 실패  `[inferred] [Unwanted]`
**IF** 목록 조회가 실패하면 **THE SYSTEM SHALL** 에러 경계로 던져 재시도 가능한 폴백(`role="alert"` + 재시도)을 표시한다 — 문구는 에러 키트 캐논(RetryErrorFallback) 위임
```

**design.md** 본문:
- `{{ARCHITECTURE}}` — `projectContext.techStack` 참조 (Framework, 서버 상태 등 명시)
  > projectContext.projectLibraries(전역 세트 외 채택 lib)가 있으면 아키텍처 절에 명시해 후속 scaffold/implement가 그 lib를 쓰도록 한다.
- `{{DATA_MODELS}}` — `resolvedDataSchema`의 request/response 타입 + API 계약(endpoint/method). scaffold Phase 1 `contract.ts`로 넘어가는 정당한 입력.
- `{{COMPONENT_STRUCTURE}}` — 머지된 components 트리 (소스에 따라 실제/추론; 추론분은 `[inferred]` 표기). **컴포넌트의 책임(역할) 수준**으로 기술 — 구체 파일 경로·레이어 배치는 적지 않는다. 상세 레이아웃·스타일은 layout-skeleton.md로 이전.
- `{{ASSET_MANIFEST}}` — [3.6]의 에셋 매니페스트 표(node id | 로컬 경로 | 용도/의미 | format). figma@design 소스가 없거나 수거 에셋이 없으면 `(없음)`. document-only 실행은 이 섹션을 채우지 않는다.
- `{{SEQUENCES}}` — `resolvedRequirements`의 시퀀스 (성공/실패/잠금 분기)
- `{{REQUIREMENT_MAPPING}}` — `FR-N → 담당 책임`(어떤 컴포넌트 책임/데이터 작업이 그 FR을 충족하는지). **구체 파일·훅 이름은 적지 않는다** — 물리 구조는 dt-scaffold 소관.

> **경계 원칙:** design.md는 **무엇을 + 논리적 어떻게**(데이터·API 계약·시퀀스·컴포넌트 책임)까지만 담는다. 물리적 폴더/파일/5-layer 배치는 dt-spec이 정하지 않으며, 후속 scaffold(`/dt-scaffold`)가 `dt-frontend-architecture` 룰로 유일하게 결정한다. (이전엔 `{{FILE_STRUCTURE_PROPOSAL}}`로 미리 제안했으나 scaffold가 소비하지 않아 drift만 유발 → 제거.)

**tasks.md `{{TASKS}}`**:

각 FR마다 **검증 가능한 완료 기준(acceptance criteria)** Task를 생성한다. Task는 "무엇이 되면 끝인지"를 **관찰 가능한 행위/결과**로만 적는다. **어떤 파일/레이어/훅으로 구현할지(물리 구조)와 테스트 작성·실행 절차(테스트 작성→실패→통과→커밋)는 적지 않는다** — 그건 후속 scaffold(`/dt-scaffold`) 또는 코딩 에이전트 소관(위 design.md와 동일한 경계 원칙).

```markdown
## Task N: <요약> (FR-N 충족)
- [ ] <검증 가능한 완료 기준 1 — 관찰 가능한 행위/결과>
- [ ] <검증 가능한 완료 기준 2>
- [ ] ...
```

작성 규칙:
- 완료 기준은 **행위/결과**로 적는다. 예: `본문 길이 100 초과 시 업로드 차단 + 오류 표시`, `삭제 성공 시 목록에서 해당 항목 제거`, `선택 0건이면 '선택 삭제' 버튼 비활성 + 강제 시도 시 "선택한 파일이 없습니다." 토스트·미수행`.
- API 동작은 **계약 수준**으로만. 예: `POST /api/files multipart로 제출`. endpoint/method/스키마 상세는 design.md `## 데이터 모델 / API 계약` 참조.
- **금지**: 구체 파일 경로(`src/...`), 레이어/훅 이름(`useXxxQuery`/`useXxxUiStore`/`XxxView` 등), `단위 테스트 작성`·`테스트 실패 확인`·`구현`·`테스트 통과 확인`·`커밋` 같은 TDD 실행 절차 줄, 테스트 프레임워크 언급(Vitest/RTL/MSW).
- 마지막에 **전체 플로우 완료 기준** Task 1개 추가 — 개별 FR 횡단(명시 표기). 예: `목록 로딩 → 검색/정렬 → 업로드 → 삭제 → 일괄 다운로드가 끊김 없이 동작`.

**layout-skeleton.md `{{SKELETON_TSX}}`** — 3-way 분기 (design doc(2026-06-01) §7-2):

분기는 머지 결과에 따라 결정된다:

**Case 1 — 정밀 스켈레톤** (`merged.layoutTree` 존재 — figma@design 소스 있음):

현행 동작 그대로:
1. `templates/layout-skeleton.md.tmpl` 로드. 헤더는 `buildSpecHeader({ generatedAt, status, sources, definitionVersion })` 출력으로 헤더 블록 전체를 통째 치환 ([7-3] Step 2와 동일). definitionVersion은 §0이 `consume`일 때만(§0 규칙, [7-3] Step 2와 동일).
2. `{{PAGE_NAME}}` 치환.
3. `merged.layoutTree`를 tsx 문자열로 직렬화해 `{{SKELETON_TSX}}`에 채운다:
   - 노드를 중첩 div로 펼치되 `containerLayout`/`visualStyle`/`sizing`을 `style={{...}}` inline으로(케이스1 width/height 생략).
   - `kind==='leaf'`면 `placeholderDescriptor`로 `{/* 컴포넌트 교체 필요 | role=... | ... | node=... */}` + 힌트 라인 + placeholder div.
   - **힌트 라인 결정**: `detectStyledLibrary(projectContext.techStack의 dependencies)` 호출. 반환값(라이브러리명)이 있으면 `후보: <lib> <role→Component> (검증 필요)`(Component는 role/variant로 추론), `null`이면 `직접 구현`.
     - `detectStyledLibrary`가 `shadcn`을 반환하면 role→PascalCase shadcn 컴포넌트로 힌트: `후보: shadcn <Component> (검증 필요)`. 매핑 예: button→Button, dialog→Dialog, select→Select, tabs→Tabs, tooltip→Tooltip, checkbox→Checkbox, dropdown→DropdownMenu, popover→Popover. 매핑에 없으면 `직접 구현`.
   - `kind==='composite-boundary'`면 `{/* domain-boundary: <name> [(nested in <parent>)] */}`.
   - `case2`/`incomplete`는 정규 리터럴 마커로(`references/layout-extraction.md`).
   - 반복 노드는 1샘플 + `{/* 반복: ... */}`.
   - JSX 자식 위치 주석은 전부 `{/* */}` (tsx 유효성).
4. 직렬화된 tsx를 ```tsx 펜스 안에 넣어 산출.

**Case 2 — 구조 스켈레톤** (`merged.layoutTree` 없음 + `components` 또는 `semanticUIElements` 존재 — 문서 소스에서 구조 추론):

1. `components` + `semanticUIElements`의 `parentContext`를 이용해 중첩 계층을 파악한다.
2. 계층을 중첩 div로 직렬화한다. **`style` 속성은 완전히 생략** (시각 값 미추론 원칙).
3. leaf 요소마다: `{/* 컴포넌트 교체 필요 | role=<role> | <id> [inferred] | <detectStyledLibrary 힌트> */}` + placeholder div. detectStyledLibrary는 role 기반이라 layoutTree 없이도 적용 가능.
4. 파일 최상단에 `<!-- 시각 소스 없음: 레이아웃/스타일 미정, 구조만 [inferred] -->` 주석.
5. 헤더에 `<!-- structural -->` 플래그 추가 (machine-generated 마킹).
6. status: **draft** 강제 (추론 구조이므로 검증 필요).

**Case 3 — 스텁** ([6.5] 게이트에서 사용자가 "API 명세 spec 생성"을 선택한 경우):

파일 내용:
```
<!-- stub -->
UI 구조를 추출/추론할 수 없습니다. Figma 디자인 노드나 화면 설명 문서를 추가하세요.
```
헤더에 `<!-- stub -->` 플래그.

**스텁/구조 → 정밀 전환 규칙** (design doc(2026-06-01) §7-2 Important-4):
- 스텁(`<!-- stub -->`) 또는 구조 스켈레톤(`<!-- structural -->`) 파일은 machine-generated 마킹된 상태.
- 이후 재실행에서 layoutTree를 확보하면(Figma 소스 추가), 정밀 스켈레톤으로의 전환은 **diff-then-confirm 예외** — 마킹된 파일은 "사용자 편집 우선" 보호에서 제외하고 confirm 1회 후 통째 교체.
- 단, 사용자가 직접 편집한 흔적(플래그 제거 또는 본문 내용 변경)이 있으면 보호 대상으로 복귀 — 일반 diff-then-confirm 적용.

`detectStyledLibrary`는 `scripts/detectStyledLibrary.mjs`에서 import한다.

#### [7-5] EARS 변환 검증

- [ ] 모든 FR이 6가지 패턴 중 하나로 분류되었는가
- [ ] EARS 키워드(WHEN/WHILE/WHERE/IF/THEN/THE SYSTEM SHALL) 사용이 패턴 정의와 일치하는가
- [ ] Complex 항목이 자동 결합되지 않았는가 (사용자 명시 source 확인)
- [ ] tasks.md의 각 Task가 requirements.md의 FR과 1:N 매핑되는가 (FR ID 참조 무결성)

위반 → 사용자 보고 + 수정 옵션. 각 위반 항목을 개별 AskUserQuestion으로 묻되 **어떤 검증이 왜 실패했는지 + fix/skip의 결과**를 명시한다. 예 — `header` "검증 위반 2/3", `question` "FR-7이 EARS 6패턴 중 어디에도 매핑되지 않았습니다 (WHEN/WHILE/IF 등 키워드 없음). 지금 고칠까요? skip하면 이 문서는 `status: draft`로 저장되어 다른 도구가 경고합니다." / options: label `"수정 (fix)"`(description `"[7-4]로 돌아가 FR-7의 EARS 패턴을 보정"`) / label `"건너뛰기 (skip)"`(description `"draft 상태로 남김 — 추후 보강"`). 모든 위반이 fix 완료 시 [7-6]로. 하나라도 skip 시 [7-6]에서 `status: draft`로 기록.

#### [7-5.5] 완성도 스윕 (구멍 방지 — fe-spec-checklist)

산출물을 다 지은 뒤, `${CLAUDE_PLUGIN_ROOT}/docs/refs/fe-spec-checklist.md`의 각 항목(C1~)을 스펙과 대조한다. **해당사항이 있는데 빠졌거나 확정 불가**면 조용히 넘기거나 지어내지 말고 **AskUserQuestion**(inline) / **needsDecision**(dispatched=spec-author)으로 처리 방향을 묻는다(질문 품질은 `askquestion-principle.md`). 명백히 해당 없으면 스킵(과질문 금지). 이 체크리스트는 **성장형**이라 실행 시점의 최신 항목을 따른다 — 항목이 늘수록 스펙이 더 검증된 형태로 완성된다. 미해소 항목이 남으면 [7-6]에서 `status: draft`.

#### [7-6] 상태 결정

- 모두 통과 → `status: finalized`
- `status: draft` 트리거 (다음 중 하나):
  - **[7-5.5] 완성도 스윕에서 미해소로 남은 체크리스트 항목 존재**
  - 사용자가 [5] 또는 [6] askQuestion 중간 중단
  - AskMissingRequirement 출력의 `status === 'draft'` (필수 필드 미충족 후보 존재)
  - [7-5] 검증 위반 중 사용자가 fix를 거부한 항목 존재
  - 머지 결과에 **`_inferred` 항목이 산출물에 포함됨** (AI 추론 골격)
  - **일부 소스 로드 실패** 후 사용자가 "나머지 소스로 계속" 선택
  - [4]를 중간 중단해 **미해소 `_possibleDuplicates`가 남음** ([4]에서 양쪽 후보에 `<!-- 미확정 중복후보 -->` 주석 부착)
- draft 상태는 헤더 메타(`<!-- status: draft -->`)에 표시 — 다른 도구가 이를 인식하고 경고.

#### [7-7] 파일 저장 — 재실행 정책 (design doc(2026-06-01) §8-4)

`docs/specs/pages/<page-kebab>/` 디렉토리:

| 시나리오 | 정책 |
|---|---|
| 디렉토리 없음 | 신규 생성 + 4개 파일 작성 |
| 디렉토리 있음 + 동일 page | 새 결과와 기존 산출물 diff 표시 → 항목별 confirm → 동의 시 갱신, 거부 시 기존 유지 |
| 일부 산출물만 갱신 요청 (`--only requirements` 등) | 해당 파일만 처리. **다른 파일(헤더 포함)은 일절 건드리지 않음** — 헤더 버전 혼합 허용(parseSpecHeader가 파일별 버전 독립 파싱). 전체 디렉토리를 specVersion 1.1로 올리려면 `--only` 없이 전체 재실행. |
| 사용자가 산출물 직접 편집 후 재실행 | 사용자 편집 우선 — dt-spec은 누락 부분만 추가 (diff 후 confirm) |
| 스텁/구조 스켈레톤 재실행 (layoutTree 확보) | diff-then-confirm 예외 — [7-4] 전환 규칙 참조 |

**핵심 원칙**: 자동 덮어쓰기 금지.

이 재실행 정책은 4개 산출물 모두(`requirements.md`/`design.md`/`tasks.md`/`layout-skeleton.md`)에 동일하게 적용된다.

## 상향 정합 (deep-read ↔ 정의서 IF diff) — 게이트 + 쓰기 (T2~T8)

산출 직전, deep-read로 얻은 실제 계약을 정의서 IF와 diff하고 잠정 IF를 승격한다. 전체 절차(T2~T8·D8·H3·compare-and-swap·쓰기 순서)는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/upward-alignment.md`를 Read해 적용한다 — **이 스킬은 FE이므로 `deepRead`=Figma deep-read, `unitRef`=`dt-spec/<page>`**. §0이 `consume`(generated)일 때만 적용.

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
- **능동 요약 알림(D5 ②):** standalone(`definitionSOT: none|unstructured`)이면 고정 `⚠ 정식 SOT 없이 작성됨(일관성 미보증) — /dt-devspec 정식화 권장`. consume이면 자기 스펙이 의존하는 IF 중 `협의중`/`컨벤션` 잔존 시 `ℹ 협의중/컨벤션 M건 — BE 상향정합(T2/T3) 시 확정`(M은 from-ref·basedOnDefinition 필터로 자기 의존분만; standalone info는 자기 본문 협의중/컨벤션 IF 수). nag+info 동시면 ` · `로 병기. 미산출 종료(corrupt/versionTooHigh/공집합)는 원인 맞춤 라우팅으로 갈음(이 알림 비적용).

## 단일 출처 참조

- **체크리스트 단일 출처**: design doc(2026-06-01) §7-1 [4-2] (c) — `AskMissingRequirement`가 처리
- **라벨 정의 단일 출처**: `${CLAUDE_PLUGIN_ROOT}/docs/refs/ears-patterns.md` — 출처 라벨(`ai-confirmed`/`ai-edited`/`user-added`/`[inferred]`/`[user-resolved]`) + 패턴 라벨(`Event-driven` 등) + EARS 6패턴 분류표
- **소스 해석 단일 출처**: `scripts/parseSources.mjs` — 타입 자동감지 우선순위 + 카디널리티 검증
- **머지 (a) 단일 출처**: `scripts/mergeExtractionResults.mjs` — 정확 키 union + `_conflicts` + `_inferred` 소거
- **정합 사전필터 단일 출처**: `scripts/alignmentCandidates.mjs` — role 일치 + label 자카드 유사도 후보 생성
