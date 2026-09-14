---
name: dt-spec-ask-missing
user-invocable: false
description: Use when dt-spec needs to fill missing requirements via user askQuestion. Handles (a) conflict/duplicate resolution across sources, (b) AI API candidate review (confirm/edit/remove), (c) ambiguous candidate clarification, (d) missing category checklist (6 items), (c-2) mandatory routing/navigation check (page route + click→navigation + entry points), (e) EARS-formatted questions for method/endpoint/schema, and (f) value/structure validation. Saves answers as raw JSON — no EARS conversion.
---

# AskMissingRequirement

누락된 요구사항 필드를 사용자 askQuestion으로 채우고, AI 추출 후보를 검토받는다.

## 책임 (design doc 5-2, 5-3)

- **소스 충돌·중복후보 해소** — 다중 소스 병합 후 발생한 `_conflicts`/`_possibleDuplicates`를 사용자 askQuestion으로 해소 (design doc 2026-06-01 §5-3)
- 누락 필드 식별
- 사용자 askQuestion (EARS 형식 질문 생성)
- 답변 수집 + 답변 형식 검증 (design doc 5-5 [1]~[3])
- **AI API 후보 검토 흐름** — 후보 confirm/edit/remove + 모호 후보 명확화 + 누락 카테고리 체크리스트

> **경계**: `_conflicts`와 `_possibleDuplicates`의 **탐지**는 이 스킬의 책임이 아니다. 탐지는 generate-spec [3-merge] 단계(다중 소스 병합 레이어)에서 사전 계산되어 입력으로 전달된다. 이 스킬은 오직 **해소(resolution)** — 사용자에게 묻고 결과를 기록 — 만 담당한다.

## 입력

- AnalyzeFigmaFrame 출력 (apiCandidates with confidence)
- figma@wireframe 어댑터(AnalyzeFigmaFrame) 출력 (pageMeta/userStories/scenarios/businessRules/edgeCases)
- **병합 레이어(generate-spec [3-merge]) 출력** — 아래 필드 포함:
  - `_conflicts`: 사전 계산된 충돌 목록 (필드 충돌 또는 자유 텍스트 모순). 없으면 빈 배열 `[]`.
  - `_possibleDuplicates`: 사전 계산된 중복 후보 쌍 목록. 없으면 빈 배열 `[]`.
- 필수 필드 체크리스트 (이 SKILL이 보유)
- projectContext
- API 문서 (옵셔널, 사전 매칭에만 사용)

## 출력 (raw JSON, EARS 변환 X — 단 질문 형식만 EARS 패턴 사용)

```
{
  resolvedRequirements: [{ id, raw: { trigger, condition, response }, sourceCandidate, sourceLabel }],
  resolvedDataSchema: { [endpoint]: { method, requestSchema, responseSchema } },  // GeneratePageDevSpec이 endpoint-key 룩업 시 사용 (자료 중복은 의도적)
  resolvedApiCandidates: [{
    featureName,
    kind,
    sourceUiElement,
    source: 'ai-confirmed' | 'ai-edited' | 'user-added' | 'user-resolved',
    //   source 라벨 정의 (단일 출처: design doc 5-8, 충돌 해소 추가분: design doc 2026-06-01 §5-3):
    //   - 'ai-confirmed'  : AI가 추출한 후보를 사용자가 원본 그대로 승인
    //   - 'ai-edited'     : AI 후보를 기반으로 사용자가 내용을 수정
    //   - 'user-added'    : 사용자가 직접 새로 추가 (체크리스트·기타 입력)
    //   - 'user-resolved' : 다중 소스 충돌/중복 해소 과정에서 사용자가 소스 간 선택 또는
    //                       병합을 결정한 항목. ai-edited와 다름 — AI 추출 내용을 편집한 것이
    //                       아니라 소스 간 불일치를 사용자가 판정한 것이므로 별도 라벨 사용.
    method?, endpoint?, requestSchema?, responseSchema?,
    // Step 5 보강 필드 (각 후보 단위):
    validation?,         // 입력값 검증 규칙 (예: { email: 'RFC 5322', password: 'minLength: 8' })
    errorHandling?,      // 상태별 동작 (예: { 401: 'inline error', 423: 'lockout' })
    successBehavior?,    // 성공 후 동작 (예: { redirect: '/dashboard', toast: '환영합니다' })
    states?              // UI 상태 (예: ['loading', 'error', 'disabled'])
  }],
  // Step 0 해소 결과 — 다음 단계(GeneratePageDevSpec)에서 병합 구조에 재적용됨:
  //   - 해소된 충돌의 선택 값은 resolvedApiCandidates / resolvedRequirements에 source: 'user-resolved'로 반영
  //   - 병합된 중복 후보는 단일 항목으로 통합되며, 실소스 근거가 있는 쪽 provenance가 우선 적용
  //   - 해소 후 _conflicts / _possibleDuplicates 필드는 출력 객체에서 제거됨 (모두 해소되면 기록 불필요)
  status: 'finalized' | 'draft'
}
```

## askQuestion 작성 원칙 (모든 Step의 askQuestion에 공통 적용)

규칙 전문은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`를 Read해 적용한다 (배경/영향/옵션설명 3요소 + 도구 사용 팁).

## 절차 (design doc 6절 [4-2] ~ [6], §5-3)

### Step 0: 소스 충돌·중복후보 해소 (design doc 2026-06-01 §5-3)

> **왜 가장 먼저 해소하는가**: 이후 Step 1~9는 "확정된 단일 요소 집합"을 대상으로 동작한다. 소스 간 충돌이나 중복이 남아 있으면 동일 요소에 대해 서로 다른 값이 FR·design.md에 혼재될 수 있다. Step 0에서 먼저 정리해야 이후 단계의 후보 목록과 요구사항이 일관성을 갖는다.

`_conflicts`와 `_possibleDuplicates`가 모두 빈 배열이면 Step 0을 건너뛰고 Step 1로 진행한다.

---

#### Step 0-A: 필드 충돌 해소 (`_conflicts` — 필드 값 불일치)

같은 요소로 식별되었으나 소스마다 특정 필드 값이 다를 때 발생한다 (예: Figma와 요구사항 문서가 버튼 라벨을 다르게 표기).

충돌 1건당 AskUserQuestion 1개. **왜 묻는지(어느 소스가 충돌했는지), 선택 결과가 어디 반영되는지**를 질문에 명시한다.

AskUserQuestion 예 (`upload_btn` 라벨 충돌):
- `header`: `"소스 충돌"`
- `question`: `"**upload_btn** 버튼의 라벨이 소스마다 다릅니다 — Figma(235:1412): '업로드' / 요구사항 문서(req.md): '제출'. 소스 간 불일치로 requirements.md FR과 design.md 컴포넌트 명세에 어느 값을 쓸지 결정해야 합니다."`
- options:
  - label `"Figma 값 '업로드'"` / description `"디자인 기준. Figma 노드(235:1412)에 표시된 텍스트를 채택 → requirements.md·design.md에 '업로드'로 기록됩니다."`
  - label `"문서 값 '제출'"` / description `"요구사항 기준. req.md에 명시된 텍스트를 채택 → '제출'로 기록됩니다."`
  - label `"직접 입력"` / description `"둘 다 아닌 값. 채택할 라벨을 직접 입력해주세요."`

사용자가 선택한 값을 병합 구조에 적용하고 해당 항목의 `source`를 `'user-resolved'`로 설정한다.

---

#### Step 0-B: 자유 텍스트 모순 해소 (`_conflicts` — 비즈니스 규칙/시나리오 모순)

두 소스의 비즈니스 규칙이나 사용자 시나리오가 서로 논리적으로 모순될 때 발생한다 (예: "비로그인 조회 가능" vs "조회는 로그인 필수").

AskUserQuestion 예:
- `header`: `"규칙 모순"`
- `question`: `"비즈니스 규칙이 서로 모순됩니다 — A: '비로그인 조회 가능'(UX 와이어프레임) / B: '조회는 로그인 필수'(req.md). 두 규칙이 동시에 참일 수 없어 requirements.md에 어떻게 기록할지 결정이 필요합니다."`
- options:
  - label `"A 채택"` / description `"'비로그인 조회 가능' 규칙만 유지. B는 제거됩니다."`
  - label `"B 채택"` / description `"'조회는 로그인 필수' 규칙만 유지. A는 제거됩니다."`
  - label `"둘 다 유지 (별개 규칙)"` / description `"모순이 아닌 별개 시나리오로 판단 — 예: 역할 기반으로 분기. 두 규칙 모두 requirements.md에 기록됩니다."`
  - label `"직접 수정"` / description `"위 셋 다 아님. 올바른 규칙을 직접 입력해주세요."`

결과에 따라 resolvedRequirements를 수정하고, 채택/입력된 항목에 `source: 'user-resolved'`를 부여한다.

---

#### Step 0-C: 중복 후보 해소 (`_possibleDuplicates` — 교차 소스 동일 요소 추정)

서로 다른 소스에서 추출된 후보가 동일한 UI 요소일 가능성이 높은 경우 발생한다 (역할·맥락이 비슷하지만 이름이 다름). 병합 레이어가 사전 탐지하여 쌍(pair)으로 전달한다.

후보 쌍 1개당 AskUserQuestion 1개.

AskUserQuestion 예 (`upload_button` vs `file_add_btn`):
- `header`: `"동일 요소 확인"`
- `question`: `"**'upload_button'**(Figma, nodeId 235:1412)과 **'file_add_btn'**(문서, req.md §3.2)이 같은 버튼인가요? 두 항목의 역할(submit_action)과 맥락이 비슷해 중복 후보로 잡혔습니다. 같다면 하나로 병합해 requirements.md·design.md에서 중복 없이 기록됩니다; 다르다면 각각 별개 요소로 유지됩니다."`
- options:
  - label `"같음 (병합)"` / description `"두 항목을 하나로 합칩니다. 라벨 등 필드가 다르면 Step 0-A(필드 충돌 해소)가 자동으로 이어집니다."`
  - label `"다름 (둘 다 유지)"` / description `"별개 요소로 각각 유지합니다. 이후 각각 독립적인 FR·API 후보로 처리됩니다."`

**"같음(병합)" 선택 시 후처리**:
1. 두 항목을 단일 항목으로 통합한다.
2. **`_inferred` 재평가**: 병합된 항목 중 어느 한 쪽이라도 Figma 또는 문서 원본에서 직접 확인된 provenance(실소스)를 가지고 있다면, `_inferred` 플래그를 제거한다. 이유: 추론(`_inferred`)은 "실소스 증거 없음"을 의미하는데, 병합 상대방에 실소스가 있으면 해당 근거가 함께 적용되므로 추론 표시를 유지할 이유가 없다 (예: 문서에서만 추론된 요소가 Figma 확인 요소와 병합되면 `[inferred]` 라벨 제거).
3. 병합 후 같은 필드의 값이 다르면 Step 0-A 흐름(필드 충돌 해소)을 바로 이어서 실행한다.
4. 최종 병합 항목의 `source`를 `'user-resolved'`로 설정한다.

---

Step 0 완료 후 → Step 1로 진행. 이 시점의 후보 목록과 요구사항은 충돌·중복이 해소된 상태여야 한다.

### Step 1: AI API 후보 검토 — (a) confirm/edit/remove

AnalyzeFigmaFrame이 추출한 각 `apiCandidates` 항목을 사용자가 검토한다. 후보가 4개 이하면 후보당 1개 질문, 많으면 분할하거나 `multiSelect`로 "유지할 후보 선택" 형태 (위 원칙 참조).

후보 1개당 AskUserQuestion 예 (emailLogin):
- `header`: "API 후보 1/3"
- `question`: "디자인의 **login_button**에서 로그인 API 호출 후보(emailLogin)를 발견했습니다 (confidence: confident — 명시적 제출 버튼이라 확신도 높음). 이 후보를 어떻게 처리할까요? 유지하면 requirements.md에 Event-driven FR로, design.md 시퀀스에 추가됩니다."
- options:
  - label `"유지 (keep)"` / description `"이 API가 맞음. → source: ai-confirmed로 FR 생성. 이후 method/endpoint/schema를 묻습니다."`
  - label `"수정 (edit)"` / description `"기능은 맞지만 이름·동작을 고쳐야 함. → source: ai-edited. 수정 내용을 입력받습니다."`
  - label `"제거 (remove)"` / description `"실제 API 호출이 아님(순수 UI 등). → 후보에서 삭제, FR 생성 안 함."`

source 라벨: keep → `ai-confirmed`, edit → `ai-edited`, remove → 삭제.

### Step 2: 모호한 후보 명확화 — (b)

`confidence: 'ambiguous'` 후보 각각에 대해 AskUserQuestion. **모호한 이유(왜 AI가 확신 못 했는지)를 질문에 담아** 사용자가 판단 근거를 알게 한다.

예 (notificationToggle):
- `header`: "모호 후보"
- `question`: "디자인의 **notification_toggle** 요소는 서버 호출 여부가 불분명합니다 (토글 UI는 단순 화면 표시일 수도, 설정 저장일 수도 있어 AI가 확신하지 못함). 실제 동작은 무엇인가요? 선택에 따라 API FR이 생성되거나(저장형) UI-only로 분류됩니다(design.md 컴포넌트에만 반영)."
- options:
  - label `"단순 UI 토글"` / description `"서버 호출 없음, 화면 상태만 변경. → API 후보에서 제거, design.md에 UI 상태로만 기록."`
  - label `"사용자 설정 저장"` / description `"토글 시 서버에 저장(PUT/PATCH). → ai-edited 후보로 유지, 이후 endpoint/schema를 묻습니다."`
  - label `"기타 (직접 입력)"` / description `"위 둘 다 아님. 실제 동작을 직접 설명해주세요."`

답변에 따라:
- 단순 UI 토글 → API 후보에서 삭제 (호출 없음)
- 사용자 설정 저장 → `source: 'ai-edited'`로 유지
- 기타 → `source: 'ai-edited'` (설명 반영)

### Step 3: 누락 카테고리 체크리스트 — (c)

design doc 6절 [4-2] (c) **체크리스트 단일 출처**의 6개 항목을 사용한다. AI는 버튼·폼 같은 명시적 인터랙션만 잡아내므로, "눈에 안 보이는" 호출은 사용자가 직접 짚어야 함을 질문에 설명한다.

AskUserQuestion (`multiSelect: true` — 6개 항목이라 2개 질문으로 분할하거나 multiSelect 사용):
- `header`: "누락 API 점검"
- `question`: "이 페이지(**SCR_FLE_01 파일관리**)에서 버튼·폼 클릭 없이 **자동으로** 호출되는 API가 더 있나요? AI는 명시적 인터랙션만 추출해 아래 같은 호출은 놓칠 수 있습니다. **선택한 항목은 requirements.md에 FR로 추가**되고 이후 endpoint/schema를 묻습니다. (해당 없으면 아무것도 선택하지 않음)"
- options (각 `description`에 의미·예시·결과):
  - label `"페이지 진입 시 자동 호출"` / description `"마운트 시점에 메타데이터·설정·목록을 불러오는 GET. 예: 파일 목록 자동 로딩 → Event-driven FR로 추가됨"`
  - label `"백그라운드 polling"` / description `"주기적으로 서버 상태를 확인. 예: 업로드 진행률·새 알림 폴링 → State-driven FR로 추가됨"`
  - label `"실시간 구독 (WebSocket/SSE)"` / description `"서버 푸시를 구독해 실시간 갱신. 예: 협업 동시편집 → Event-driven FR로 추가됨"`
  - label `"권한/feature flag 체크"` / description `"진입 시 접근 권한·기능 플래그를 확인하는 API. → Optional/State-driven FR로 추가됨"`

> 항목이 4개를 넘으므로 두 번째 질문으로 나머지를 묻는다: `"Analytics 이벤트 전송"`(화면 조회·클릭 로깅 → 보통 FR 아님, design.md 노트), `"기타 (직접 입력)"`(위에 없는 자동 호출 — 직접 설명).

체크된 항목 → `user-added` source로 후보 추가. 이 후보들도 Step 4 (값 채우기) + Step 5 (보강) 흐름에 합류한다.

### Step 3.5: 네비게이션 / 라우트 점검 — (c-2, 필수)

라우팅/네비게이션은 **모든 페이지 스펙의 1급 필수 요소**다. Figma/AI 추출은 "보이는 레이아웃"만 잡고 "누르면 어디로 가는지"는 못 잡으므로(Step 3이 API 호출을 짚게 하듯), 네비게이션도 사용자가 직접 짚어야 한다. **소스에서 네비게이션·라우트를 하나도 못 건졌으면 이 점검을 건너뛰지 않는다**(조용한 누락 금지 — 빈 채로 두면 `status: draft`).

> 이건 다른 스킬(dt-devspec 정의서 등)이나 외부 문서 동봉에 의존하지 않는다. 페이지 내부/간 네비게이션은 **페이지 소유**이므로 dt-spec이 단독으로 항상 질문해 채운다. 슬림한 정의서엔 페이지 내부 인터랙션이 없다(dt-devspec 불변원칙 2).

AskUserQuestion (관련 항목을 한 콜에 묶음):
- `header`: "라우트/네비게이션"
- `question`: "이 페이지(**<page>**)의 라우트와 화면 간 이동을 확인합니다. Figma는 레이아웃만 담아 '무엇을 누르면 어디로 가는지'는 빠질 수 있습니다. **선택/입력한 내용은 requirements.md `## 라우팅/네비게이션`에 기록되고, 클릭→이동 항목은 Event-driven FR로도 추가**됩니다."
- options (각 `description`에 의미·예시·결과):
  - label `"이 페이지의 라우트 경로"` / description `"이 페이지가 매핑되는 URL + params. 메인/진입점 성격이면 '/'. 예: /users/:userId → requirements.md 라우트 항목"`
  - label `"요소 클릭 → 다른 화면 이동"` / description `"카드·아바타·이름 등을 누르면 다른 페이지로 가는 이동. 예: 작성자 영역 클릭 → /users/{id} → Event-driven FR + 라우팅 섹션에 추가"`
  - label `"이 페이지로 들어오는 진입점"` / description `"어느 화면의 무엇을 누르면 이 페이지로 오는지. 아직 모르면 'TODO: 진입점 미정'으로 표기"`
  - label `"뒤로가기/취소 등 이탈 경로"` / description `"← 돌아가기, 닫기 등으로 떠나는 경로(이전 페이지 등) → Event-driven FR로 추가"`

자유 입력(경로 문자열)은 옵션으로 강제하지 말고 형식·예시를 제시한 뒤 텍스트로 받는다. 입력 결과 → 클릭→이동은 `user-added` Event-driven 후보로 Step 4 흐름에 합류, 라우트/진입점은 `{{ROUTING_NAVIGATION}}` 슬롯에 직접 반영.

### Step 4: EARS 형식 askQuestion으로 값 채우기 — design doc 6절 [5]

확정된 각 후보에 대해 EARS 패턴 질문 생성. method/endpoint/schema는 **자유 값 입력**이므로 옵션으로 강제하지 말고 형식·예시를 충분히 제시한 뒤 텍스트 답변을 받는다 (원칙 참조). 입력값은 requirements.md 데이터 명세 + design.md 데이터 모델·시퀀스에 반영된다 — 이 점을 질문에 명시한다.

후보 종류별 질문:
- mutation (Event-driven 후보):
  ```
  "EmailLogin 기능 (login_button 클릭 시 호출)의 API 명세를 입력해주세요.
   → requirements.md FR + design.md 시퀀스/데이터 모델에 반영됩니다.
     WHEN 사용자가 login_button을 클릭하면 THE SYSTEM SHALL ___ 한다.
   - method        (예: POST)
   - endpoint      (예: /api/auth/login)
   - requestSchema (예: { email: string, password: string })
   - responseSchema(예: { token: string, user: { id, email, name } })"
  ```
- list/detail query:
  ```
  "FileList 기능 (페이지 진입 시 목록 표시)의 GET 명세를 입력해주세요.
   → requirements.md 데이터 명세 + design.md 데이터 모델에 반영됩니다.
   - endpoint      (예: /api/files?page=&size=)
   - responseSchema(예: { items: File[], total: number })"
  ```

API 문서가 있으면 (5-4) 매칭되는 후보를 미리 제안:
```
"API 문서에서 'POST /api/auth/login'을 찾았습니다. 이 후보에 적용할까요? (y/n/edit)"
```
**자동 채움 금지** (design doc 결정 7) — 항상 사용자 confirm.

사용자 답변은 raw 객체로 저장:
```
{
  method: 'POST',
  endpoint: '/api/auth/login',
  requestSchema: { email: 'string', password: 'string' },
  responseSchema: { token: 'string', user: { id: 'string', email: 'string', name: 'string' } }
}
```

### Step 5: 나머지 필드 보강 — design doc 6절 [6]

각 후보의 누락 필드를 묻는다. **이 값들이 어디 반영되는지 질문에 명시** — validation/errorHandling은 requirements.md의 Unwanted FR(예외 처리)과 design.md 시퀀스 분기로, successBehavior는 성공 시퀀스로, states는 design.md UI 상태로 들어간다.

- **validation** — 입력값 검증 규칙 (자유 입력). 예: "이메일은 RFC 5322 형식, 비밀번호 최소 8자"
- **errorHandling** — 상태별 동작 (선택형 가능). 예: `question` "EmailLogin 실패 시 시스템 동작은? (requirements.md에 Unwanted FR로 추가)" / options: label `"인라인 에러 메시지"`(description `"401 시 폼 하단에 메시지 표시"`) / label `"계정 잠금 안내"`(description `"423 시 잠금 안내 화면"`) / label `"기타"`
- **에러 상태 문구 출처** — 에러 상태 문구가 애매할 때 묻는다: `question` "이 페이지 에러 상태는 전용 문구가 있나요, 공용 에러 키트 기본을 쓰나요? (문구를 발명하지 않기 위함 — 기본은 키트)" / options: label `"공용 에러 키트 기본 (기본)"`(description `"경계 폴백(RetryErrorFallback 등)의 캐논 문구 사용 → FR은 `role=\"alert\"` 등 시맨틱으로만 기술, 문구는 키트 위임"`) / label `"전용 문구 있음"`(description `"소스에 실제 문구가 있음 → `[전용 문구]` 표시와 함께 기재, 전용 폴백 구현 대상"`). 답이 '전용 문구'가 아니면 문구를 발명하지 않는다.
- **successBehavior** — 성공 후 동작 (자유 입력). 예: "성공 시 /dashboard로 리다이렉트 + '환영합니다' 토스트"
- **states** — UI 상태. 기본값(loading/empty/error/disabled) 사용 가능, 추가 필요 시에만 askQuestion (어떤 상태가 design.md 컴포넌트에 반영되는지 설명)

### Step 6: 값-수준 검증 — design doc 5-5 [2]

각 답변을 검증:
- `endpoint`: URL 형태 (`^/[^\s]+$`)
- `method`: `GET | POST | PUT | DELETE | PATCH` 중 하나
- `requestSchema`, `responseSchema`: JSON 호환 객체
- 위반 → "올바른 형식으로 다시 입력해주세요" + 재질문

### Step 7: 구조-수준 검증 — design doc 5-5 [3]

필드 간 일관성:
- `trigger.target` ∈ AnalyzeFigmaFrame 출력의 `semanticUIElements[].id` (참조 무결성). GeneratePageDevSpec이 spec.yaml로 빌드 시 `uiElements`로 리네이밍 처리.
- `validation` 필드명 ∈ `requestSchema` 키
- 위반 → 사용자 보고 + 수정 옵션. 사용자가 수정 거부 시 해당 후보를 draft 후보로 표시 (Step 8에서 처리).

### Step 7-필수: 필수 필드 누락 재확인 — design doc 5-5 [1]

각 `resolvedApiCandidates` 항목에 대해 필수 필드 누락 체크:
- `method`, `endpoint`, `requestSchema`, `responseSchema` (Step 4에서 채움)
- `validation`, `errorHandling`, `successBehavior` (Step 5에서 채움 — `states`는 옵셔널)

누락 발견 시 → Step 5로 복귀해서 보강 askQuestion 재실행. 사용자가 보강 거부 시 해당 후보는 draft.

### Step 8: 상태 결정

- 모든 필수 필드 채워짐 + Step 6/7/7-필수 검증 통과 → `status: finalized`.
- 사용자가 askQuestion 중간 중단 → `status: draft`로 부분 저장.
- 일부 후보가 검증/필수 필드 미충족 + 사용자가 수정 거부 → `status: draft` (어떤 후보가 미충족인지 메타 노트).

### Step 9: 반환

위 구조의 raw 객체 반환.

## 단일 출처 참조

- **체크리스트 단일 출처**: design doc 6절 [4-2] (c) (6개 항목)
- **라벨 정의 단일 출처**: design doc 5-8 + design doc 2026-06-01 §5-3
  - `ai-confirmed` : AI 후보를 사용자가 원본 그대로 승인
  - `ai-edited`    : AI 후보를 사용자가 수정
  - `user-added`   : 사용자가 직접 추가 (체크리스트·기타 입력)
  - `user-resolved`: 소스 간 충돌/중복 해소에서 사용자가 선택·병합·판정한 항목 (Step 0 전용)
- **충돌·중복 해소 단일 출처**: design doc 2026-06-01 §5-3 (탐지는 generate-spec [3-merge], 해소는 이 스킬)
