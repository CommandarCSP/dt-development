# dt-development

기획부터 코드, 리뷰, 마무리(문서·이슈 정리)까지 — 웹 서비스 개발의 한 흐름 전체를 정해진 방식대로 자동화하는 Claude Code 플러그인입니다.

프론트엔드(React 5계층)와 백엔드(NestJS 계층형) 양쪽에서, 코드를 만들 때마다 정해진 아키텍처를 따르고 자동으로 검증되도록 설계했습니다. 사람이 매번 규칙을 기억하지 않아도 늘 같은 구조·같은 품질로 결과물이 나오는 것이 목표입니다.

---

## 설치

Claude Code 세션 안에서 다음 두 명령을 입력합니다(터미널이 아닙니다).

```
/plugin marketplace add CommandarCSP/dt-development
/plugin install dt-development@dt-development
```

---

## 무엇이 들어 있나

스킬 39개 · 에이전트 16개 · 커맨드 24개로 이루어져 있습니다. 갈래로 묶으면 다음과 같습니다.

| 갈래 | 하는 일 | 대표 커맨드 |
|---|---|---|
| 정의서 | 프로젝트 합의서(FE/BE 범위 분담 + 인터페이스 계약)를 먼저 만든다 | `/dt-devspec` |
| FE 스펙 생성 | Figma·문서 등 여러 소스를 분석해 화면 단위 SDD 명세를 만든다 | `/dt-spec` |
| BE 스펙 생성 | OpenAPI·ERD·문서를 분석해 리소스 단위 SDD 명세 + API 계약을 만든다 | `/dt-be-spec` |
| 스캐폴드·구현 | 확정된 스펙을 5계층(FE)·계층형(BE) 코드로 만든다 | `/dt-implement` · `/dt-scaffold` · `/dt-be-implement` · `/dt-be-scaffold` |
| 리뷰 | 아키텍처 규칙 위반과 테스트 커버리지를 기계적으로 검사한다 | `/dt-review` · `/dt-be-review` |
| 풀스택 조율 | 정의서 → BE → FE까지(선택: e2e·감사·가이드·핸드북·마무리) 이름 있는 단계로 한 흐름에 이어 실행한다 | `/dt-fullstack` |
| 감사 | 스펙과 실제 구현이 어긋난 곳(드리프트)을 찾는다 | `/dt-audit` |
| 가이드 PDF | 프로젝트를 분석해 사용자 가이드 PDF를 만든다 | `/dt-guide` |
| 인수인계 핸드북 | 이미 있는 코드를 분석해 신규 개발자용 핸드북 PDF를 만든다. 데이터 주인·군집·경계를 먼저 세우고 시나리오 호출 사슬을 얹는다 | `/dt-handbook` |
| 한국어 문장 검사 | 기계 검사 + 격리 리뷰로 어색한 문장을 고친다 | `/dt-ko` |
| Jira 연동 | 개발 작업을 Story·Task·Bug로 정리해 설명·진행·마무리 댓글로 기록한다(조직 규칙은 프리셋) | `/dt-worklog` |
| 위키 문서 | 작업을 위키 문서 7종(회의록·작업 보고·설계·운영 가이드·회고·릴리즈 노트·장애 회고)으로 쓴다 — Confluence 또는 저장소 markdown | `/dt-confluence` |
| 기존 프로젝트 들이기 | 이미 만든 프로젝트에서 화면·API를 근거와 함께 뽑아 정의서·스펙·결정(PD) 초안을 만들고, 의도/버그를 확인해 확정한다 | `/dt-adopt` |
| 결정 기록 | 계속 유효한 결정을 프로젝트 결정(PD)·팀 정책(TP) 문서로 남기고 찾는다. 규칙 끄기의 근거가 된다 | `/dt-decision` |
| 형식 이전 | 플러그인을 올린 뒤 프로젝트의 dt 산출물이 지금 형식과 맞는지 보고, 옮길 수 있는 것은 미리보기 → 확인 → 옮긴다. 바뀐 점은 [CHANGELOG](CHANGELOG.md) | `/dt-migrate` |
| 마무리 | 브랜치 통합, 커밋→위키 문서 판단→작업 기록 동기화 순서 안내(단계는 설정으로, 꺼진 트래커·위키는 건너뜀) | `/dt-git` · `/dt-wrap` |

<!-- catalog:start -->

<details><summary>전체 목록 — 명령 24 · 스킬 39 · 에이전트 16 (자동 생성: <code>node scripts/readmeCatalog.mjs --write</code>)</summary>

**명령** — 사용자가 `/`로 부르는 입구. 절차는 따르는 스킬에 있다.

| 명령 | 하는 일 | 따르는 스킬 |
|---|---|---|
| `/dt-adopt` | 이미 만들어진 프로젝트를 정의서·스펙·결정 기록(PD)으로 들인다 | `dt-adopt` |
| `/dt-audit` | Audit the implemented app against dt spec artifacts | `dt-audit` |
| `/dt-be-e2e` | Author and verify scenario-based acceptance e2e (Jest+Supertest+Testcontainers) for implemented backend resou… | `dt-be-e2e` |
| `/dt-be-implement` | Turn dt-bespec resource artifacts into NestJS code by delegating to the dt-backend-scaffold engine | `dt-be-implement` |
| `/dt-be-review` | Run dt-backend rule and coverage review against current project | `dt-backend-review` |
| `/dt-be-scaffold` | Generate or extend dt-backend (NestJS) module code via multi-agent scaffold workflow | `dt-backend-scaffold` |
| `/dt-be-spec` | Build backend SDD spec documents (requirements.md/design.md/tasks.md/api-contract.md) for a REST resource fro… | `dt-bespec-generate-spec` |
| `/dt-confluence` | 개발 작업(git/세션/Jira)을 위키 문서로 쓴다(기본 Confluence, 저장소 markdown도) | `dt-confluence-doc` |
| `/dt-decision` | 계속 유효한 결정을 프로젝트 결정(PD)·팀 정책(TP) 문서로 남기고, 찾고, 대체한다 | `dt-decision` |
| `/dt-devspec` | Build the project-level development definition (docs/specs/definition.md) | `dt-devspec` |
| `/dt-e2e` | Author and verify scenario-based acceptance e2e (Playwright) for implemented pages, driven by page specs and… | `dt-e2e` |
| `/dt-explain` | Explain a discovered problem (Jira ticket, bug, issue) in structured plain language | `dt-explain` |
| `/dt-fullstack` | 요구사항·UX 소스에서 풀스택 웹앱을 이름 있는 단계(definition → be-spec → be-build → fe-spec → fe-build, 선택 e2e·audit·guide·handbo… | `dt-fullstack` |
| `/dt-git` | 피처 브랜치를 표준 절차로 main에 통합한다. start=origin 최신 main에서 분기, finish=리베이스→--no-ff 머지→main push→피처 브랜치 정리 | `dt-git-flow` |
| `/dt-guide` | Generate an end-user guide PDF for a web-frontend or Electron project | `dt-guide` |
| `/dt-handbook` | Generate a developer handbook PDF for an existing codebase | `dt-handbook` |
| `/dt-implement` | Turn dt-spec page artifacts into code by delegating to the dt-frontend-scaffold engine | `dt-implement` |
| `/dt-ko` | Check Korean prose in the given files (or the git diff) | `dt-ko` |
| `/dt-migrate` | 플러그인을 올린 뒤 프로젝트의 dt 산출물(스펙·정의서·project-context·interactions·플랜·원장·결정·설정)이 지금 형식과 맞는지 점검하고, 옮길 수 있는 것은 미리보기 →… | `dt-migrate` |
| `/dt-review` | Run dt-frontend rule and coverage review against current project | `dt-frontend-review` |
| `/dt-scaffold` | Generate or extend dt-frontend domain code via multi-agent scaffold workflow | `dt-frontend-scaffold` |
| `/dt-spec` | Build SDD-format spec documents (requirements.md/design.md/tasks.md/layout-skeleton.md) for a page from multi… | `dt-spec-generate-spec` |
| `/dt-worklog` | 개발 작업(git + 세션 + 메모)을 트래커(기본 Jira)에 Story·Task·Bug로 기록한다 | `dt-worklog-sync` |
| `/dt-wrap` | 작업 마무리 루틴을 순서대로 진행한다 | `dt-wrap` |

**스킬** — 명령이 부르거나, 조건이 맞으면 모델이 스스로 부른다. 같은 이름 명령이 있는 스킬은 `/` 메뉴에 나오지 않는다.

| 스킬 | 하는 일 |
|---|---|
| `dt-adopt` (/dt-adopt) | bringing an existing (brownfield) project under dt management |
| `dt-audit` (/dt-audit) | auditing whether the implemented app (static code + running app) satisfies dt spec artifacts |
| `dt-backend-architecture` | writing or reviewing NestJS/TypeScript code in a project that contains .dt-backend.json |
| `dt-backend-coding-discipline` | writing, reviewing, or refactoring code in a project that contains .dt-backend.json |
| `dt-backend-review` | reviewing dt-backend (NestJS) project code for architecture/test rule violations, when the backend scaffold w… |
| `dt-backend-scaffold` | the user requests creating a new NestJS project following dt-backend architecture, adding a new module/resour… |
| `dt-backend-testing` | writing or reviewing tests in a NestJS project that contains .dt-backend.json |
| `dt-be-e2e` (/dt-be-e2e) | Use after /dt-be-implement to author and verify scenario-based acceptance e2e (Jest+Supertest+Testcontainers)… |
| `dt-be-implement` (/dt-be-implement) | the user wants to turn dt-bespec resource artifacts (requirements/design/tasks/api-contract in docs/specs/res… |
| `dt-bespec-analyze-datamodel` | Use within dt-bespec to analyze ERD diagrams, SQL DDL, or data-model documents and extract entities, fields,… |
| `dt-bespec-analyze-document` | Use within dt-bespec to extract intent, flows, business rules, edge cases, and endpoint candidates from Markd… |
| `dt-bespec-analyze-openapi` | Use within dt-bespec to analyze an OpenAPI/Swagger 3.x spec (yaml/json) and extract endpoints, HTTP methods,… |
| `dt-bespec-ask-missing` | Use within dt-bespec to resolve source conflicts/duplicates and fill missing endpoint details (method, path,… |
| `dt-bespec-collect-project-context` | Use within dt-bespec to collect/maintain backend project context (framework, ORM, database, cache/queue, auth… |
| `dt-bespec-generate-spec` | generating backend SDD spec documents (requirements.md/design.md/tasks.md/api-contract.md) for a REST resourc… |
| `dt-confluence-doc` | the user wants to write a wiki document (Confluence by default, or markdown in the repo) from their dev work |
| `dt-decision` (/dt-decision) | Record, list, and supersede long-lived decisions |
| `dt-devspec` (/dt-devspec) | starting a new project/feature and the team needs a project-level Source of Truth before FE/BE specs |
| `dt-e2e` (/dt-e2e) | Use after /dt-implement to author and verify scenario-based acceptance e2e (Playwright) for implemented pages |
| `dt-explain` (/dt-explain) | the user asks to explain a problem, bug, Jira ticket, or issue |
| `dt-frontend-architecture` | writing or reviewing React/TypeScript code in a project that contains .dt-frontend.json |
| `dt-frontend-coding-discipline` | writing, reviewing, or refactoring code in a project that contains .dt-frontend.json |
| `dt-frontend-review` | reviewing dt-frontend project code for architecture/test rule violations, when scaffold workflow needs a phas… |
| `dt-frontend-scaffold` | the user requests creating a new React project following dt-frontend architecture, adding a new domain (e.g.… |
| `dt-frontend-testing` | writing or reviewing tests in a project that contains .dt-frontend.json |
| `dt-fullstack` (/dt-fullstack) | the user wants to build a full web app end-to-end from requirements/UX sources |
| `dt-git-flow` | integrating a feature branch into main following the team's git workflow |
| `dt-guide` (/dt-guide) | the user wants an end-user guide (사용자 가이드·사용 설명서·매뉴얼 PDF) for a web-frontend or Electron project |
| `dt-handbook` (/dt-handbook) | the user wants a developer handbook for an existing codebase (인수인계서·코드 설명서·아키텍처 문서·핸드북 PDF) |
| `dt-implement` (/dt-implement) | the user wants to turn dt-spec page artifacts (requirements/design/tasks/layout-skeleton in docs/specs/pages/… |
| `dt-ko` (/dt-ko) | the user wants Korean prose checked or cleaned up |
| `dt-migrate` (/dt-migrate) | Check a project's dt artifacts (specs, definition, project-context, interactions, plans, e2e ledgers, decisio… |
| `dt-spec-analyze-document` | dt-spec needs to extract intent/flow/rules/API candidates AND infer UI structure from a document source (Mark… |
| `dt-spec-analyze-figma` | dt-spec needs to analyze a Figma design page (the screen the user will build), extract UI tree/components/sem… |
| `dt-spec-ask-missing` | dt-spec needs to fill missing requirements via user askQuestion |
| `dt-spec-collect-project-context` | dt-spec needs the project's overview, constraints, domain glossary, and tech stack |
| `dt-spec-generate-spec` | the user runs /dt-spec to build SDD spec documents for a page |
| `dt-worklog-sync` | a developer (FE/BE) wants to record their development work in the issue tracker (Jira by default) |
| `dt-wrap` (/dt-wrap) | wrapping up a chunk of work |

**에이전트** — 사용자가 부르지 않는다. 조율 스킬이 일을 맡긴다. 티어는 `.dt.json` `team.models`로 모델을 고르는 묶음이다.

| 에이전트 | 티어 | 하는 일 |
|---|---|---|
| `adopt-extractor` | planner | /dt-adopt 역추출 워커 |
| `auditor` | reviewer | 구현↔스펙 정합 감사 워커(track: fe\|be\|ux\|spec) |
| `be-builder` | builder | 한 리소스/모듈의 BE 계층(repository·dto·service·controller·module)을 스펙대로 한 컨텍스트에서 구현하는 일회성 워커 |
| `bespec-author` | planner | 요청 범위의 BE 리소스 스펙 전체(requirements/design/tasks/api-contract)와 크로스리소스 통합(트랜잭션 경계·cascade·스키마 관계)을 한 컨텍스트에서 홀리스틱… |
| `definition-author` | planner | 프로젝트 정의서(docs/specs/definition.md |
| `e2e-author` | planner | 수용 e2e 워커(stack: frontend\|backend) |
| `fe-builder` | builder | 한 페이지/도메인의 FE 5레이어(services·store·business·view·domain·page)를 스펙대로 한 컨텍스트에서 구현하는 일회성 워커 |
| `guide-analyst` | planner | /dt-guide analyze 워커 |
| `guide-author` | planner | /dt-guide write 워커 |
| `handbook-analyst` | planner | /dt-handbook analyze 워커 |
| `handbook-author` | planner | /dt-handbook write 워커 |
| `handbook-tracer` | planner | /dt-handbook trace 워커 |
| `ko-writing-reviewer` | reviewer | 플러그인이 생성한 한글 본문을 readable-writing.md(A·B·C 묶음)로 판정하고, 위반 문장마다 대체 문장(before→after)을 돌려주는 격리 리뷰 워커 |
| `plan-author` | planner | 한 스택(FE 전 페이지 또는 BE 전 리소스)의 확정 스펙 + interactions.md를 한 컨텍스트에서 읽고, 유닛별 코드-레벨 체크박스 플랜(plan.md)에 크로스유닛 연계 배선까지 박… |
| `reviewer` | reviewer | dt-frontend/dt-backend 코드를 review.mjs로 검사하고 verdict만 반환하는 격리 리뷰 워커 |
| `spec-author` | planner | 요청 범위의 FE 페이지 스펙 전체(requirements/design/tasks/layout-skeleton)와 크로스페이지 interactions.md를 한 컨텍스트에서 홀리스틱하게 작성하는… |

</details>

<!-- catalog:end -->

---

## 설정 — 회사·프로젝트 값은 어디에 넣나

스킬 안에 값을 적어 넣는 게 아니라, **여러분 프로젝트 루트의 설정 파일**에 넣습니다. 대부분은 위저드가 대신 만들어 줍니다.

| 파일 | 무엇 | 만들어지는 방법 |
|---|---|---|
| `.dt-worklog.json` / `.dt-worklog.local.json` | 작업 기록(프로젝트 키·프리셋 `basic`/`org-guideline` 등) | 최초 실행 위저드가 자동으로 진입해 만든다 |
| `.dt-confluence.json` / `.dt-confluence.local.json` | 위키 문서(스페이스·구역 페이지·검토 주기) | 최초 실행 위저드가 자동으로 진입해 만든다 |
| `.dt-guide.json` | 가이드 PDF 설정 | 없으면 기본 템플릿으로 자동 생성 |
| `.dt-handbook.json` | 인수인계 핸드북 설정 | 없으면 기본 템플릿으로 자동 생성 |
| `.dt.json` / `.dt.local.json` | 공통 설정 — 알림 훅(opt-in)·팀 실행 방식·역할별 모델·언어·필수 MCP·트래커·위키·마무리 단계. 키는 [docs/refs/config-schema.md](docs/refs/config-schema.md) | `/dt-wrap --init` |
| `.dt-pipeline.json` | (옛 훅 설정 — 계속 읽지만 `.dt.json`의 `hooks`로 옮기기를 권한다) | — |
| `.dt-frontend.json` / `.dt-backend.json` | FE/BE 아키텍처 규칙 | 스킬이 필요할 때 없으면 만든다 |

읽는 순서는 **개인(`.local.json`) > 팀(`.json`) > 대화형 질문**입니다. `.local.json`은 커밋하지 않는 개인 값(예: 마지막으로 동기화를 마친 커밋 위치)이라 각자 `.gitignore`에 등록합니다.

Jira 연동 위저드는 cloudId·site를 `site.resources`로 자동 확인합니다. 사람이 고르는 것은 프로젝트 키 하나뿐이고, cloudId 같은 UUID를 손으로 찾아 넣을 일은 없습니다.

---

## 이미 있는 프로젝트에 얹을 때

아무것도 준비하지 않아도 됩니다. `.dt-frontend.json`·`.dt-backend.json`이 없으면 **스킬이 필요한 시점에 만들고 하던 일을 계속합니다.**

무엇을 보고 정하는지는 이렇습니다.

- 스택 — `package.json`의 의존성. `react`·`vite`·`next`가 보이면 프론트엔드, `@nestjs/core`가 보이면 백엔드. 둘 다면 둘 다 만듭니다
- 소스 경로 — `src/`가 있으면 `src`

**묻지 않고 만들지만, 무엇을 어떻게 정했는지는 알려 줍니다.** 모노레포처럼 소스가 `packages/web/src`에 있는 프로젝트라면 감지가 틀릴 수 있습니다. 그때는 만들어진 파일의 `paths.src`를 고치면 됩니다.

아는 의존성이 하나도 없으면 만들지 않습니다. 어느 스택인지 모르는 채로 만들면 맞지 않는 규칙이 켜진 상태로 검사가 돌기 때문입니다. 이때는 그 사실을 알리고 멈춥니다.

절차의 자세한 규칙은 [`docs/refs/stack-config-bootstrap.md`](./docs/refs/stack-config-bootstrap.md)에 있습니다.

---

## 설계 메모

**왜 얇은 에이전트인가.** 서브에이전트(`agents/`)는 절차를 자기 안에 베껴 넣지 않고, 실행 시점에 `${CLAUDE_PLUGIN_ROOT}` 아래 문서(스킬 본문, `docs/refs/`의 참조 문서)를 직접 읽습니다. 규칙을 두 곳에 나눠 적으면 한쪽만 고치고 다른 쪽을 잊는 일이 생기기 때문에, 절차의 단일 진실 원천(SOT)을 하나로 유지하는 쪽을 택했습니다.

**왜 규칙을 `docs/refs/`에 모아 두는가.** 한국어 문장 규칙(`readable-writing.md`), EARS 명세 패턴(`ears-patterns.md`) 같은 판정 기준은 여러 스킬이 함께 참조합니다. 스킬마다 복사해 두면 버전이 어긋나므로, 참조 문서를 한곳에 두고 스킬은 그 경로만 가리키게 했습니다.

---

## 한 줄 밝히기

사내 저장소에서 다듬어 온 것을 공개판으로 분리했습니다. 작업 기록·위키 문서 규칙은 일반 프로젝트용 팀 정책(`docs/policies/TP-002`·`TP-003`)이 기본이고, 조직마다 다른 규칙은 프리셋·설정으로 고릅니다.

---

## 개발

스킬·리뷰 규칙·에이전트·명령을 더하거나 고치는 법은 [CONTRIBUTING.md](CONTRIBUTING.md), 바뀐 점은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.

```bash
npm test        # tests/ · skills/*/tests/ · hooks/tests/ 전부
npm run scan    # 금칙어 스캔(이메일·cloudId 내장 규칙)
```

스킬·룰·스크립트는 모두 텍스트와 작은 `.mjs` 헬퍼로 이루어져 있어, 빌드(코드를 실행 가능한 형태로 미리 묶어 두는 과정) 없이 Node만으로 테스트가 돌아갑니다. push·PR마다 GitHub Actions가 같은 두 명령을 Node 22로 돌립니다.

조직별 금칙어(회사·고객사 이름 등)는 목록 자체가 식별자라 저장소에 넣지 않습니다. 저장소 밖 JSON을 `DT_FORBIDDEN_RULES=<파일> npm test`로 넘기고, CI에는 저장소 Secret `DT_FORBIDDEN_RULES_JSON`에 같은 JSON을 넣습니다. 형식은 `scripts/scanForbidden.mjs` 머리 주석에 있습니다.

---

## 라이선스

MIT — [LICENSE](./LICENSE) 참고.
