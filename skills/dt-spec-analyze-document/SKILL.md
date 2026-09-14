---
name: dt-spec-analyze-document
user-invocable: false
description: Use when dt-spec needs to extract intent/flow/rules/API candidates AND infer UI structure from a document source (Markdown/PDF/web). Returns partial ExtractionResult — no EARS conversion. Never fabricates visual values (designTokens/layoutTree stay undefined).
---

# AnalyzeDocument

문서 콘텐츠(Markdown/PDF/웹)에서 페이지의 의도/흐름/규칙/API 후보를 추출하고, 필요한 경우 UI 구조를 추론한다.

## 책임 (design doc(2026-06-01) §6-1)

- 문서 콘텐츠 → 의도/흐름/규칙/API 후보 추출 (의도 영역 풍부).
- UI **구조**(components/semanticUIElements + 계층 parentContext)는 문서에 화면 단서가 있으면 추출, 없으면 요구사항으로부터 추론(`_inferred`).
- 시각 **값**(designTokens) 및 **`layoutTree`** 는 절대 채우지 않는다 (항상 undefined).

이 스킬은 figma 어댑터(`analyze-figma`)와 **동일한 출력 계약(ExtractionResult)**을 따르므로, 머지 레이어([C])가 소스 종류에 관계없이 동일하게 처리할 수 있다.

## 입력

- `source` — `{ type: 'markdown' | 'pdf' | 'web', locator, content }` (단일 ResolvedSource)
  - **`content`는 소스 해석 레이어 [A]가 이미 로드한 값** — 이 스킬은 파일 읽기/PDF 추출/URL fetch를 직접 수행하지 않는다 (design doc(2026-06-01) §6-4).
  - PDF가 이미지 위주이면 `content`에 이미지가 포함되며, 이 스킬은 멀티모달로 읽는다.
- `projectContext` — CollectProjectContext 출력

## 출력 (부분 ExtractionResult, EARS 변환 X)

figma 어댑터와 동일 계약. 단 시각 영역(designTokens/layoutTree)은 **항상 undefined** (절대 채우지 않음).

```
{
  components?:         [{ name, _provenance, _inferred? }],
  semanticUIElements?: [{ id, role, label?, parentContext?, _provenance, _inferred? }],
  apiCandidates?:      [{ featureName, kind, sourceUiElement, confidence,
                          method?, endpoint?, requestSchema?, responseSchema?,
                          _provenance, _inferred? }],
  pageMeta?:           { purpose, accessControl, _provenance },
  userStories?:        [{ text, _provenance }],
  scenarios?:          [{ name, steps, state?, _provenance }],
  businessRules?:      [{ rule, _provenance }],
  edgeCases?:          [{ case, _provenance }]
  // designTokens : 항상 undefined — 절대 채우지 않는다
  // layoutTree   : 항상 undefined — 절대 채우지 않는다
  // uiTree       : 항상 undefined (Figma node tree가 없음)
}
```

### 출력 필드 상세

**_provenance** — 항목 출처 표기 (design doc(2026-06-01) §5-1):
- 문서에서 직접 추출한 항목: `{ type: 'markdown' | 'pdf' | 'web', locator }` (입력 source와 동일 타입/locator)
- 요구사항으로부터 **추론**한 구조 항목: `{ type: 'inferred' }`

**_inferred: true** — 문서에 명시된 화면 단서 없이 AI가 요구사항으로부터 추론한 구조 항목에만 부여. 적용 대상: `components`, `semanticUIElements`, `apiCandidates`(추론으로 도출한 경우). 시각 값은 추론 자체를 하지 않으므로 해당 없음.

**role 어휘** (`semanticUIElements[].role`) — analyze-figma와 동일 어휘를 사용한다 (머지 레이어가 role 일치로 동일요소를 정렬하므로 통일이 필수):
`form_field`, `submit_action`, `list`, `detail`, `delete_action`, `search`, `pagination`, `file_upload`, `toggle`, `navigation_link`

**kind enum** (`apiCandidates[].kind`) — analyze-figma와 동일 7개 값: `list | detail | mutation | delete | paginated-list | upload | search`

**parentContext** (`semanticUIElements[].parentContext`) — 부모 컨테이너 id. 계층은 구조 정보이므로 추론 가능. 이 계층이 layout-skeleton.md 구조 스켈레톤(§7-2 case 2)의 중첩 입력이 된다.

## 절차 (design doc(2026-06-01) §6-3)

### Step 1: 문서 구조 파악

`content`(이미 로드됨)를 읽어 섹션 의미를 분류한다. 형식(MD/PDF/웹)에 무관하게 **의미**로 판단:

| 콘텐츠 단서 | 분류 |
|---|---|
| 목적·배경·페이지 설명 | 요구사항 / pageMeta 후보 |
| "사용자는 X를 한다" 형식의 행위 문장 | 사용자 스토리 후보 |
| 순서/단계·플로우 서술 | 시나리오 후보 |
| 화면·컴포넌트·UI 요소 명칭 | 화면 설명 후보 |
| API 표·엔드포인트·HTTP 메서드 명시 | API 후보 |
| "X일 때 Y해야 함", 조건문 | 비즈니스 규칙 후보 |
| 실패·타임아웃·예외·에러 처리 서술 | 엣지 케이스 후보 |
| 권한·접근 제어·로그인 필요 | accessControl 후보 |

### Step 2: 의도/흐름 추출

분류 결과를 바탕으로 의도/흐름 영역을 추출한다. **문서에 실제로 쓰인 것만 — 지어내기 금지.**

각 항목에 `_provenance: { type, locator }` 부착 (입력 source와 동일 타입·locator).

추출 대상:
- `pageMeta` — `purpose`(페이지 목적), `accessControl`(접근 제어)
- `userStories` — 사용자-행위 단위 문장 (`{ text, _provenance }`)
- `scenarios` — 플로우/단계 (`{ name, steps, state?, _provenance }`)
  - `state`는 문서에 `[로딩]`·`[빈 상태]`·`[에러]`·`[비활성]` 등이 명시된 경우만 추출: `'loading' | 'empty' | 'error' | 'disabled'`
- `businessRules` — 조건·제약 문장 (`{ rule, _provenance }`)
- `edgeCases` — 실패·예외·에러 처리 (`{ case, _provenance }`)

분류 충돌 시 우선순위:
- 번호/화살표로 순차 표기된 문장 → `scenarios.steps` 우선. 그 시나리오를 요약하는 선언은 `userStories`로 별도 등재.
- 페이지 전체 의도이면 `pageMeta.purpose`, 사용자 시점/행위 표현이면 `userStory`로 양분(중복 허용).

### Step 3: API 후보 추출

**값은 절대 추정하지 않는다.** (design doc(2026-06-01) 핵심 결정 6)

- **명시적 API표/엔드포인트/HTTP 메서드** → `apiCandidates` (있는 값 그대로, `confidence: 'confident'`). method/endpoint/requestSchema/responseSchema를 문서에서 읽어 채운다.
- **동작 서술만 있고 API 값 없음** → 후보만 등록(`confidence: 'ambiguous'`), method/endpoint/schema는 비운다. AskMissingRequirement가 사용자로부터 받음.
- 문서 단서에서 apiCandidates.kind 결정 시 analyze-figma의 7-value enum을 그대로 사용한다.
- `_provenance: { type, locator }` 부착.

### Step 4: UI 구조 추출 또는 추론

**경우 A — 화면 단서 있음** (화면·컴포넌트·요소 명칭이 문서에 명시):
- components/semanticUIElements를 문서 표현 그대로 추출.
- `_provenance: { type, locator }` (문서 출처).
- `_inferred` 부여하지 않음.
- parentContext(부모-자식 계층)도 문서 단서로 파악 가능한 경우 추출.

**경우 B — 화면 단서 없음** (순수 요구사항/정책/API 문서):
- 요구사항·사용자 스토리·비즈니스 규칙으로부터 **합리적인 UI 구조를 추론**한다.
- 추론 항목에 `_inferred: true` + `_provenance: { type: 'inferred' }` 부여.
- parentContext(부모-자식 계층)도 함께 추론한다 — 계층은 구조 정보이므로 추론 대상 (design doc(2026-06-01) §6-3 결정 6 정합).
- **추론 대상은 구조뿐** — designTokens·layoutTree(시각 값)는 단서가 있어도 채우지 않는다.
- 추론된 구조가 전혀 없는 경우(순수 API/정책 문서): components/semanticUIElements를 비워서 반환한다. 이 경우 orchestrator(GeneratePageDevSpec)가 §7-2 case 3 빌드 게이트를 통해 사용자에게 확인한다 — 이 스킬은 게이트를 직접 실행하지 않는다.

> **핵심 구분**: 구조(컴포넌트/계층)는 추론 가능. 시각 값(색·폰트·간격·레이아웃 수치)은 어떤 경우에도 추론하지 않는다.

### Step 5: 반환

위 구조의 부분 ExtractionResult 반환.

- EARS 변환은 GeneratePageDevSpec이 수행.
- 머지·충돌 탐지는 머지 레이어 [C]가 수행.
- `_inferred` 항목이 포함된 경우 orchestrator가 산출물 status를 draft로 설정한다 (이 스킬은 status를 직접 설정하지 않음).

## 콘텐츠 실패 계약 (design doc(2026-06-01) §6-5)

- `content`가 비었거나 의미 추출이 불가능할 경우 → **빈 IR을 반환하지 말고 에러를 throw**한다. orchestrator(GeneratePageDevSpec)가 사용자에게 보고한다.
- 이 스킬에 도달한 시점에 `content`는 항상 존재한다 (web fetch 실패 등은 소스 해석 레이어 [A]가 처리 — design doc(2026-06-01) §4-5).
- 에러 규약은 sibling analyze 스킬(`analyze-figma`)과 동일하다.

## 병렬 실행

입력이 ResolvedSource 단일 객체(+ projectContext)로 독립적이므로, 다른 어댑터(`analyze-figma`)와 **병렬 실행 OK** (design doc(2026-06-01) §3 레이어 [B]).
