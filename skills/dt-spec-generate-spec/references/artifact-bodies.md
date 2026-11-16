# dt-spec 산출물 본문 — [7-4] 본문 채움

> `dt-spec-generate-spec` [7-4](FE 전용). 템플릿 슬롯을 무엇으로 채우는지, layout-skeleton 3-way 분기와 스텁/구조 → 정밀 전환 규칙. 헤더 빌드는 `docs/refs/spec-pipeline.md` §4.

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

**layout-skeleton.md `{{SKELETON_TSX}}`** — 3-way 분기 (dt-spec 설계 §7-2):

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

**스텁/구조 → 정밀 전환 규칙** (dt-spec 설계 §7-2 Important-4):
- 스텁(`<!-- stub -->`) 또는 구조 스켈레톤(`<!-- structural -->`) 파일은 machine-generated 마킹된 상태.
- 이후 재실행에서 layoutTree를 확보하면(Figma 소스 추가), 정밀 스켈레톤으로의 전환은 **diff-then-confirm 예외** — 마킹된 파일은 "사용자 편집 우선" 보호에서 제외하고 confirm 1회 후 통째 교체.
- 단, 사용자가 직접 편집한 흔적(플래그 제거 또는 본문 내용 변경)이 있으면 보호 대상으로 복귀 — 일반 diff-then-confirm 적용.

`detectStyledLibrary`는 `scripts/detectStyledLibrary.mjs`에서 import한다.
