# dt-spec 다중 소스 입력 — 설계 문서

작성일: 2026-06-01
이전 설계: `2026-05-27-figma-ux-spec-plugin-design.md` (figma-ux-spec 단일 Figma 소스 기반)
관련 결정: 본 문서는 figma-ux-spec → **dt-spec 전면 rename** + 입력 소스를 Figma 단일에서 다중 소스(Figma/Markdown/PDF/웹)로 일반화한다.

> **현행 상태 전제 (검증됨, 2026-06-01)**: figma-ux-spec은 **별도 플러그인이 아니라 `dt-frontend` 통합 플러그인의 일부**다 (`plugin/.claude-plugin/plugin.json` name=`dt-frontend`, version `0.3.0`; `.claude-plugin/marketplace.json` 플러그인 1개, version `0.2.0` — **버전 불일치 존재**). 페이지 산출물은 **4개**(`requirements.md`/`design.md`/`tasks.md`/**`layout-skeleton.md`**) + 프로젝트 단위 `project-context.md`다. 현행 `figma-ux-spec-analyze-figma`의 시각 출력은 `componentStyles`가 아니라 **`layoutTree`**(중첩 레이아웃 트리, `references/layout-extraction.md` 절차로 빌드)이며, generate-spec [3] 머지에서 `componentStyles` 키 삭제 + `layoutTree` 키 추가가 이미 반영돼 있다. `layout-skeleton.md`는 `layoutTree`를 TSX 스켈레톤으로 직렬화한 산출물(`detectStyledLibrary.mjs`로 컴포넌트 라이브러리 힌트 주입)이다. 이전 5-27 설계의 "별도 플러그인"·"componentStyles" 서술은 폐기됐다.

---

## 1. 목표와 배경

### 1-1. 문제

기존 figma-ux-spec은 입력이 **Figma 두 노드(디자인 + 와이어프레임)로 고정**되어 있다. 스펙을 뽑을 수 있는 수단이 Figma 하나뿐이라, 요구사항이 Markdown·PDF·Confluence/Notion 같은 문서로 존재하는 경우를 다루지 못한다.

### 1-2. 목표

- 입력 소스를 **Figma 단일 → 다중 소스로 일반화**: Figma 노드 / Markdown / PDF / 웹 문서(Notion·Confluence·일반 URL).
- **문서만으로도 완전 대체 가능** — Figma 없이 요구사항 문서만으로 스펙 생성.
- **여러 소스 조합 허용** — 한 실행에서 N개 소스를 받아 서로의 빈 영역을 보완.
- 소스가 늘어도 **하위 파이프라인은 무변경**이 되도록 추상화.
- figma-ux-spec → **dt-spec 전면 rename** (Figma가 여러 소스 중 하나일 뿐이므로 이름이 오해를 부름).

### 1-3. 비목표 (YAGNI)

- 픽셀 단위 시각 값(정확한 색·폰트·spacing·shadow·flex/gap)을 문서에서 추론하지 않는다 (값 추정 금지 원칙).
- 문서 소스는 `layoutTree`(시각 값 포함 레이아웃 트리)를 생성하지 않는다. 단 **layout-skeleton.md는 추론된 구조(components/semanticUIElements 계층)로 항상 생성**한다 — 시각 값 없는 "구조 스켈레톤"(7-2). 구조조차 없을 때만 스텁.
- 자동 코드 생성은 여전히 범위 밖 (dt-scaffold 등 소비 도구의 책임).
- 다중 Figma 디자인 노드(여러 화면 합성)는 첫 iteration 비목표 — design/wireframe 각 **최대 1개**.

---

## 2. 핵심 결정 요약

| # | 결정 | 근거 |
|---|---|---|
| 1 | 문서만으로 Figma 완전 대체 가능 | 기획서 기반 프로젝트 지원 |
| 2 | 다중 소스 조합 허용 (한 실행 N개) | 시각(Figma) + 의도(문서) 상호 보완 |
| 3 | 머지 = (a)순수 구조 머지 + (b)LLM 정합 패스. 충돌은 사용자 확인으로 위임 | 식별자 불일치·자유텍스트 모순을 침묵으로 흘리지 않기 위해 |
| 4 | 공통 IR(ExtractionResult) + 플러그형 어댑터 | 하위 파이프라인 소스-무관, 확장 시 어댑터만 추가 |
| 5 | 새 분석기는 `dt-spec-analyze-document` **하나** | PDF·웹은 "로드 방법"만 다르고 분석은 텍스트/이미지 공통 |
| 6 | 구조(components/semanticUIElements)는 `[inferred]` 라벨로 추론, 시각 값(designTokens/layoutTree)은 안 지어냄. layout-skeleton.md는 추론 구조로도 생성(시각 값 없는 구조 스켈레톤) | 값 추정 금지 + 문서만 입력에도 골격 제공 |
| 7 | 추론 항목·부분 로드 실패 포함 시 status: draft | AI 추론 골격·불완전 입력은 검증 필요 |
| 8 | positional locator 나열 + 자동감지, `--source`는 명시 옵션 | 사용성 — 그냥 나열하면 됨 |
| 9 | Figma 역할은 `@role` 미지정 시 항상 질문 (단, 1.0 산출물 마이그레이션은 예외) | "모호하면 항상 확인" 철학 일관 적용 |
| 10 | figma-ux-spec → dt-spec 전면 rename (alias 없음) + plugin/marketplace 버전 동기화 | dt-scaffold·dt-review 명령 패밀리 일관 |
| 11 | Figma design/wireframe 각 최대 1개 (다중 디자인 노드 비목표) | 현행 analyze-figma가 단일 pageNodeId 입력. 다중 프레임은 **상위 노드로 묶어 우회 가능**하므로 결정 2(조합 허용)와 충돌 봉합 |

---

## 3. 아키텍처 (4 레이어)

```
사용자: /dt-spec <locator>[@role] <locator> ... [--source <locator>[@role]] [--only ...]
   │
   ▼
[A] 소스 해석 레이어  (신규)
   - locator 파싱 + 타입 자동감지 (figma / markdown / pdf / web)
   - 콘텐츠 로드: MD→Read · PDF→Read(pages) · URL→MCP(Notion/Atlassian)/WebFetch · figma→노드참조
   - 결과: ResolvedSource[]
   │
   ▼
[B] 소스 어댑터 (분석기)  — 각 소스를 부분 ExtractionResult로 변환 (병렬)
   - figma@design    → dt-spec-analyze-figma          (기존; uiTree/components/semanticUIElements/apiCandidates/designTokens/layoutTree)
   - figma@wireframe → dt-spec-analyze-ux-wireframe    (기존; pageMeta/userStories/scenarios/businessRules/edgeCases)
   - 문서 콘텐츠      → dt-spec-analyze-document         (신규; 의도 영역 + 구조 추론, 시각 영역 비움)
   │
   ▼
[C] 머지 레이어  (신규, 2단계)
   - (a) 순수 구조 머지: 정확 키 일치 union + _provenance 누적 + 필드단위 충돌 탐지  (mergeExtractionResults.mjs, 테스트 대상)
   - (b) LLM 정합 패스: 크로스소스 동일요소 정렬(다른 id/명) + 자유텍스트 모순/중복 탐지 → _conflicts / _possibleDuplicates
   │
   ▼
[D] 하위 파이프라인  — 거의 무변경 (IR만 보므로 소스 무관)
   - dt-spec-ask-missing (충돌·중복후보·누락 사용자 확인)
   - dt-spec-generate-spec [7] (raw→EARS, 4개 산출물 빌드/저장)
```

### 설계 원칙

1. **소스-무관 하위 파이프라인** — [D]는 IR만 보고 원본 소스를 모른다. 소스 추가 시 [D] 무변경.
2. **어댑터는 채울 수 있는 만큼만** — 문서 어댑터는 의도/규칙 풍부, 시각(designTokens/layoutTree) 비움. Figma 어댑터는 반대. 머지가 합집합으로 보완.
3. **머지는 정렬·탐지까지, 해결은 안 함** — 머지는 충돌/중복후보를 만들어 표시하고, 실제 선택은 ask-missing(사용자 확인). 단 빈 필드 채움(null 보완)은 머지가 수행(값 충돌엔 절대 적용 안 함).

---

## 4. 소스 해석 레이어 [A]

### 4-1. locator 문법

```
/dt-spec <locator>[@role] <locator>[@role] ...
         [--source <locator>[@role]]   # 명시용 옵션 (자동감지가 틀릴 때)
         [--only requirements|design|tasks|layout-skeleton]
```

- positional 인자를 locator로 나열 — 타입 자동감지.
- `--source` 플래그는 동일 의미의 명시 수단 (선택).
- `@role` — 선택적 역할 힌트 (Figma만 의미).

### 4-2. 타입 자동감지 (우선순위 명시)

감지는 **위에서 아래로 첫 매칭** (우선순위 고정):

| 순위 | 패턴 | 타입 | 로더 |
|---|---|---|---|
| 1 | `--source type:...` 또는 `@`앞에 명시 prefix | (명시값) | 해당 로더 |
| 2 | `figma.com/...` URL | `figma` | 노드 참조 (Figma MCP) |
| 3 | 확장자 `.md` `.markdown` `.txt` | `markdown` | Read |
| 4 | 확장자 `.pdf` | `pdf` | Read (pages, 멀티모달) |
| 5 | `notion.so/...` `*.atlassian.net/...` | `web` | MCP (Notion/Atlassian) |
| 6 | 기타 `http(s)://...` | `web` | WebFetch |
| 7 | `^\d+:\d+$` (경로/URL 아닌 순수 노드 id) | `figma` | 노드 참조 |

> **충돌 회피**: 파일 경로(확장자·`/`·`\` 포함)와 URL을 노드 id 패턴(7순위)보다 **먼저** 판정한다. Windows 경로(`C:\...`)·콜론 포함 경로가 노드 id로 오인되지 않음. 자동감지가 틀리면 `--source markdown:./weird:name.txt`처럼 명시(1순위).

### 4-3. 역할(@role) 처리 + 카디널리티

| 입력 | 처리 |
|---|---|
| Figma 노드, `@role` 명시 (`235:1412@design`) | 명시값 사용, 안 물어봄 |
| Figma 노드, 역할 미지정 | **항상 askQuestion으로 확인** (결정 9) |
| 문서 (md/pdf/web) | 역할 불필요 — 안 물어봄 |

**카디널리티 (결정 11)**: Figma `design` 최대 1개, `wireframe` 최대 1개. 위반 시(예: design 2개) → 에러: "Figma 디자인 노드는 1개만 지원합니다. 한 화면이 여러 프레임으로 나뉘어 있으면 **그 프레임들을 감싸는 상위 프레임 노드 id**를 주세요(상위 노드로 우회)." + 중단. (별도 실행을 권하지 않음 — 두 프레임이 서로 다른 페이지 디렉토리로 흩어져 한 화면 스펙이 깨지므로.) 문서 소스는 개수 무제한.

역할 질문은 askQuestion 작성 원칙대로: Figma 노드들을 함께 보여주고, 옵션 첫 번째에 추천 매핑(첫 노드=design, 둘째=wireframe)을 제시하되 사용자가 명시적으로 선택하게 한다.

### 4-4. 출력

```
ResolvedSource[] = [
  { type:'figma',    locator:'235:1412', role:'design', nodeRef:'235:1412' },
  { type:'markdown', locator:'./reqs.md', content:'<파일 내용>' },
  { type:'pdf',      locator:'./spec.pdf', content:'<페이지별 추출 텍스트/이미지>' },
  { type:'web',      locator:'https://notion.so/...', content:'<fetch 결과>' }
]
```

### 4-5. 에러·부분실패 처리

- locator 감지 실패 → "소스 타입을 알 수 없습니다: `<locator>`. figma 노드, .md/.pdf 경로, 또는 URL을 넣어주세요" + 중단.
- **단일 소스 로드 실패** (파일 없음 / fetch 401 / MCP 미연결) → 해당 소스 보고 + "나머지 소스로 계속할까요?" 사용자 확인. **계속 선택 시 status: draft 강제** + 헤더 sources에 실패 소스를 `(load-failed)` 노트로 기록 (불완전 입력 신호).
- **전체 소스 로드 실패** (유효 소스 0개로 귀결) → "모든 소스 로드에 실패했습니다" + 중단.
- **소스 0개** (positional·--source 모두 없음) → 사용법 안내 + 중단.

### 4-6. 백워드 호환 (입력 모델 변경)

> **정정**: 현행은 `pageNodeId`/`uxWireframeNodeId`를 **인자 위치로 역할 고정**해 받는다 (command argument-hint `<page-node-id> <ux-wireframe-node-id>`). "조용히 1번째=디자인으로 자동 가정"하는 동작은 **없다**. 따라서 본 설계는 기존 동작을 "폐기"하는 게 아니라, 입력 모델을 **위치 고정 → positional 나열 + 역할 질문**으로 **전환**한다.

명령명은 dt-spec으로 rename되지만 positional 입력 방식 자체는 유지. 기존처럼 노드 2개를 나열하면 역할을 질문받는다.

---

## 5. 공통 IR + 머지 + 충돌

### 5-1. ExtractionResult (공통 IR)

모든 어댑터가 이 모양의 **부분** 객체를 내고, 머지가 합친다.

```
ExtractionResult {
  // 시각/UI 영역 (figma 어댑터만 채움; 문서 어댑터는 undefined)
  uiTree?,
  components?:         [{ name, _provenance, _inferred? }],     // 구조 — 문서 어댑터도 추론 가능
  semanticUIElements?: [{ id, role, label?, parentContext?, _provenance, _inferred? }],  // 구조
  designTokens?,       // 시각 값 — figma 어댑터만. 문서는 안 채움
  layoutTree?,         // 시각 레이아웃 트리 — figma 어댑터만. 문서는 안 채움 (layout-skeleton.md의 입력)

  // API/행위 영역
  apiCandidates?: [{ featureName, kind, sourceUiElement, confidence,
                     method?, endpoint?, requestSchema?, responseSchema?,
                     _provenance, _inferred? }],

  // 의도/흐름 영역 (식별자 없는 자유텍스트 — 머지 (b) 정합 패스 대상)
  pageMeta?:      { purpose, accessControl, _provenance },
  userStories?:   [{ text, _provenance }],
  scenarios?:     [{ name, steps, state, _provenance }],
  businessRules?: [{ rule, _provenance }],
  edgeCases?:     [{ case, _provenance }],

  // 메타
  _sources:           [{ type, locator, role?, loadFailed? }],
  _conflicts:         [{ field, values:[{ value, source }], note }],
  _possibleDuplicates:[{ items:[{ ref, source }], reason }]   // 크로스소스 동일추정 후보
}
```

신규 메타 필드:
- **`_provenance`** — 각 항목의 출처. `{ type, locator }` 또는 추론이면 `{ type:'inferred' }`. 병합 시 배열로 누적.
- **`_inferred`** — 문서에 단서가 없어 AI가 구조를 추론한 항목. `[inferred]` 라벨 + status draft 트리거. **구조 영역(components/semanticUIElements/apiCandidates)에만** 적용. 시각 영역(designTokens/layoutTree)은 추론 대상 아님(비움).
- **`_conflicts`** — 같은 항목의 필드 값이 소스마다 다름.
- **`_possibleDuplicates`** — 식별자는 다르지만 같은 요소로 추정되는 크로스소스 후보 (머지 (b)가 생성).

### 5-2. 머지 — 2단계

#### (a) 순수 구조 머지 — `mergeExtractionResults.mjs` (테스트 대상)

식별자가 있는 영역(components by name, semanticUIElements by id, apiCandidates by endpoint|featureName)에 대해:

1. **정확 키 일치 → 병합** — 같은 키면 한 항목으로 합치고 **양쪽 `_provenance` 누적**.
2. **필드 단위 처리** (I4 해소):
   - 한쪽만 값이 있고 다른쪽 빈 필드 → **채움(null 보완)**. 이것만이 머지의 자동 채택.
   - 양쪽 다 값이 있고 **다름** → 그 필드를 `_conflicts`에 적재 (자동 선택 안 함). "더 풍부한 쪽 우선" 같은 값 충돌 자동해결 **금지**.
   - 양쪽 값이 같음 → 그대로.
3. **`_inferred` 소거 규칙** (I1 해소): 병합 항목 중 **한쪽이라도 실제 소스 `_provenance`를 가지면 결과의 `_inferred` 제거** (실제 소스가 확인해줬으므로). 단 `_provenance`에 inferred 출처 흔적은 남긴다. 적용 단위는 **항목 단위** — 부모가 confirmed돼도 추론으로만 존재하는 자식 요소의 `_inferred`는 유지.
   - **적용 시점 (Critical-1 해소)**: 정확 키 일치로 병합되는 (a) 단계뿐 아니라, **(b)→ask-missing에서 사용자가 "동일 요소"로 병합 확정한 직후에도 재실행**한다. 키가 달라 (a)에서 병합 안 된 figma 실제항목 + 문서 inferred항목은, 사용자 확정 병합 시점에 비로소 한 항목이 되므로 그때 `_inferred`를 소거해야 부당한 `[inferred]` 라벨·draft 트리거를 막는다.
4. **시각 값** — `designTokens`/`layoutTree`는 figma 어댑터만 기여하므로 충돌 없음. (design/wireframe 각 1개 제약으로 designTokens 단일 입력 → 기존 [3.5] 토큰 merge 그대로.)

#### (b) LLM 정합 패스 — generate-spec [3-merge] 내 (a) 직후

순수 머지가 못 잡는 두 경우를 정합한다. 비결정성을 줄이기 위해 **결정적 사전필터(순수 함수) + LLM 최종판정** 2단으로 구성:

1. **크로스소스 동일요소 정렬** (C1 해소):
   - **사전필터 `alignmentCandidates.mjs`(순수, 테스트 대상)**: 서로 다른 소스의 UI 항목쌍 중 `role` 완전 일치 + `label` 토큰 자카드 유사도 ≥ 임계값(예: 0.5)인 쌍을 후보로 생성. 키는 달라도(`upload_button` vs `file_add_btn`) 이 휴리스틱으로 1차 후보를 좁힌다.
   - **LLM 최종판정**: 후보쌍만 "같은 요소인가" 판정해 `_possibleDuplicates`로 올린다. **자동 병합하지 않음** — ask-missing이 사용자에게 확인.
   - 크로스소스(서로 다른 `_provenance`) 쌍에만 적용.
2. **자유텍스트 모순/중복 탐지** (C2 해소): businessRules/userStories/scenarios/edgeCases는 식별자가 없어 (a)가 무조건 union한다. (b)가 **의미 기반**으로:
   - 근접 중복(같은 규칙 다른 문장) → `_possibleDuplicates`.
   - **상호 모순**(예: "비로그인 조회 가능" vs "조회는 로그인 필수") → `_conflicts`.
   - 트리거: 한 영역에 **항목이 2개 이상이면 소스 무관 수행** (단일 PDF 내부 상단/하단 모순도 잡기 위함 — Important-2). 크로스소스 정렬(1항)만 다중 소스 가드를 둔다.

> **잔여 리스크 (명시)**: (b) LLM 판정은 비결정적이라 동일요소를 **누락**(중복이 산출물에 남음)하거나 **오탐**(무관 쌍을 확인 질문)할 수 있다. 사전필터로 후보 범위를 좁혀 오탐을 줄이고, 누락은 "사용자가 산출물 검토에서 잡는" 최종 안전망에 의존한다. (b) 자체는 순수 함수가 아니라 단위테스트 대상이 아니며 워크스루로 검증한다.

### 5-3. 충돌·중복후보 → 사용자 확인 (ask-missing 확장)

ask-missing에 **충돌/중복 해소 Step**을 추가:

- **필드 충돌** (`_conflicts`):
  ```
  "upload_btn 버튼의 라벨이 소스마다 다릅니다:
    - Figma(235:1412): '업로드'   - 요구사항 문서: '제출'
   어느 것을 사용할까요?"  ▸ Figma 값 '업로드'  ▸ 문서 값 '제출'  ▸ 직접 입력
  ```
- **자유텍스트 모순** (`_conflicts`): 두 규칙을 제시하고 어느 것을 채택/병합/삭제할지.
- **동일요소 후보** (`_possibleDuplicates`): "이 둘이 같은 요소인가요?" → 같음(병합) / 다름(둘 다 유지).

**라벨 (M1 해소)**: 충돌에서 사용자가 한쪽을 고른 결과는 기존 `ai-edited`가 아니라 **`user-resolved`** 출처 라벨로 기록 (ask-missing/generate-spec의 라벨 단일 출처 절에 `user-resolved` 추가 — 현행 `ai-confirmed|ai-edited|user-added` 3종에 1종 추가). AI가 자동 편집한 게 아니라 사용자가 소스 간 선택을 했음을 구분.

### 5-4. 워크스루 — Figma 디자인 + 요구사항 MD

입력: `/dt-spec 235:1412@design ./docs/req/file-management.md`

- analyze-figma → components(FileTable/SearchBar/UploadButton), designTokens, layoutTree, apiCandidates(bulkDownload, ambiguous). 의도 빈약.
- analyze-document → businessRules(Jira PR-277 압축X), apiCandidates(searchFiles, confident), semanticUIElements(id=`file_add_btn`, label='제출'). 시각(designTokens/layoutTree) 없음.
- 머지 (a): SearchBar는 양쪽이 같은 name → 병합, `_provenance:[figma, markdown]`. businessRules(PR-277)는 문서만 → union.
- 머지 (b): figma의 `upload_button`(label '업로드')과 문서의 `file_add_btn`(label '제출')은 id가 다르지만 role(submit_action)·맥락 유사 → `_possibleDuplicates`로 올림.
- ask-missing: "upload_button과 file_add_btn이 같은 버튼인가요?" → 같음 선택 시 병합 후 (i) 라벨 충돌('업로드' vs '제출') 재확인, (ii) **`_inferred` 재소거** — figma 실제항목과 병합됐으므로 문서측 추론 흔적의 `[inferred]` 라벨 제거 (5-2 (a) 3항 적용 시점).

### 5-5. 워크스루 — 문서 하나만 (`[inferred]` + layout-skeleton 구조 스켈레톤)

입력: `/dt-spec ./docs/req/login-spec.md` (화면 그림 없음)

- analyze-document: components(LoginForm `_inferred`), semanticUIElements(email_input/password_input/login_btn, 모두 `_inferred`), pageMeta(purpose/accessControl), apiCandidates(emailLogin ambiguous). designTokens·layoutTree는 **undefined** (시각 값 안 만듦).
- 산출물:
  - **requirements.md** — FR에 `[inferred]` 라벨 (구조 추론분).
  - **design.md** — `{{COMPONENT_STRUCTURE}}`에 추론 컴포넌트 트리(`[inferred]`).
  - **layout-skeleton.md** — `layoutTree`는 없지만 추론된 구조(LoginForm > email_input/password_input/login_btn)가 있음 → **구조 스켈레톤**: 컴포넌트 계층을 중첩 div + placeholder + 힌트 라인으로 직렬화하되 **inline style 값은 비움**(시각 값 미추론). 전체 `[inferred]` 주석 + 상단 `<!-- 시각 소스 없음: 레이아웃/스타일 미정 -->`.
  - **tasks.md** — 정상.
- status: **draft** (추론 항목 존재).

---

## 6. dt-spec-analyze-document 스킬 (신규)

### 6-1. 책임 (단일)

- 문서 콘텐츠 → 의도/흐름/규칙/API 후보 추출 (의도 영역 풍부).
- UI **구조**(components/semanticUIElements)는 문서 단서 있으면 추출, 없으면 추론(`_inferred`).
- 시각 **값**(designTokens) 및 **`layoutTree`** 는 절대 안 채움 (undefined).

### 6-2. 입력 / 출력

- 입력: `{ type:'markdown'|'pdf'|'web', locator, content }` (단일 ResolvedSource) + projectContext.
- 출력: 부분 ExtractionResult (figma 어댑터와 **동일 계약**, 단 시각 영역은 항상 비움).

### 6-3. 절차

1. **문서 구조 파악** — 섹션 의미 분류 (요구사항/스토리/화면설명/API표/규칙/제약). 형식 무관, LLM이 의미로 판단.
2. **의도/흐름 추출** — pageMeta·userStories·scenarios·businessRules·edgeCases. 각 `_provenance` 부착. 문서에 실제로 쓰인 것만 (지어내기 금지).
3. **API 후보 추출** — 명시적 API표/엔드포인트 → apiCandidates (값 있으면 그대로, confident). 동작 서술만 → 후보만(ambiguous), 값 비움. 값 추정 금지.
4. **UI 구조 추출 또는 추론** — 화면설명 단서 있으면 추출(`_provenance:문서`), 없으면 요구사항으로부터 추론(`_inferred:true`, `_provenance:inferred`). **부모-자식 계층(`parentContext`)도 함께 추출/추론**한다 — 계층은 시각 값이 아니라 구조 정보이므로 추론 대상(결정 6 정합). 이 계층이 layout-skeleton 구조 스켈레톤(§7-2 case 2)의 중첩 입력이 된다. 어느 쪽이든 designTokens/layoutTree는 undefined(시각 값 미추론).
5. **반환** — 부분 IR. EARS 변환·머지·충돌탐지는 하위 단계.

### 6-4. 로드 책임 분리 (중요)

`analyze-document`는 **이미 로드된 content를 받는다.** 파일 읽기/PDF 페이지 추출/URL fetch는 소스 해석 레이어 [A]의 책임. 따라서:
- 형식별 분기(MD/PDF/web)는 [A]에만 존재.
- `analyze-document`는 "텍스트/이미지 콘텐츠"만 보므로 형식 무관 → 형식 늘어도 이 스킬 무변경.
- PDF가 이미지 위주면 content에 이미지 포함, 이 스킬은 멀티모달로 읽음.

### 6-5. 콘텐츠 실패 계약

- web fetch 실패는 [A]에서 처리. analyze-document 도달 시점엔 content 존재.
- content 비었거나 의미 추출 불가 → 빈 IR 대신 에러 throw → orchestrator 사용자 보고 (기존 analyze 스킬과 동일 계약).

---

## 7. 오케스트레이터 변경 + 산출물 영향

### 7-1. dt-spec-generate-spec 워크플로

기존 [0]~[7]에서 [1]~[3]만 변경, 나머지 거의 무변경.

```
[0] Pre-flight       — Figma 소스 있을 때만 MCP 체크 (figma 소스 0개면 skip)
[1] 입력 수집  (변경)  — locator 나열 파싱 → 소스 해석 레이어 [A] → ResolvedSource[]
                        → 재실행 감지 시 기존 헤더 sources 복원·union (아래 [1-재실행])
                        → Figma 역할 미지정 시 askQuestion, 카디널리티 검증
[2] 프로젝트 컨텍스트   — 기존 동일 (collect-project-context)
[3] 소스 분석  (변경)  — ResolvedSource[]를 어댑터로 분배 (병렬):
       figma@design → analyze-figma / figma@wireframe → analyze-ux-wireframe / 문서 → analyze-document
[3-merge] (신규)     — (a) 순수 머지 + (b) LLM 정합 패스 → ExtractionResult 1개 (_conflicts / _possibleDuplicates)
[3.5] 디자인 토큰 merge — 기존 그대로 (figma design 소스 있을 때만)
[4] 충돌·중복·API 후보 (확장) — ask-missing이 _conflicts/_possibleDuplicates 해소 Step + 기존 후보 검토
[5][6] 값 채우기·보강  — 기존 동일
[6.5] UI 구조 0개 빌드 게이트 (변경 B) — [3-merge] 후 components/semanticUIElements가 0(순수 API/정책 문서)이면, [7] 진입 전 AskUserQuestion으로 "API 명세 spec만 뽑을까요?" 확인 (§7-2 case 3). 생성 or 중단
[7] 산출물 빌드        — 기존 동일 (IR만 보므로 소스 무관). layout-skeleton은 3-way 분기(정밀/구조 스켈레톤/경고 후 스텁 — §7-2)
```

### 7-1-재실행. 재실행 시 소스 복원 + 카디널리티 (Critical-2 해소)

기존 페이지 디렉토리가 있어 재실행으로 판단되면, **기존 산출물 헤더의 sources를 ResolvedSource[]로 복원**해 이번 입력과 합친다:

1. 헤더 파싱(parseSpecHeader) → 복원 sources. 1.0 헤더면 8-4 마이그레이션 매핑(`figmaPageNodeId→figma:..@design` 등)으로 역할 포함 복원. **복원 figma 소스는 "이미 결정된 역할"이므로 역할 재질문 안 함** (결정 9 예외).
2. 이번 명령의 새 positional/`--source` 소스와 **union** (locator 동일하면 새 입력이 갱신, 다르면 추가).
3. **카디널리티 검증은 union 결과 기준**: design/wireframe 각 최대 1개. 복원 figma design + 새 figma design이 둘이 되면 → "이미 design 노드가 있습니다(헤더 복원). 교체하려면 기존을 제거하거나 `--only`로 부분 갱신하세요" + 중단. 즉 **신규가 기존을 조용히 교체하지 않음**.
4. union된 ResolvedSource[]로 [2] 이후 정상 진행.

`--only <artifact>` 부분 갱신 시에도 동일하게 복원하되, 산출물 빌드는 지정 artifact만 수행.

### 7-2. 산출물 영향

**requirements.md** — 라벨 체계에 `[inferred]` 추가:
```
### FR-1: 이메일 로그인  `[ai-confirmed] [Event-driven]`   ← 소스에서 나옴
### FR-3: 로그인 폼 구조  `[inferred] [Ubiquitous]`         ← AI 추론
```
충돌 해소분은 `[user-resolved]`.

**design.md** — `{{COMPONENT_STRUCTURE}}`가 소스에 따라 실제/추론. (상세 레이아웃·스타일은 현행대로 layout-skeleton.md가 담당 — design.md엔 시각 섹션 없음.)

**layout-skeleton.md** — 입력에 따라 3-way 분기:

1. **정밀 스켈레톤** (`layoutTree` 있음 — Figma design 소스): 현행 [7-4] 그대로. containerLayout/visualStyle/sizing을 `style={{...}}` inline으로, leaf는 placeholderDescriptor + 힌트, detectStyledLibrary 라이브러리 힌트.
2. **구조 스켈레톤** (`layoutTree` 없음 + 추론 구조 있음 — 문서 소스): `components` + `semanticUIElements`(`parentContext`로 중첩)를 중첩 div로 직렬화. **`style` 속성은 생략**(시각 값 미추론). 각 leaf는 `{/* 컴포넌트 교체 필요 | role=... | <id> [inferred] | <detectStyledLibrary 힌트> */}` + placeholder div. 상단에 `<!-- 시각 소스 없음: 레이아웃/스타일 미정, 구조만 [inferred] -->`. detectStyledLibrary 힌트는 role 기반이라 layoutTree 없이도 적용. status draft.
3. **경고 + 확인 후 스텁** (구조조차 없음 — 추론 가능한 components/semanticUIElements가 0, 보통 순수 API/정책 문서): 조용히 스텁을 만들지 않고 **먼저 사용자에게 확인**한다. 산출물 빌드([7]) 진입 전 AskUserQuestion:
   - `header`: "UI 정보 없음"
   - `question`: "이 문서로는 UI 레이아웃을 잡을 수 없습니다(화면/요소 단서가 없는 API·정책 명세로 보임). API 명세만을 위한 spec(requirements 데이터 명세 + design 데이터 모델)을 뽑을까요?"
   - options: label `"API 명세 spec 생성"`(description `"layout-skeleton은 스텁으로 두고 requirements/design의 API·데이터 부분만 채움"`) / label `"중단"`(description `"화면 설명이 포함된 문서나 Figma 노드를 추가해 다시 실행"`)
   - "API 명세 spec 생성" 선택 시 → layout-skeleton.md를 스텁(헤더 `<!-- stub -->` + "UI 구조를 추출/추론할 수 없습니다. Figma 디자인 노드나 화면 설명 문서를 추가하세요.")으로 두고 나머지 산출물은 정상 빌드. "중단" 선택 시 → 산출물 미생성 종료.

**스텁/구조→정밀 전환** (Important-4): 스텁·구조 스켈레톤 파일은 헤더 `<!-- stub -->`(스텁) 또는 `<!-- structural -->`(구조) 플래그로 **machine-generated 마킹**. 재실행에서 layoutTree를 확보하면(Figma 추가) 정밀 스켈레톤으로의 전환은 **diff-then-confirm 예외** — 마킹된 파일은 "사용자 편집 우선" 보호에서 제외하고 confirm 1회 후 통째 교체. 단 사용자가 직접 편집한 흔적(플래그 제거 또는 본문 변경)이 있으면 보호 대상으로 복귀.

**헤더 메타** — sources 줄 다중 소스 표기 (페이지 산출물 4개에만 적용; project-context.md 헤더는 별개 `Synced from package.json`로 **불변** — I4):
```
<!-- Generated by dt-spec@<version> at <ts> -->
<!-- status: draft -->
<!-- sources: figma:235:1412@design, markdown:./req/file-mgmt.md -->
<!-- specVersion: 1.1 -->
```

### 7-3. status: draft 트리거 (확장)

기존 3개 + 신규 2개:
- (기존) 사용자 중간 중단 / 필수 필드 미충족 / 검증 위반 fix 거부
- (신규) `_inferred` 항목이 산출물에 포함됨
- (신규) 사용자가 계속 선택했으나 **일부 소스 로드 실패** (4-5)

사용자가 [4] ask-missing을 중간 중단해 **미해소 `_possibleDuplicates`가 남으면**, draft 산출물에 중복 후보 양쪽을 모두 표기하되 각각에 `<!-- 미확정 중복후보: <상대 ref> -->` 주석을 달아 미확정 상태를 명시한다 (Minor-1).

---

## 8. buildSpecHeader 변경 + dt-spec rename + 백워드 호환

### 8-1. 현행 상태 (정확)

- `buildSpecHeader.mjs`: `buildSpecHeader({ generatedAt, status, figmaPageNodeId, figmaUxWireframeNodeId })` → `<!-- sources: figmaPageNodeId=235:1412, figmaUxWireframeNodeId=14:7347 -->`. brand `figma-ux-spec@`, 상수 `SPEC_VERSION='1.0'`.
- `parseSpecHeader`: 단일 `HEADER_REGEX`로 brand + 2-노드 sources 고정 매칭.
- 테스트: `buildSpecHeader.test.mjs` **5개** (PLUGIN_VERSION 일치 / 4줄 생성 / draft / invalid status 거부 / parseSpecHeader 표준 파싱).
- specVersion은 `SPEC_VERSION` 상수 + **4개 페이지 산출물 tmpl**(design/requirements/tasks/layout-skeleton) 라인4 하드코딩 두 곳(런타임상 헤더 통째 치환으로 tmpl 값은 덮어써짐). `project-context.md.tmpl`은 헤더가 `Synced from package.json`로 별개라 specVersion 라인이 **없음** (대상 아님).

### 8-2. 변경

```
// 변경
buildSpecHeader({ generatedAt, status, sources })   // sources: [{type, locator, role?, loadFailed?}]
// → <!-- sources: figma:235:1412@design, markdown:./req/file-mgmt.md -->
```

- **parseSpecHeader는 단일 정규식 불가** (C3): 가변 개수 sources를 옛 2-노드 고정형과 한 정규식으로 매칭할 수 없다. 구조: **brand·specVersion 캡처 → 버전 분기 → 버전별 파서** (1.0: `figmaPageNodeId=.., figmaUxWireframeNodeId=..` 파싱; 1.1: `type:locator[@role]` 리스트 파싱). brand는 `figma-ux-spec@|dt-spec@` 둘 다 허용.
- `buildSpecHeader.test.mjs` — 5개 유지·갱신 + 다중 소스 케이스 + 옛 1.0(figma-ux-spec brand) 하위호환 파싱 테스트 추가.
- specVersion 1.0 → 1.1: `SPEC_VERSION` 상수 + **4개 페이지 산출물 tmpl**(design/requirements/tasks/layout-skeleton) 라인4 **두 곳 모두** 갱신 (project-context.md.tmpl은 대상 아님).
- **brand 캡처 경계**: parseSpecHeader는 `Generated by ` 직후부터 `@` 직전까지를 brand로 캡처하고 `(figma-ux-spec|dt-spec)` 고정 문자열 중 하나에 정확히 일치시킨다 (부분매칭 방지 — `@`가 종료 경계).

### 8-3. 전면 rename (figma-ux-spec → dt-spec)

| 대상 | 변경 |
|---|---|
| 명령 | `commands/figma-ux-spec.md` → `commands/dt-spec.md` (`/figma-ux-spec` → `/dt-spec`) |
| 스킬 5개 + 신규 1개 | `figma-ux-spec-*` → `dt-spec-*` 디렉토리 rename (collect-project-context / analyze-figma / analyze-ux-wireframe / ask-missing / generate-spec) + **신규 dt-spec-analyze-document** |
| 스킬 본문 상호참조 | 각 SKILL.md 내 `figma-ux-spec-*` 참조 문자열 일괄 갱신 (예: generate-spec [3.5]가 `figma-ux-spec-collect-project-context`/`figma-ux-spec-ask-missing` 참조; analyze-figma의 `references/layout-extraction.md` 경로는 디렉토리 rename에 따라 유지). **현행 SKILL.md의 `design doc 5-6`/`5-7`/`5-8` 등 이전 5-27 설계 절번호 참조는 본 신규 문서의 해당 절(재실행 7-1-재실행·[7-7], 라벨 단일 출처)로 갱신** |
| examples/ | `figma-ux-spec-generate-spec/examples/login-page-walkthrough.md` 이동 + 내용 내 명령·brand 참조 갱신 |
| 헤더 brand | 신규 생성분 `Generated by dt-spec@<version>` |
| plugin.json | name=`dt-frontend` 유지(통합 플러그인), **version 동기화** (현 0.3.0 → 신 버전; marketplace와 일치) |
| marketplace.json | plugin description의 figma-ux-spec 표기 갱신, **version을 plugin.json과 동기화** (현 0.2.0 ↔ 0.3.0 불일치 해소) |
| README / 메모리 | dt-spec 명령·소스 설명 갱신, figma-ux-spec 참조 정리 |

명령 패밀리 일관: `/dt-spec → /dt-scaffold → /dt-review` (스펙 생성 → 코드 → 리뷰).

옛 명령명 `/figma-ux-spec`은 **alias 없이 제거**(결정 10). rename 후 `/figma-ux-spec` 입력은 unknown command가 된다. (positional 입력 방식은 동일하므로 인자 형태 학습 비용 없음.)

### 8-4. 백워드 호환 + 마이그레이션

| 항목 | 정책 |
|---|---|
| positional 2-노드 호출 | 작동하되 역할 질문 (결정 9) |
| 기존 생성 산출물 (specVersion 1.0) | parseSpecHeader가 버전 분기로 양쪽 파싱. 재실행 시 1.1로 업그레이드 |
| **1.0 → 1.1 마이그레이션 역할 매핑** (C3) | 옛 `figmaPageNodeId → figma:..@design`, `figmaUxWireframeNodeId → figma:..@wireframe`로 **무손실 매핑**. 이는 "이미 사용자가 (위치로) 한 역할 결정"이므로 결정 9의 "항상 질문" **예외** — 재실행 시 역할 재질문 안 함 |
| **부분 재실행 헤더 버전** (Critical-3 해소) | `--only`로 일부만 재생성 시, **헤더 버전 혼합을 허용**한다 (재생성하는 파일만 1.1, 나머지는 기존 버전 유지). parseSpecHeader가 파일별 버전을 독립 파싱하므로(버전분기 파서, 추가 비용 0) 혼합이 안전하다. **재생성하지 않는 파일은 헤더 포함 일절 건드리지 않음** — 현행 "자동 덮어쓰기 금지 + 사용자 편집 우선"(generate-spec [7-7]) 원칙 준수. 디렉토리 전체를 1.1로 올리려면 `--only` 없이 전체 재실행 |
| 기존 단위 테스트 (buildSpecHeader 5 + 그 외) | 옛 포맷 파싱 회귀 유지 + 신 포맷 추가 |

---

## 9. 테스트 전략

### 9-1. 단위 테스트 (구현 `plugin/scripts/`, 테스트 `plugin/tests/`, node:test, 의존성 0)

| 대상 | 테스트 |
|---|---|
| `parseSources.mjs` (신규) | locator 자동감지(우선순위 1~7), `@role` 파싱, 카디널리티 위반(design 2개) 에러, 감지 실패 에러, 소스 0개 에러, 경로 vs 노드id 우선순위 |
| `mergeExtractionResults.mjs` (신규, 순수 (a)단계만) | 정확키 union, `_provenance` 누적, 필드단위 충돌→`_conflicts`, 빈필드 null보완, `_inferred` 소거 규칙(한쪽 실제소스면 제거), 값충돌 자동선택 안 함 |
| `buildSpecHeader.mjs` (변경) | sources 배열 → 헤더, 다중 소스 표기, parseSpecHeader 버전분기(1.0/1.1), brand `figma-ux-spec@`/`dt-spec@` 양쪽, loadFailed 노트 |
| 기존 (parsePackageJson/projectContextSync/detectStyledLibrary/layoutSkeletonTemplate) | 회귀 유지 (rename 외 무변경) |

> 머지 (b) LLM 정합 패스는 순수 함수가 아니므로 단위 테스트 대상이 아님 — 통합 워크스루로 검증.

### 9-2. 통합 워크스루 (수동, plugin/tests/integration-walkthrough.md)

기존 + 신규:
1. Figma 2-노드 (역할 질문) — 입력 모델 전환 확인
2. Figma 디자인 + 요구사항 MD — 머지 (a)+(b), `_possibleDuplicates`(다른 id 동일요소) + 라벨 충돌 해소
3. 문서 1개만 (화면 단서 있는 MD) — `[inferred]` 구조 + layout-skeleton.md **구조 스켈레톤**(질문 없이 생성) + draft
3b. 순수 API/정책 문서 1개 (UI 단서 0) — **case 3 경고+확인** AskUserQuestion → "API 명세 spec 생성" 선택 시 layout-skeleton 스텁 + 나머지 정상 / "중단" 선택 시 미생성
4. PDF 1개 — Read 페이지 추출
5. 다중 혼합 (figma + pdf + web) — 자유텍스트 모순 탐지 + 부분 로드 실패 시 draft + sources 노트
6. 1.0 산출물 재실행 — 마이그레이션 역할 무손실 매핑 + (전체 재실행) 헤더 1.1 갱신 / (`--only`) 헤더 버전 혼합 허용

### 9-3. TDD 원칙

순수 함수(parseSources/merge(a)/buildSpecHeader)는 node:test 단위 테스트. SKILL.md(LLM 동작, 머지 (b) 포함)는 워크스루 수동 검증 — 기존 방식 유지.

---

## 10. 영향 범위 요약 (구현 시 변경 파일)

**신규**:
- `plugin/commands/dt-spec.md` (figma-ux-spec.md rename)
- `plugin/skills/dt-spec-analyze-document/SKILL.md`
- `plugin/scripts/parseSources.mjs` + `plugin/tests/parseSources.test.mjs`
- `plugin/scripts/mergeExtractionResults.mjs` + `plugin/tests/mergeExtractionResults.test.mjs`
- `plugin/scripts/alignmentCandidates.mjs` (머지 (b) 결정적 사전필터 — role 일치 + label 유사도) + `plugin/tests/alignmentCandidates.test.mjs`

**rename (디렉토리 + 내부 참조 문자열)**:
- `plugin/skills/figma-ux-spec-*/` → `plugin/skills/dt-spec-*/` (5개) — SKILL.md 본문의 `figma-ux-spec-*` 상호참조 일괄 갱신
- `plugin/skills/dt-spec-generate-spec/examples/login-page-walkthrough.md` (이동 + 내용 갱신)

**변경**:
- `dt-spec-generate-spec/SKILL.md` — [1] 입력수집(소스 해석 + 재실행 소스 복원/카디널리티), [3] 어댑터 분배, [3-merge] (a)순수+(b)정합(사전필터+LLM) 신규, [4] 충돌/중복 해소 + `_inferred` 재소거, [6.5] UI 구조 0개 빌드 게이트(변경 B AskUserQuestion), [7-2] layout-skeleton **3-way 분기**(정밀 / 구조 스켈레톤 `<!-- structural -->` / 경고 후 스텁 `<!-- stub -->`), 헤더 sources, `--only` 헤더 혼합 허용
- `dt-spec-ask-missing/SKILL.md` — 충돌/중복후보 해소 Step + `user-resolved` 라벨
- `dt-spec-analyze-figma/SKILL.md`, `dt-spec-analyze-ux-wireframe/SKILL.md` — 출력에 `_provenance` 부착 (IR 계약)
- `plugin/scripts/buildSpecHeader.mjs` + 테스트 — sources 배열, parseSpecHeader 버전분기, specVersion 1.1, brand
- `plugin/templates/*.tmpl` (5개) — 헤더 specVersion 1.1, requirements `[inferred]`/`[user-resolved]` 라벨; layout-skeleton.md.tmpl 스텁 분기
- `plugin/.claude-plugin/plugin.json` — version 동기화
- `.claude-plugin/marketplace.json` — description 갱신 + version 동기화 (0.2.0↔0.3.0 불일치 해소)
- `README`, MEMORY.md — figma-ux-spec 참조 정리

**무변경**:
- `layout-extraction.md`, `detectStyledLibrary.mjs`, `regen-atlas.mjs`, layoutTree 빌드 로직 (rename 외 동작 유지)
- collect-project-context의 디자인 토큰 저장소 로직 ([3.5] merge — figma design 소스 있을 때만)
- 하위 파이프라인 [D]의 EARS 변환·검증·저장 로직, project-context.md 헤더(별개)
