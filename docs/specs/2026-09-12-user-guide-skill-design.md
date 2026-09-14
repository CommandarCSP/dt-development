# 사용자 가이드 PDF 생성 스킬(`/dt-guide`) 설계 문서

- 작성일: 2026-09-12
- 상태: 구현 완료(계획 A·B) — 수용 §11-2 실행 기록은 계획 B Task B6
- 범위: 웹 프런트(React/Next) + Electron 데스크톱 프로젝트를 분석해 **사외 배포용 한글 사용자 가이드 PDF**를 프로젝트 레포 안에 만든다. 분석(4단계 역추출) · 캡처 · 집필+리뷰 · 조판/PDF/게이트 네 단계.
- 대상 플러그인: `dt-development` (`plugin/`)
- 선행: `2026-09-12-ko-writing-discipline-design.md`(한글 규율 — 이 스킬은 그 `ko-writing-reviewer`를 `docType: 'guide'`로 쓴다).

## 1. 목적

제품을 처음 보는 일반 사용자가 읽는 가이드를, 사람이 처음부터 쓰지 않고 **프로젝트를 분석해 초안을 만들고 → 부족한 것만 사람에게 묻고 → 화면을 찍고 → 한글 리뷰를 거쳐 → PDF로 조판**하는 한 명령으로 만든다. 참조 구현은 이 중 조판·게이트만 스크립트로 하고 집필은 사람이 했다. 이 스킬은 앞단(분석·집필)까지 덮고, 조판 엔진은 그 참조 구현을 일반화해 플러그인에 둔다.

## 2. 결정 사항 (브레인스토밍 2026-09-12)

| # | 결정 | 근거 / 탈락한 대안 |
|---|---|---|
| **D1** | **1차 대상은 웹 프런트 + Electron 둘 다** | 사용자 확정. 범위는 커지지만 타입 분기 구조(스택 감지·캡처 드라이버)가 첫 판에서 검증된다. BE API 가이드는 비목표 |
| **D2** | **역추출은 4단계** — ① 기술 스택 → ② 프로젝트 문서 → ③ 소스코드·주석·**테스트** → ④ 애매한 것만 질문해 확정 | 사용자 제안. 문서를 코드보다 먼저 읽어야 코드 읽기가 검증·보충으로 좁혀진다. 질문은 마지막에 갭·충돌만 — 사용자를 덜 괴롭힌다. 테스트(유닛·통합·E2E)는 "이 기능은 이렇게 동작해야 한다"의 목록이라 누락 잡기에 가장 좋은 소스(사용자 요구) |
| **D3** | **인벤토리 항목은 시나리오 + 화면 두 층** | 탈락 ① 화면만: 가이드가 화면 설명서가 되어 "그래서 뭘 어떻게 하나"가 약해진다. 탈락 ② 시나리오만: 코드에서 직접 안 뽑혀 문서 없는 프로젝트에서 막힌다. 두 층이면 문서(스토리)와 코드(라우트)가 각각 한 층에 맞고, 가이드가 「기본 사용 흐름」+「화면 안내」 두 절을 가진다 |
| **D4** | **네 단계가 하나의 산출물 `inventory.md`를 채우고 라벨을 붙인다** — `stack` / `doc:<path>` / `code:<file:line>` / `test:<file>` / `user-confirmed` / `assumed:<사유>`(무인 실행 기본값) | dt-spec의 출처 라벨·dt-explain의 근거 라벨과 같은 방식. 파일로 남겨 재실행 때 diff만 보고, 사람이 고칠 수 있고, 게이트 G2의 왼쪽 항이 된다 |
| **D5** | **캡처 상태는 레시피 파일(`capture.config.mjs`)을 스캐폴딩하고 사용자가 채운다** | 탈락 ① dt E2E 원장 재사용: E2E 없는 프로젝트에서 방법이 없다. 탈락 ② 공개 화면만 자동: 자동화 가치가 작고 그림이 조용히 낡는다. 레시피는 커밋되어 다음 판에서 재사용(참조 구현의 `manual-shots.spec`과 같은 역할) |
| **D6** | **화면 목록 뽑기(표면 인벤토리)는 공유 스크립트** `scripts/surfaceInventory.mjs` — 가이드 스킬 3단계와 `auditor`(dt-audit)가 같이 쓴다 | 겹치는 것은 이 한 조각뿐(라우트/창 → 화면 목록). 지금 auditor에는 프롬프트 문장으로만 있어 결과가 매번 다를 수 있다. 탈락 ① auditor를 dispatch해 결과 재사용: auditor는 스펙 없으면 거의 안 돌고 판정 기구가 무겁다, Electron 없음. 탈락 ② 독립 구현: 같은 로직 두 곳 |
| **D7** | **엔진은 플러그인, 프로젝트에는 내용만** | 탈락 ① 참조 구현식 스캐폴딩: 버그 수정이 프로젝트별로 흩어지고 버전이 갈린다. 탈락 ② 별도 npm 패키지: 배포·사내 레지스트리 문제. 프로젝트에는 `docs/guide/*` 내용만 |
| **D8** | **PDF는 레포 안 `docs/guide/<제품명>-User-Guide.pdf`에 내고 git에 커밋한다** | 사용자 요구("레포 내부에 가이드가 떨어져서 바로 보거나 이후 업로드"). `release/`는 보통 gitignore라 레포에서 안 보인다. 파일명은 버전 없는 ASCII(참조 구현 D4 승계 — `releases/latest/download/…` 고정 링크, 한글·공백 파일명 사고 회피) |
| **D9** | **4단계에 「준비물 체크리스트」를 고정으로 둔다** — 코드·문서에 없는데 가이드에 보통 들어가는 것을 한 번에 묻는다 | 사용자 요구. 항목은 §5-4 표. 코드·문서에서 찾은 것은 채우고 못 찾은 것만 묶어 한 번 묻는다 |
| **D10** | **캡처 모드는 화면별 `auto` / `manual` / `none`** — 서드파티 로그인·외부 리다이렉트처럼 못 찍는 화면은 사용자에게 받거나(manual) 글로만 안내(none) | 사용자 요구. analyze가 OAuth·외부 URL을 감지하면 후보로 표시하고 4단계에서 확정. 가이드 본문에는 그림 대신 안내 문장이 들어간다 |
| **D11** | **사람 체크포인트는 두 개** — 인벤토리 승인, 초안 승인 | 인벤토리가 틀리면 그 뒤가 전부 헛일이고 초안은 사람이 읽어야 한다. 캡처·빌드는 기계 일이라 멈추지 않는다 |
| **D12** | **무거운 분석·집필은 격리 워커, 질문은 조율자** — `guide-analyst`·`guide-author` 에이전트 신설 | `orchestration-policy.md` 원칙 2·3. 워커는 `needsDecision`으로 올리고 조율자가 `askquestion-principle.md` 형식으로 묻는다(dt-spec과 같은 계약) |
| **D13** | **범용성 원칙 — 스크립트는 힌트, 판단은 스킬 지침을 따르는 AI. 특정 프로젝트에 의존하지 않는다** | 사용자 강조(2026-09-12: "내부에 어떤 라우팅을 사용했는지 알 수가 없고 그때마다 AI가 스킬의 지침에 따라 판단해야 한다… [참조 구현] 같은 특정 프로젝트가 예시는 될 수 있어도 거기에만 의존해서는 안 됨"). 웹·Electron이라는 타입은 알아도 프로젝트마다 라우팅·화면 전환·인증·기동 방식이 다르다. 그래서 (a) `surfaceInventory.mjs`는 아는 패턴만 결정적으로 뽑고 모르면 `router: unknown` + `hints`로 **모른다고 말한다**, (b) 스킬 3단계 지침은 스크립트 결과를 출발점으로만 쓰고 **AI가 진입 파일부터 import를 따라가 화면 전환 방식을 직접 찾아** `stack.router: custom — <설명>`으로 기록하게 한다, (c) 스크립트 결과가 있어도 빠진 화면이 없는지 AI가 코드로 검증한다, (d) 참조 구현·sample-app은 예시·실측 대상일 뿐 수용 기준의 정의가 아니며 픽스처에 미지원 패턴(vue-router) 케이스를 둔다. 새 패턴을 만나 감지기를 더하는 것은 후속 개선이고, 감지기가 없어도 스킬은 완결 동작해야 한다(`skill-sdd-layering.md` 원칙 1과 같은 태도) |

## 3. 산출물

| 경로 | 내용 | 신규/수정 |
|---|---|---|
| `skills/dt-guide/SKILL.md` | 조율자 스킬 — 4단계 흐름, 체크포인트, 폴백 | 신규 |
| `skills/dt-guide/references/guide-outline.md` | 가이드 절 템플릿(§6-1)과 절별 채우는 규칙 | 신규 |
| `skills/dt-guide/references/inventory-schema.md` | `inventory.md` 스키마(§5-2)·라벨·publish 규칙 | 신규 |
| `skills/dt-guide/references/prep-checklist.md` | 준비물 체크리스트(§5-4) — 어디서 찾고 못 찾으면 무엇을 묻는지 | 신규 |
| `commands/dt-guide.md` | `/dt-guide [analyze|capture|write|build]` | 신규 |
| `agents/guide-analyst.md` | 1~3단계 격리 워커 → `{ inventory, needsDecision[], summary }` | 신규 |
| `agents/guide-author.md` | 집필 워커 → `{ draft, coverage, summary }` | 신규 |
| `scripts/surfaceInventory.mjs` + `tests/surfaceInventory.test.mjs` | 웹·Electron 화면 목록 결정적 추출(공유) | 신규 |
| `scripts/guide/gate.mjs` · `assemble.mjs` · `build.mjs` · `capture.mjs` + 테스트 | 조판·PDF·게이트·캡처 엔진(참조 구현 이식·일반화) | 신규 |
| `templates/guide-theme.html` | 참조 구현의 `theme.html` 이식(A4 인쇄 CSS) | 신규 |
| `templates/guide.md.tmpl` · `inventory.md.tmpl` · `capture.config.mjs.tmpl` · `dt-guide.json.tmpl` | 프로젝트에 스캐폴딩되는 파일 원형 | 신규 |
| `agents/auditor.md` §2 fe | "라우트 정의→페이지 목록"을 `surfaceInventory.mjs` 호출로 바꿈(한 줄) | 수정 |
| `README.md` · `.claude-plugin/plugin.json` | 스킬·커맨드·에이전트 등록, 버전 | 수정 |

대상 프로젝트에 생기는 것(§8).

## 4. 명령과 흐름 — `/dt-guide`

```
/dt-guide              analyze → [체크포인트 1: 인벤토리 승인] → capture → write → [체크포인트 2: 초안 승인] → build
/dt-guide analyze      1~4단계만 (인벤토리 갱신)
/dt-guide capture      캡처만 (화면이 바뀌었을 때)
/dt-guide write        집필+리뷰만
/dt-guide build        조판·PDF·게이트만 (문장만 고쳤을 때)
```

- 인자 없이 부르면 처음부터 끝까지. 각 단계는 앞 단계 산출 파일이 있으면 그것을 읽는다(파일 우선, 대화 기억 아님).
- **dispatched(기본)**: 조율자는 `.dt-guide.json` 로드·타입 확정·체크포인트·질문만 직접 하고, 분석은 `guide-analyst`, 집필은 `guide-author`에 `Task`로 맡긴다. 캡처·빌드는 스크립트 실행.
- **inline degrade(원칙 4)**: 서브에이전트가 없으면 조율자가 같은 절차를 직접 수행하고 한 줄 고지.
- 재실행: `inventory.md`가 있으면 analyze는 **diff 모드** — 새로 발견된 항목만 `needsDecision`, 사용자가 손으로 고친 항목(`user-confirmed`)은 덮어쓰지 않는다(diff-then-confirm — dt-spec 5-7과 같은 정책).

## 5. analyze — 4단계 역추출 → `docs/guide/inventory.md`

### 5-1. 단계

| 단계 | 읽는 것 | 인벤토리에 넣는 것 | 라벨 |
|---|---|---|---|
| **1 기술 스택** | `package.json`(deps·scripts·engines), `electron/`·`electron-builder` 설정, 라우터 라이브러리, UI 라이브러리, 인증 라이브러리·OAuth 설정, 빌드 도구 | `type: web|electron`, `router`, `ui`, `auth`(프로바이더 목록), 캡처 드라이버·설치할 패키지, 앱 기동 명령 | `stack` |
| **2 프로젝트 문서** | `README*`, `CHANGELOG*`, `docs/**/*.md`(dt 스펙 `docs/specs/pages/*/requirements.md`·`design.md`·E2E 원장 포함), 기존 가이드(`docs/guide/`, `*.pdf`는 제외), `PRODUCT.md`류 | 시나리오 후보(사용자 스토리·"사용법"), 화면 후보, 목적 문장, 제약·알려진 문제, 설치·요구사항, 데이터 저장·전송 고지 | `doc:<path>#<heading>` |
| **3 소스코드·주석·테스트** | (a) `surfaceInventory.mjs` → 화면 목록(§5-3). (b) 화면별 컴포넌트·페이지 파일의 **파일 머리 주석·JSDoc·주요 핸들러**, 메뉴 정의(Electron `Menu`), IPC 채널(`ipcMain.handle`), 설정 스키마, 라우트 가드(인증 필요 여부), 외부 리다이렉트(OAuth). (c) **테스트**: `*.test.*`·`*.spec.*`·`tests/**`·`e2e/**`의 `describe`/`it`/`test` 이름과 Given-When-Then 주석 | 문서에 없는 화면·기능 추가, 문서와 다른 동작 표시(`conflict`), 화면↔기능 연결, 화면의 `route`·`entry`(어디서 진입)·`auth`·`capture.needs`·`capture.mode` 후보, 테스트 이름에서 나온 기능 후보 | `code:<file:line>` / `test:<file>` |
| **4 질문·확정** | 인벤토리의 갭·충돌 + 준비물 체크리스트(§5-4)의 빈칸 | 확정값 | `user-confirmed` |

3단계의 **세 소스(문서·코드·테스트) 중 한 곳에만 있는 항목**은 자동으로 4단계 질문 후보가 된다.

4단계에서 **묻는 종류**(이 외는 묻지 않는다):
1. 코드에 있는데 문서·테스트에 없는 화면·기능 → 가이드에 넣을까 / 숨길까(`publish`)
2. 문서와 코드가 다른 것 → 어느 쪽이 맞나
3. 목적을 못 알아낸 화면 → 한 줄 목적
4. 사외 공개 여부가 애매한 것(관리자 전용·실험 기능·내부 도구) → `publish`
5. 캡처 모드 후보가 `manual|none`인 화면(OAuth·외부 리다이렉트·결제) → 확정
6. 준비물 체크리스트(§5-4) 빈칸 — **한 질문으로 묶어** 묻는다

질문 형식은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`(왜 묻는지·어디에 반영되는지·옵션 설명). 워커는 `needsDecision`으로 올리고 조율자가 묻는다(D12).

### 5-2. `inventory.md` 스키마

front matter YAML + 사람용 본문(표). 기계는 front matter만 읽는다.

```yaml
---
version: 0.3.3                 # 마지막 analyze 시점의 프로젝트 version
analyzedAt: 2026-09-12
type: electron                 # web | electron
product: Acme Notes
stack:
  router: hash                 # web: react-router | next-app | next-pages · electron: hash | window
  ui: tailwind
  auth: [claude-code-oauth]    # 프로바이더 — capture.mode 후보 근거
  captureDriver: playwright-electron   # playwright-chromium | playwright-electron
  startCommand: "pnpm start"
scenarios:
  - id: S1
    title: 문서 넣고 질문하기
    steps: [SCR-workbench, SCR-chat]
    source: [doc:README.md#사용법, test:tests/e2e/smoke.spec.ts, user-confirmed]
screens:
  - id: SCR-workbench
    title: 작업 화면
    purpose: 왼쪽은 문서와 위키, 오른쪽은 질문하는 대화창
    route: "/"                             # web: URL 경로 · electron: 해시 라우트 또는 window 이름
    entry: [앱 시작, SCR-project-list에서 프로젝트 선택]
    features: [문서 드롭, 위키 탭, 대화]
    auth: none                             # none | login | admin
    capture: { mode: auto, needs: [project-created], selector: main }
    publish: true
    source: [code:renderer/src/pages/Workbench.tsx:12, doc:docs/사용법.md#작업화면]
  - id: SCR-login-oauth
    title: Claude 계정 로그인
    purpose: 외부 브라우저에서 Claude 계정으로 로그인
    route: external
    capture: { mode: none, reason: 서드파티 OAuth 화면 }
    publish: true
    source: [code:electron/auth.ts:40, user-confirmed]
prep:                                      # §5-4 준비물 — 채워진 값 또는 null
  audience: 처음 쓰는 일반 사용자
  systemRequirements: "macOS (Apple Silicon) · Windows (x64)"
  accountProvisioning: null
  thirdPartyPrereqs: [Claude 계정]
  pricingNotice: "언어모델 호출에 각 서비스 요금이 발생"
  dataNotice: "질문·답변 본문을 포함한 실행 기록을 배포자 서버로 전송"
  supportChannel: null
  knownLimitations: [...]
  branding: { productName: Acme Notes, logo: null }
  distribution: [github-release, confluence]
---
```

규칙:
- `id`는 안정 키(`S<n>`, `SCR-<slug>`). 재실행 때 같은 화면은 같은 id를 유지한다(route 기준 매칭).
- `publish: false` 항목은 가이드·게이트 대상이 아니다(인벤토리에는 남겨 다음 판에 다시 묻지 않는다).
- `source`에 `user-confirmed`가 있는 필드는 재실행이 덮어쓰지 않는다.
- `assumed:<사유>` — 사용자가 답할 수 없는 상황(무인 실행)에서 조율자가 **기본값으로 답한** 항목. `user-confirmed`와 달리 재실행 때 `needsDecision`으로 **다시 올라오고** 덮어쓸 수 있다. 조율자는 실행 끝에 `assumed` 항목을 표로 모아 보인다("가정 목록 — 바꿀 것만 말해 달라").
- `capture.mode`: `auto`(엔진이 찍음) / `manual`(사용자가 `docs/guide/shots/manual/<SCR-id>.png`를 둠 — G3가 파일을 요구) / `none`(그림 없음 — 본문에 안내 문장, G3 면제, `reason` 필수).

### 5-3. `scripts/surfaceInventory.mjs` (공유 — auditor도 사용) — **힌트 스크립트**

결정적 정적 스캔. LLM 판단 없음. **정답이 아니라 출발점이다(D13).**

```
export function surfaceInventory({ projectRoot, type?: 'web'|'electron' }): {
  type, router: 'react-router'|'next-app'|'next-pages'|'none'|'unknown',
  confidence: 'detected'|'fallback',      // detected = 아는 라우터 패턴에서 뽑음 · fallback = *Page|*View 컴포넌트 이름 추정
  hints: string[],                        // package.json 에서 본 라우터·프레임워크 후보(vue-router, @tanstack/react-router, svelte, @remix-run/*, @angular/router …) — AI 가 무엇을 찾아야 하는지
  screens: Array<{ route: string, file: string, line: number, kind: 'route'|'window'|'menu'|'view', authHint?: 'guard'|'unknown' }>,
  ipcChannels?: string[],        // electron
  externalRedirects: Array<{ file, line, match }>   // OAuth·외부 URL — capture.mode 후보 근거
}
```
`guide-analyst`의 3단계 지침(§9)은 이 결과를 이렇게 다룬다:
- `confidence: detected` → 화면 목록을 출발점으로 쓰되, **진입 파일(`main.tsx`·`App.tsx`·`electron/main.ts` 등)에서 import를 따라가 빠진 화면(모달·드로어·조건부 뷰·하위 라우트)이 없는지 확인**하고 있으면 `code:` 라벨로 추가한다.
- `router: unknown|none` 또는 화면 0개 → `hints`를 단서로 **AI가 화면 전환 방식을 직접 찾는다**(라우터 정의 파일, 상태 기반 뷰 전환, 탭·모달 레지스트리 등). 찾은 방식은 `stack.router: custom — <한 줄 설명>`으로 기록하고 화면마다 `code:` 라벨을 남긴다. 못 찾으면 `needsDecision`("이 앱의 화면은 어떻게 나뉘나")으로 올린다 — **스크립트가 모른다고 멈추지 않는다.**
- 어느 경우든 화면의 `purpose`·`entry`·`features`는 스크립트가 아니라 AI가 문서·주석·테스트에서 읽어 채운다.

지원 감지(현재 — 확장 가능, 감지기가 없어도 스킬은 완결 동작):
- **react-router**: `createBrowserRouter([...])`·`createHashRouter`·`<Route path=…>` — 정규식+간단 AST 없이 문자열 스캔(경로 리터럴만; 동적 세그먼트는 `:id` 그대로).
- **Next app dir**: `app/**/page.(tsx|jsx|ts|js)` → 디렉터리 경로. **Next pages dir**: `pages/**/*.(tsx|jsx)`(`_app`·`_document`·`api/` 제외).
- **Electron**: `new BrowserWindow(` 위치, `ipcMain.handle('<채널>'`, `Menu.buildFromTemplate` 항목 `label`, 렌더러 해시 라우트(react-router 감지 재사용).
- **authHint**: 파일에 `RequireAuth`·`ProtectedRoute`·`useSession`·`getServerSession`·`redirect('/login')` 류가 있으면 `guard`.
- **externalRedirects**: `window.open(`·`shell.openExternal(`·`signIn(`·`https://accounts.`·`oauth` 문자열이 있는 파일:라인.
CLI: `node scripts/surfaceInventory.mjs <projectRoot> [--json]`.
`agents/auditor.md` §2 fe의 "라우트 정의→페이지 목록"을 이 스크립트 호출로 바꾼다(다른 절차는 그대로).

### 5-4. 준비물 체크리스트 (D9) — `references/prep-checklist.md`

| 항목 | 코드·문서에서 찾는 곳 | 못 찾으면 묻는 것 | 가이드의 어느 절 |
|---|---|---|---|
| 대상 독자·전제 지식 | README 대상 절 | 처음 쓰는 일반 사용자인가, 운영자인가 | 1 |
| 시스템 요구사항 | `package.json engines`, electron-builder 타깃, `browserslist` | 지원 OS·브라우저·최소 버전 | 2 |
| 설치·접근 방법 | 배포 문서, 릴리스 URL, 앱 URL | 어디서 받거나 어디로 접속하나 | 2 |
| 계정·권한 발급 | 인증 코드, 초대·가입 화면 | 누가 계정을 만들어 주나, 초대 흐름 | 3 |
| 서드파티 준비물 | OAuth 프로바이더, API 키 env(`.env.example`) | 사용자가 미리 가입·발급해야 하는 것 | 3 |
| 요금·이용 조건 | — | 유료 호출·쿼터가 있으면 고지 문구 | 3 |
| 데이터 저장·전송 고지 | 저장 경로 코드, 텔레메트리·로그 전송 코드 | 어디에 저장되고 무엇이 전송되는지 — **있으면 빼지 않는다** | 7 |
| 문의·지원 채널 | README, `package.json bugs`, 사내 문서 | 이메일·채널·운영 시간 | 9 |
| 알려진 제한·문제 | CHANGELOG, 이슈 트래커 언급, 코드 `TODO`/`FIXME` | 이번 판에서 못 하는 것 | 8·9 |
| 브랜딩 | 로고 파일(`public/`·`build/icon`), 제품명 | 표지 제품명·로고 사용 여부 | 표지 |
| 배포 채널 | 배포 문서 | PDF를 어디에 올릴지(릴리스·Confluence·앱 내) — `.dt-guide.json distribution` | — |

이 표가 성장형 SOT다. 새 프로젝트에서 반복해 묻게 되는 항목이 나오면 행을 더한다.

## 6. capture — `docs/guide/capture.config.mjs`

### 6-1. 레시피 파일 (스캐폴딩 → 사용자가 채움)

```js
// docs/guide/capture.config.mjs — /dt-guide 가 스캐폴딩. 상태 준비 함수를 채우면 다음 판부터 그대로 다시 찍힌다.
export default {
  start: { command: 'pnpm start', url: 'http://localhost:5173', readySelector: '#root' },   // electron: { command, mainEntry }
  viewport: { width: 1440, height: 900 },
  // 상태 준비 — inventory.screens[].capture.needs 의 각 이름에 대응. 코드 분석으로 채울 수 있는 것은 채워져 있고,
  // 나머지는 TODO 다(비워 두면 그 needs 를 요구하는 화면은 skipped 로 보고된다).
  states: {
    'project-created': async ({ page }) => { /* TODO: 프로젝트 하나를 만든다 */ },
    'logged-in': async ({ page, env }) => { /* TODO: env.GUIDE_TEST_USER / GUIDE_TEST_PASS 로 로그인 */ },
  },
  // 화면별 오버라이드(선택) — 인벤토리 selector·mode 를 여기서 바꿀 수 있다.
  screens: {
    'SCR-chat': { beforeShot: async ({ page }) => { /* 예: 질문 하나 입력 */ } },
  },
};
```

- 스캐폴딩 규칙: 인벤토리의 `capture.needs` 합집합으로 `states` 키를 만들고, 코드에서 알 수 있는 것(로그인 폼 셀렉터, 생성 버튼 텍스트 — 3단계에서 수집)은 채운다. 못 채운 것은 `TODO` + 4단계 질문("`logged-in` 상태를 만들려면 어떤 계정·절차가 필요한가"). 기존 레시피가 있으면 재생성하지 않고 빠진 `states` 키만 `TODO` 로 삽입한다(그 밖은 바이트 그대로) — 사용자 코드를 잃지 않는다.
- 계정·비밀번호는 파일에 넣지 않는다 — `env.GUIDE_TEST_*`로 받고 `.env.example`에 키 이름만 추가한다.
- `mode: manual` 화면의 그림(`docs/guide/shots/manual/<SCR-id>.png`)이 무인 실행에서 없으면 그 화면의 `capture.mode`를 이번 판만 `none`(reason "사람이 찍은 그림이 없어 글로만 안내 — 그림이 준비되면 manual로 되돌린다")으로 바꾸고 `assumed`를 붙여 가정 목록에 올린다 — 사람이 그림을 둘 때까지 빌드가 멈추지 않는다.

### 6-2. 엔진 `scripts/guide/capture.mjs`

- 대상 프로젝트에 `@playwright/test`가 없으면 **사용자 확인 후** `devDependencies`에 추가·설치한다(web: chromium 브라우저 설치 포함, electron: 브라우저 설치 불필요). 확인 없이 설치하지 않는다.
- **격리 강제**: web은 새 브라우저 컨텍스트(저장된 세션 없음), electron은 임시 `userData`(`--user-data-dir=<tmp>`) + `ELECTRON_RUN_AS_NODE` 제거(참조 구현의 `tests/e2e/README.md`의 함정). 개발자 실계정이 공개 PDF에 찍힌 사고를 기본값으로 막는다.
- 화면별: `states`를 `needs` 순서로 실행 → `route`로 이동(electron은 해시/IPC) → `readySelector`·`selector` 대기 → `beforeShot` → 스크린샷 `docs/guide/shots/<SCR-id>.png`.
- `mode: manual|none`은 건너뛴다. 실패한 화면은 그 화면만 `skipped`로 표에 남기고 계속한다. 결과 표 `[SCR-id | mode | 결과 | 사유]`를 조율자가 보인다.
- 산출 `docs/guide/shots/capture-receipt.json`(찍은 시각·version·화면 목록) — G4 판단 근거.

## 7. write — `docs/guide/guide.md` 초안 + 한글 리뷰 1회

### 7-1. 절 템플릿 (`references/guide-outline.md`) — 참조 구현 10절 일반화

| 절 | 채우는 재료 | 없으면 |
|---|---|---|
| 표지 | product·version·systemRequirements·대표 화면 1장 | — |
| 1. 무엇을 하는 도구인가 / 이럴 때 씁니다 | README 목적, `prep.audience`, 시나리오 제목들 | 필수 |
| 2. 설치 · 접근 | `prep.systemRequirements`·설치 방법(electron: dmg/exe, web: URL) | 웹 서비스는 "접근" 한 줄로 |
| 3. 처음 설정 | 계정·서드파티 준비물·요금 고지 | 준비물이 없으면 절 삭제 |
| 4. 기본 사용 흐름 | `scenarios` 순서대로, 단계마다 화면 1장 | 필수 |
| 5. 화면 안내 | `screens`(publish) 각각: 목적·주요 기능·그림 1장(같은 그림은 4절과 중복 사용 안 함 — 참조 구현 규칙) | 필수 |
| 6. 알아두면 편한 기능 | 시나리오에 안 들어간 features | 없으면 삭제 |
| 7. 데이터는 어디에 저장되나 (+ 전송 고지) | `prep.dataNotice` | **고지가 있으면 절대 삭제 금지** |
| 8. 알아두어야 할 제약 | `prep.knownLimitations` | 없으면 삭제 |
| 9. 문제가 생기면 | 알려진 문제 + `prep.supportChannel` | 지원 채널 없으면 질문 |
| 10. 이 버전에서 새로워진 점 | CHANGELOG 이번 버전 항목 | CHANGELOG 없으면 삭제 |

`mode: none` 화면은 그림 자리에 안내 문장("여기서 OO 계정 로그인 화면이 열립니다. 로그인하면 자동으로 돌아옵니다.")을 넣는다. `mode: manual`은 `shots/manual/<SCR-id>.png`를 참조한다.

### 7-2. front matter — 참조 구현 계약 승계, 왼쪽 항만 교체

```yaml
---
version: 0.3.3
manualShotsReviewedAt: 0.3.3
covers:                          # 인벤토리 id 를 가리킨다 (참조 구현은 CHANGELOG 제목이었음)
  - item: S1
    section: 기본 사용 흐름
  - item: SCR-workbench
    shot: shots/SCR-workbench.png
  - item: SCR-login-oauth
    shot: none                   # mode none — G3 면제
  - item: SCR-admin-tools
    guide: n/a
    why: 관리자 전용 (publish false)
changelogCovers: [...]           # CHANGELOG 가 있을 때만 — 이번 버전 굵은 제목 (참조 구현 G2 그대로)
---
```

### 7-3. 집필·리뷰

- `guide-author` 워커가 인벤토리·캡처 결과·`.dt-guide.json`을 읽고 §7-1 템플릿으로 초안을 쓴다. 문체는 `readable-writing.md` B1 「사외 사용자 가이드」 행(정중체·쉬운 말·2인칭 회피·개발 용어 첫 등장 풀이·사내 표지 금지).
- 초안 완성 후 조율자가 `ko-writing-reviewer`에 `{ path: docs/guide/guide.md, docType: 'guide' }`로 **1회** 리뷰 → `after`를 끼움 → before→after 표 + 초안 전체를 사용자에게 → **체크포인트 2 승인**. 재리뷰 없음.

## 8. build — 엔진은 플러그인, 게이트 먼저

### 8-1. 대상 프로젝트에 남는 것

```
.dt-guide.json                        { product, language: "ko", pdfName: "AcmeNotes-User-Guide.pdf",
                                        forbiddenMarkers: [...], type?: "web"|"electron", distribution: [...] }
docs/guide/inventory.md               analyze 산출
docs/guide/capture.config.mjs         캡처 레시피
docs/guide/guide.md                   본문
docs/guide/shots/*.png                자동 캡처 · shots/manual/*.png 수동
docs/guide/shots/capture-receipt.json
docs/guide/<Product>-User-Guide.pdf   산출 (git 커밋 — D8)
docs/guide/guide-receipt.json         빌드 영수증
docs/guide/guide.html                 중간 산출 (gitignore — 커밋하지 않는다)
docs/guide/theme.override.html        (선택) 테마 덮어쓰기
```
`package.json`에는 스크립트를 넣지 않는다 — 빌드는 `/dt-guide build`(플러그인 경로 의존). D7의 '스크립트 한 줄'은 이 판에서 뺀다.

### 8-2. 엔진 `scripts/guide/{gate,assemble,build}.mjs` — 참조 구현의 `src/guide/*` 이식

- **순수 함수 + I/O 분리** 유지: `gate.mjs`(G1~G5 판정, fs 모름), `assemble.mjs`(마크다운+테마 → 단일 HTML, 이미지·글꼴 data URI), `build.mjs`(CLI — 게이트 → 조립 → Playwright PDF → 영수증). 영수증에는 `pdf`(PDF 를 실제로 만들었는지 — `--no-pdf` 영수증은 배포 검사에서 거부)를 함께 적는다.
- **함정 4개 승계**(주석으로 남긴다): ① `document.fonts.ready` 대기(안 하면 조용히 폴백 글꼴) ② `setContent`(file:// 아님) ③ `{{CONTENT}}` 마지막 치환 ④ 게이트를 조립보다 먼저.
- 글꼴: Pretendard woff2를 **플러그인에 동봉**(`templates/fonts/`) — 대상 프로젝트에 설치 요구하지 않는다.
- PDF: A4, 여백 18/16mm, 푸터 `product version` + 쪽번호. 테마는 `templates/guide-theme.html`, `docs/guide/theme.override.html`이 있으면 그것.

### 8-3. 게이트

| | 검사 | 왼쪽 항 | 실패 메시지가 짚는 것 |
|---|---|---|---|
| G1 | `guide.md version` = 프로젝트 `package.json version` | package.json | 두 값 |
| G2 | `covers` ↔ 인벤토리 `publish: true` 항목 **양방향** (+ CHANGELOG가 있으면 `changelogCovers` ↔ 이번 버전 굵은 제목 — 참조 구현 G2) | inventory.md · CHANGELOG | 누락 id / 인벤토리에 없는 id / `n/a`인데 `why` 없음 |
| G3 | 화면 항목: `mode auto|manual` → shot 파일 실존, `mode none` → 면제 | shots/ | 파일 경로 |
| G4 | MINOR 오르면 `manualShotsReviewedAt` 갱신 요구(재촬영은 강제 안 함 — 참조 구현 D9) | — | 두 버전 |
| G5 | 사외 금칙어 — `.dt-guide.json forbiddenMarkers` + 기본(`/Users/`, `GH_TOKEN`, `.env.`, 티켓 키 패턴 `[A-Z]{2,}-\d+`) | — | 행 번호·마커 |

전부 돌려 findings를 모아 한 번에 보인다(첫 실패에서 멈추지 않음). 설정·버전을 못 읽는 경우(`package.json`·`.dt-guide.json`)는 `G0`으로 한 줄 보고한다(스택 트레이스 금지). 영수증 `guide-receipt.json { version, sourceHash(docs/guide/ 전체, PDF·영수증 제외), shotsRefreshed, pdf(PDF 를 실제로 만들었는지 — `--no-pdf` 영수증은 배포 검사에서 거부), builtAt }`.

## 9. 에이전트

- `agents/guide-analyst.md` — 입력 `{ projectRoot, config(.dt-guide.json), priorInventoryPath?, unattended?, answers? }`(`answers`는 조율자가 사용자 답을 싣고 다시 dispatch 할 때). 1~3단계 수행, `surfaceInventory.mjs` 실행, 문서·코드·테스트 읽기, 준비물 체크리스트 채우기. 반환 `{ inventoryPath, needsDecision: [{ topic, options, evidence, reflectsTo }], surface: { type, router, confidence, hints, screenCount, externalRedirects }, writingLint: { fixed, kept }, summary }`. **사용자에게 직접 묻지 않는다.** 스크래치 `.dt-guide/progress.md`(재개용, gitignore).
- `agents/guide-author.md` — 입력 `{ projectRoot, config, inventoryPath, captureReceiptPath?, gateFindings?, priorGuidePath? }`(`gateFindings`는 게이트가 남았을 때 다시 dispatch 하며 싣는다). §7-1 템플릿으로 `guide.md` 작성(front matter 포함). 반환 `{ draftPath, coverage: { covered, missing }, gate: { ok, findings? }, writingLint: { fixed, remaining }, sections, summary }` — `remaining`은 리뷰어에게 넘어갈 양이라 analyst의 `kept`와 뜻이 다르다. 리뷰어 dispatch는 조율자가 한다(리뷰는 항상 격리 — 원칙 3).
- 재사용: `ko-writing-reviewer`(②) · `askquestion-principle.md` · `dt-spec-collect-project-context`의 package.json → 카테고리 분류 표(1단계에서 같은 표를 쓴다 — 중복 정의 안 함, 참조).

## 10. 비목표

- BE API 사용 안내서(화면 없는 프로젝트).
- Confluence 발행 — 후속: `dt-confluence-doc`으로 "이번 버전 요약 + PDF 링크" 얇은 안내(참조 구현 D3).
- 다국어 가이드.
- 앱 안에 가이드 열기 버튼 넣기(제품 코드 수정은 스킬 범위 밖 — 참조 구현 §7은 프로젝트가 직접 했다).
- 캡처 이미지의 자동 크롭·주석(화살표 등).
- 유료 LLM 호출이 필요한 상태 준비의 비용 통제(레시피 작성자 책임 — 안내만).

## 11. 테스트 · 수용 기준

### 11-1. 단위
- `surfaceInventory.test.mjs` — 픽스처 디렉터리 4종(react-router · next-app · next-pages · electron)에서 화면 목록·authHint·externalRedirects.
- `guide/gate.test.mjs` — G1~G5 양성·음성(참조 구현의 `tests/guide/gate.test.ts` 이식 + G2 인벤토리 항, G3 `mode none` 면제).
- `guide/assemble.test.mjs` — 이미지 data URI 치환, `{{CONTENT}}` 마지막 치환, 외부 URL 통과.
- `guide/capture.test.mjs` — 레시피 스캐폴딩(needs 합집합 → states 키), `manual|none` 건너뜀, 실패 화면 `skipped` 집계(Playwright는 mock).

### 11-2. 수용 (구현 완료 판정)
참조 구현·sample-app은 **손에 있는 실측 대상**일 뿐이다(D13). 수용 기준은 "이 두 프로젝트에서 되는가"가 아니라 "이 두 프로젝트 **처럼 서로 다른** 프로젝트에서 스킬 지침만으로 되는가"다 — 두 프로젝트 이름이 스킬·에이전트·스크립트 본문에 나오면 안 된다(테스트 픽스처·계획 문서의 예시는 예외).
1. **참조 구현**(electron)에 `/dt-guide analyze` → 인벤토리의 화면 목록이 현재 가이드 13장의 화면과 대응하고(누락 0), `SCR-login-oauth`류가 `mode: none` 후보로 표시된다. 4단계 질문에 준비물 체크리스트가 한 질문으로 묶여 나온다.
2. **sample-app**(web, react-router)에 `/dt-guide` 끝까지 → 라우트→화면 인벤토리, 레시피 스캐폴딩, 캡처 ≥ 1장, 초안 + `ko-writing-reviewer` before→after 표, `docs/guide/<Product>-User-Guide.pdf`(ASCII 파생 — 예: `sample-app-User-Guide.pdf`) 생성, 영수증. G5가 `PROJ-43` 같은 티켓 키를 잡는다.
3. `auditor.md`가 `surfaceInventory.mjs`를 가리키고 `dt-audit` 기존 테스트가 그대로 통과한다.
4. 재실행 `/dt-guide analyze`에서 `user-confirmed` 필드가 덮어써지지 않는다.

## 12. 구현 순서 (계획 단위 제안 — 스펙 규모가 크므로 계획은 둘로 나눈다)

**계획 A — 엔진·스크립트(사람 대화 없음, 전부 테스트 가능)**: `surfaceInventory.mjs`(+auditor 한 줄) → `guide/gate.mjs` → `assemble.mjs` → `build.mjs` + 테마·글꼴 → `capture.mjs` + 레시피 스캐폴딩 → 템플릿 4종.
**계획 B — 스킬·에이전트·커맨드**: `inventory-schema.md`·`prep-checklist.md`·`guide-outline.md` → `guide-analyst.md` → `guide-author.md` → `dt-guide/SKILL.md` + `commands/dt-guide.md` → README·plugin.json → 수용 기준 §11-2.

## 13. 미결 · 후속

- 빌드가 플러그인 경로에 의존한다(`/dt-guide build`) — 플러그인 없이도 빌드하고 싶으면 그때 엔진을 npm 패키지로 뽑는다(D7 탈락안 재검토 지점).
- 3단계의 "주요 핸들러 읽기" 깊이 — 첫 판은 파일 머리 주석·JSDoc·테스트 이름까지. 핸들러 본문 해석은 비용을 보고 조정.
- 준비물 체크리스트·질문 종류는 성장형 — 실제 두 프로젝트(참조 구현·sample-app)를 돌린 뒤 표를 다듬는다.
- Confluence 얇은 안내(비목표)를 `distribution`에 `confluence`가 있으면 `dt-confluence-doc`으로 이어 주는 것.
- Electron 캡처 드라이버는 실제 앱에 아직 닿지 않았다(픽스처·단위 테스트만) — 첫 Electron 프로젝트 실행에서 확인한다.
