---
name: dt-spec-analyze-figma
user-invocable: false
description: Use when dt-spec needs to analyze a Figma design page (the screen the user will build), extract UI tree/components/semantic UI elements, and infer where APIs are needed. Returns API candidates with confidence labels (confident | ambiguous). Does NOT call EARS conversion — that happens in GeneratePageDevSpec.
---

# AnalyzeFigmaFrame

Figma 디자인 페이지(사용자가 만들 화면)를 분석해 UI tree + API 필요 지점을 추출한다.

## 책임 (design doc 5-2)

- Figma 디자인 node 구조 분석
- UI 의미론 분류 (button/input/list/detail 등)
- **API 필요 지점 추론 (필요성)** — design doc 6절 [4-1]

## 입력

- `figmaPageNodeId` (필수)
- `figmaFileKey` (필수 — MCP 도구가 `nodeId`+`fileKey` 둘 다 required. URL 입력이면 거기서 파생. GeneratePageDevSpec [1]이 전파.) `figmaFileKey`는 호출 인자일 뿐 산출물 헤더 추적 필드 아님 — 헤더의 소스 추적은 `buildSpecHeader({ generatedAt, status, sources })`의 `sources` 배열이 담당한다.
- `figmaDesignSystemNodeId` (옵셔널 — 있으면 design token/컴포넌트 매칭)
- `projectContext` (CollectProjectContext 출력)

## 출력 (raw JSON, EARS 변환 X)

```
{
  uiTree: <기존 그대로 — node tree { id, name, type, children } 보존>,
  components: [{ name: string, _provenance: { type: 'figma', locator: <figmaPageNodeId> } }],
  semanticUIElements: [{ id, role, sourceNodeId, parentContext, _provenance: { type: 'figma', locator: <figmaPageNodeId> } }],
  apiCandidates: [{ featureName, kind, sourceUiElement, confidence, _provenance: { type: 'figma', locator: <figmaPageNodeId> } }],
  designTokens: { ... 색/타이포/간격/radius/shadow ... },
  assets: [{ nodeId, name, localPath, format, usage }],   // Step 1에서 download_assets로 저장한 실제 파일 매니페스트
  layoutTree: <중첩 노드. 각 노드 필드는 references/layout-extraction.md + 아래 표 참조>
}
```

> **출력 필드 상세** (위 JSON의 축약 항목 — 기존 정의 유지):
> - `uiTree`: Figma get_design_context 응답의 node tree 보존: `{ id, name, type, children }`.
> - `components[]`: 각 항목은 `{ name: string, _provenance: { type: 'figma', locator: <figmaPageNodeId> } }` 형태. 머지 레이어가 소스 추적 시 사용 (design doc(2026-06-01) §5-1).
> - `semanticUIElements[]`: 각 항목은 `{ id, role, sourceNodeId, parentContext, _provenance: { type: 'figma', locator: <figmaPageNodeId> } }` 형태. 머지 레이어가 소스 추적 시 사용 (design doc(2026-06-01) §5-1).
> - `apiCandidates[]`: 각 항목은 `{ featureName, kind: 'list' | 'detail' | 'mutation' | 'delete' | 'paginated-list' | 'upload' | 'search', sourceUiElement, confidence: 'confident' | 'ambiguous', _provenance: { type: 'figma', locator: <figmaPageNodeId> } }` 형태. 머지 레이어가 소스 추적 시 사용 (design doc(2026-06-01) §5-1).
> - `designTokens`: `{ colors: { [name]: string }, typography: { [name]: { fontFamily, fontSize, fontWeight, lineHeight? } }, spacing: number[], radius: number[], shadow?: { [name]: string } }` (Step 1.5에서 추출; `shadow`는 get_design_context가 CSS var로 반환하는 elevation/drop-shadow).
> - `assets[]`: 각 항목 `{ nodeId, name, localPath, format: 'svg'|'png'|'jpg', usage }` — Step 1에서 `download_assets`로 `docs/specs/assets/<page>/`에 저장한 실제 파일 매니페스트. GeneratePageDevSpec이 `design.md ## 에셋 매니페스트`로 직렬화하고, 구현 단계가 이 경로로 실제 `<img src>`/SVG import를 배선한다(플레이스홀더 금지).

### layoutTree 노드 필드

| 필드 | 의미 | 출처 |
|---|---|---|
| `nodeId` | node id | metadata/code |
| `kind` | `wrapper` \| `leaf` \| `composite-boundary` | 판정 |
| `containerLayout` | `{ display, flexDirection, gap, padding, alignItems, justifyContent, flexWrap }` | 코드 |
| `visualStyle` | `{ background, color, border, borderRadius, textAlign, opacity }` | 코드 |
| `sizing` | `{ width?, height?, position?, top?, left?, zOrder? }` (케이스2/오버레이) | metadata XML |
| `text` | 문구 | 코드 |
| `placeholderDescriptor` | `{ role, variant?, 부속키…, onAction?, hintLine }` (leaf) | 판정 |
| `domainBoundary` | `{ name, nestedIn? }` (composite-boundary) | name 추론 |
| `iconDescriptor` | 아이콘 의미/후보 (icon role) | 스크린샷+텍스트 |
| `repeat` | `{ isSample: true, mapExpr }` | 반복 |
| `case2` / `incomplete` | 추정/실패 마커 데이터 | 분석 |
| `children` | 자식 배열 | tree |

`hintLine`은 GeneratePageDevSpec이 주입한다(이 스킬은 placeholder의 role·variant만 결정, 힌트 라인은 비움). 상세 규칙은 `references/layout-extraction.md`.

`semanticUIElements[].role`은 단일 값이다. 한 node가 두 의미를 갖는 경우(예: `form_field` + `submit_action`의 페어링)는 **별도 entry 2개**로 분리하고 동일 `parentContext`(form 컨테이너 id)로 묶는다.

> **kind enum 주의**: 본 SKILL의 7개 kind 값(`list/detail/mutation/delete/paginated-list/upload/search`)이 source of truth (design doc 6절 [4-1] 매핑 규칙). design doc 5-2 표에 4개로 단순 표기된 것은 표기 단축이며, 후속 스킬(AskMissingRequirement, GeneratePageDevSpec)도 7개 모두를 처리해야 한다.

## 절차

### Step 1: Figma MCP 호출

(Pre-flight Check는 GeneratePageDevSpec이 이미 수행했다고 가정. 사용 가능 MCP 도구 정의는 design doc 5-4 "Figma MCP 활용 범위" 참조.)

1. `get_design_context({ nodeId: figmaPageNodeId, fileKey: figmaFileKey })` — **reference 코드 문자열 + 동봉 스크린샷 + asset URL** 수신(좌표 구조화 JSON 아님). 코드 문자열 원본을 (uiTree 축약과 별개의 중간 산출물로) 보존.
2. `get_metadata({ nodeId: figmaPageNodeId, fileKey: figmaFileKey })` — XML(id/type/name/position/size). 절대좌표·크기·형제 순서(z-order) 권위 출처. XML 원본 보존.
3. **변수 정의(토큰 권위값)** — `get_variable_defs({ nodeId: figmaPageNodeId, fileKey })`를 **디자인시스템 노드가 없어도** 대상 페이지 노드에 호출한다. 반환된 name→value 매핑을 designTokens의 **권위 출처**로 삼는다(빈도 집계 추론보다 우선 — 실제 변수명·semantic 이름 확보). `figmaDesignSystemNodeId`가 별도로 주어지면 그 노드에도 호출해 병합하고, `search_design_system(figmaDesignSystemNodeId, query)`로 컴포넌트를 매칭한다. 변수가 없는 파일이면 빈 결과 허용(Step 1.5 빈도 집계로 폴백).
4. **에셋 다운로드(에셋 충실도)** — 에셋을 담은 leaf(이미지·사진·아이콘·로고 — layoutTree leaf role이 image/icon/logo)에 대해 `download_assets({ nodeId, fileKey, defaultFormat })`를 호출해 **실제 파일**을 `docs/specs/assets/<page>/`에 저장한다. 벡터 아이콘/로고는 `defaultFormat:'svg'`, 사진/래스터는 `png`(투명 필요없으면 `jpg`). 저장한 각 파일을 `assets[]` 매니페스트(`{ nodeId, name, localPath, format, usage }`)에 기록한다. asset URL은 ~7일 만료이므로 **스펙 시점에 즉시 다운로드**한다. 다운로드 실패(권한/에셋 없음)는 silent 금지 — 해당 leaf에 `incomplete`(에셋 미수거) 마커.

(도구 표기는 design doc 5-4 "Figma MCP 활용 범위" 컨벤션을 따른다. 기존 prefix 표기를 쓰는 환경이면 그 prefix를 유지하되 인자는 `{ nodeId, fileKey }` 둘 다 전달.)

### Step 1.5: designTokens 추출 + layoutTree 빌드

1. **designTokens** — Step 1의 `get_variable_defs` 결과가 있으면 그 name→value를 **권위 출처로 우선** 채택(semantic 변수명 보존), 없거나 빈 항목만 반복 색/타이포/간격/radius **빈도 집계**로 보완. `get_design_context`가 CSS var로 반환하는 **shadow/elevation**도 `shadow`에 수집. 추출 불가 시 빈 값 허용.

2. **layoutTree** — `references/layout-extraction.md`의 추출→판정→직렬화 절차로 빌드한다:
   - get_design_context 코드 문자열 파싱 → `containerLayout`/`visualStyle`/`text`.
   - get_metadata XML 병합 → `sizing`(좌표/크기/z-order).
   - 케이스1/2/2-B 분류 + gap 폴백 사다리(가로/세로 역산 → CASE-2 → absolute 보존).
   - leaf 판정 + role enum 할당 + 부속 키 + (그려진) onAction 단서.
   - 컴포지트 wrapper에 domain-boundary(중첩 깊이 표기), 반복은 1샘플.
   - **failure 강등(silent empty 금지)**: 노드 레이아웃/스타일 추출 실패 시 빈 값 대신 `incomplete` 표기(INCOMPLETE 정규 리터럴). 동봉 스크린샷 부재 시 스크린샷 의존 비결정 필드(아이콘 의미·text-align·variant·gap 추정)를 `?`/`unknown`/CASE-2로 강등. `sizing.zOrder`는 형제 순서 정수 인덱스(뒤=작은 값).
   - get_design_context/get_metadata **전체** 실패는 기존대로 throw → orchestrator 보고.

### Step 2: UI 의미론 분류

각 node를 의미 단위로 분류:
- form_field (input, textarea, select)
- submit_action (submit 버튼, "저장"/"등록" 등 명령형)
- list (반복 영역 + 카드/행)
- detail (단일 엔티티 상세 영역)
- delete_action (휴지통 아이콘, "삭제" 등)
- search (검색 input + 결과 영역)
- pagination / infinite_scroll
- file_upload
- toggle / switch
- navigation_link

분류 근거:
- node 이름 (Figma의 layer name)
- 시각적 위치/구조 (예: input + 명령형 텍스트 버튼 = form_field + submit_action)
- design system 매칭 결과 (있다면)

### Step 3: API 필요 지점 추론 (필요성)

design doc 6절 [4-1] 매핑 규칙:
- submit_action 버튼 → mutation API
- 목록 영역 → list query API
- 상세 영역 → detail query API
- delete 액션 → delete mutation
- 검색 input + 결과 목록 → GET with query param (`kind: 'search'`)
- 페이지네이션/무한스크롤 → 페이징 GET (`kind: 'paginated-list'`)
- 파일 업로드 input → POST multipart (`kind: 'upload'`)
- **toggle/switch → 후보 등록하되 `confidence: 'ambiguous'`로 표시**, `kind`는 잠정 `'mutation'`. AskMissingRequirement 단계에서 사용자가 UI-only / mutation 결정.
- navigation_link → 후보 등록 X (클라이언트 라우팅으로 처리).

**값은 절대 추정하지 않는다** (design doc 결정 6). endpoint/method/schema는 AskMissingRequirement가 사용자로부터 받음.

MCP 호출 실패 시 (빈 응답 / node 조회 실패) 빈 결과를 반환하지 말고 에러를 throw해 orchestrator(GeneratePageDevSpec)가 사용자에게 보고하도록 한다.

### Step 4: confidence 라벨

design doc 6절 [4-1]:
- `confident`: 명확한 UI 패턴 (submit 버튼 + form, 휴지통 아이콘 + 행 등)
- `ambiguous`: 모호한 패턴 (단순 "확인" 버튼, 토글, 의미 불명 아이콘 등)

ambiguous 후보는 AskMissingRequirement가 사용자 명확화 질문으로 처리한다.

### Step 5: 반환

위 구조의 raw 객체 반환. EARS 변환은 GeneratePageDevSpec이 수행.

## 레이아웃 추출 규칙 단일 출처

layoutTree 빌드의 모든 규칙(케이스 분류·gap 사다리·role enum·마커 리터럴·주석 형식·오버레이)은 `references/layout-extraction.md`를 따른다. 본 SKILL은 호출·출력 계약만 정의하고 방법론은 reference에 위임한다.

## 병렬 실행

`AnalyzeDocument`와 입력이 독립 → 병렬 실행 OK (design doc 5-3).
