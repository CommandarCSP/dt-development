# 변경 기록

이 플러그인의 바뀐 점을 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전의 뜻은 [호환 정책](docs/refs/compat-policy.md)이 정한다.

- 바꿀 때마다 맨 위 **미출시** 절에 적는다. 버전을 올릴 때 `node scripts/release.mjs <patch|minor|major>`가 이 절을 그 버전 절로 바꾼다.
- **산출물 형식 변경** 절은 사용자 프로젝트에 이미 있는 파일(스펙·project-context·설정 등)에 영향이 있을 때 쓴다. 옮기는 방법(`/dt-migrate`)이나 "옮길 필요 없음"을 함께 적는다.

## [미출시]

## [0.16.2] - 2026-11-27

### 고침

- `/dt-worklog`의 마무리 댓글 검사(`check-close`)가 `- 산출물:`·`- 결정 사항:` 아래에 하위 항목으로 나눠 쓴 값을 읽지 못해, 내용이 있는데도 완료를 막던 문제를 고쳤다. 하위 항목도 한 줄씩 보고, 자리 표시(`{…}`·`없음`)는 지금처럼 빈 값으로 본다.

## [0.16.1] - 2026-11-27

### 고침

- `/dt-migrate`가 옛 형식 `interactions.md`를 옮길 때 첫 `##` 절 앞(머리 주석·제목·소개 글)을 지우던 문제를 고쳤다. 이제 그 부분은 그대로 두고 형식 표시만 더한다. 0.16.0으로 이미 옮긴 프로젝트는 git 기록에서 앞부분을 되살린다.

## [0.16.0] - 2026-11-27

팀마다 다른 도구와 규칙을 설정으로 고를 수 있게 했다. 이슈 트래커·위키·git 흐름·마무리 단계는 공통 설정 `.dt.json`으로, FE·BE 스택(ORM·DB·스타일링·폴더·테스트 이름)은 스택 설정으로 정한다. 정의서는 Figma 없이 기획 문서만으로도 시작한다. 리뷰가 그동안 "사람 확인"으로만 넘기던 규칙 15개를 정리해, 기계로 볼 수 있는 부분은 실제로 검사한다. `/dt-explain`은 없앴다.

설정을 하나도 바꾸지 않으면 대부분 예전과 같게 동작한다. 올리기 전에 아래 "올릴 때 할 일"만 확인한다.

### 올릴 때 할 일

해당하는 것만 하면 된다.

- `/dt-explain`을 썼다면 버그 기록은 `/dt-worklog`(Bug), 장애 정리는 `/dt-confluence`(장애 회고)로 옮긴다. 경고 기간 없이 이번 버전에서 바로 빠졌다.
- BE 리뷰 결과를 규칙 이름으로 찾는다면(보고서 파싱·CI) 이름 4개를 바꾼다 — `repository-only-prisma` → `repository-only-orm`, `controller-no-direct-prisma` → `controller-no-direct-orm`, `service-no-direct-prisma` → `service-no-direct-orm`, `dto-no-prisma-import` → `dto-no-orm-import`. 규칙 끄기(`overrides`)는 이름을 쓰지 않아 그대로 둔다.
- `/dt-worklog`를 썼다면 `.dt-worklog.json`에 `"preset": "org-guideline"`(예전 규칙 유지) 또는 `"basic"`(새 기본, TP-002)을 적는다. 옛 키(`issueTypeNames`·`transitionMap`·`outputFieldName`·`outputFieldId`)는 새 키(`issueTypes`·`transitions`·`outputField`)로 옮긴다. 옛 키는 0.16.x 동안 경고와 함께 받는다.
- `/dt-confluence`에서 문서 종류 `worklog`·`techdoc`을 썼다면 `report`(작업 보고), `design`(설계 문서)·`guide`(운영 가이드)로 바꾼다. 옛 이름은 0.16.x 동안 받는다.
- Figma 화면을 [왼쪽 UI]+[오른쪽 주석]으로 그리는 팀이라면 `.dt.json`에 `"uxSources": { "figma": { "annotationLayout": "right-panel" } }`을 넣는다. 넣지 않으면 화면 전체를 읽는다.
- 가이드·핸드북에서 모든 `대문자-숫자` 표기를 티켓 키로 막으려면 `.dt-guide.json`·`.dt-handbook.json`에 `"ticketKeyPattern": "[A-Z][A-Z0-9]+-\\d+"`를 적는다. 이제 기본은 트래커 설정의 키 형식만 막는다.
- 옛 리뷰 엔진 경로 `skills/dt-frontend-review/scripts/review.mjs`를 직접 부른다면 `scripts/review/review.mjs`로 바꾼다. 옛 경로는 경고를 내고 새 엔진을 부르며, 0.17.0에서 지운다.
- `dt-git-flow` 상태 스크립트의 `isMain`을 읽는 스크립트가 있다면 `isBase`로 바꾼다. `isMain`은 0.16.x 동안 남긴다.
- `stackVersions.mjs --deps|--dev`를 직접 썼다면 `scaffoldPreset.mjs`로 바꾼다.
- BE 스캐폴드 게이트에 `--prisma true`를 고정해 두었다면 지워도 된다. 이제 `stack.orm`이 prisma일 때만 Prisma 검사를 켠다. `--prisma true|false`는 덮어쓰기로 남는다.

### 없앰

이번 버전에서 빠진 것이다.

- **`/dt-explain`(문제 설명) 스킬·명령을 없앴다.** (GEN-13)
  - 대신 쓸 것: 버그 기록은 `/dt-worklog`(Bug), 장애 정리는 `/dt-confluence`(장애 회고).
  - 없앤 이유: "설명해줘"·"왜 이래?"에 자동으로 걸려 간단한 질문에도 6절 틀과 한글 리뷰가 붙었고, 산출물이 없어 다른 흐름과 이어지지 않았다.
  - 호환 정책은 한 마이너 버전 동안 경고한 뒤 없애게 하지만, 팀 결정으로 바로 없앴다. 한글 검사의 `docType: explain`도 함께 없앴다.

### 추가

새로 생긴 설정·명령·도구다. 주제별로 묶었다.

#### 팀 설정 — 트래커·위키·git·마무리

- 이슈 트래커를 고른다. `.dt.json`의 `tracker`: `jira`(기본) · `github` · `linear` · `none`. 설명은 `docs/refs/tracker-adapter.md`. (GEN-09)
  - 실제 연동은 Jira만 된다. GitHub·Linear는 자리만 만들어 두었다(스텁).
  - `none`이면 정리한 작업을 마크다운으로만 보인다.
  - 트래커 어댑터에 이슈 하나 읽기(`issue.read`)도 있다. (GEN-13)
- 위키를 고른다. `.dt.json`의 `wiki`: `confluence`(기본) · `markdown` · `notion` · `none`. 설명은 `docs/refs/wiki-adapter.md`. (GEN-10)
  - `markdown`은 같은 템플릿으로 저장소 `docs/wiki/`에 쓴다.
  - `/dt-worklog`의 관련 문서 찾기도 이 값을 따른다.
- 작업 기록 규칙 팀 정책 TP-002(`docs/policies/TP-002-task-records.md`). (GEN-09)
  - 계층: Epic → Story·Task·Bug가 기본 단위 → Sub-task는 나눌 때만. 크기는 한 주 안.
  - 템플릿: 설명(배경·목표·완료 조건·참고), 진행 댓글, 마무리 댓글.
  - 마무리 규칙: Done 전에 마무리 댓글에 산출물이나 결정 사항을 적는다.
  - 관련 Confluence 문서가 있으면 댓글의 "관련 문서" 줄로 링크한다.
- 작업 기록 프리셋 `basic`(기본, TP-002)과 `org-guideline`(사내 가이드라인 v1.0: Sub-task 강제·1~3일·수행 Epic·날짜·산출물 필드·릴리즈 필수). (GEN-09)
  - 설정을 합치고 검사하는 `scripts/worklogConfig.mjs`(`--json`, 마무리 댓글 검사 `check-close`).
  - 키 설명은 `skills/dt-worklog-sync/references/presets/README.md`.
- 위키 문서 규칙 팀 정책 TP-003(`docs/policies/TP-003-wiki-docs.md`). (GEN-10)
  - 문서 7종: 회의록·작업 보고·설계 문서·운영 가이드·회고·릴리즈 노트·장애 회고.
  - 공통 머리: 상태·담당자·검토일·관련 이슈·관련 결정·요약. 검토일은 설계·가이드만 6개월.
  - 구역 6개 페이지 트리, 제목 규칙, `doc-*` 라벨, 트래커 양방향 연결.
  - 위키 설정을 합치고(`sections`·`labelsByType`·`reviewMonths`) 제목·공통 머리(HTML·markdown)·markdown 경로를 만드는 `scripts/wikiConfig.mjs`, `/dt-confluence`의 템플릿 7종.
- `/dt-git`의 기준 브랜치와 합치는 방식을 팀이 정한다. `.dt.json`의 `gitFlow`(`baseBranch`·`mergeStrategy`·`branchPrefix`·`pushPolicy`)와 `scripts/gitFlow.mjs`. (GEN-12)
  - 기준 브랜치는 `develop` 같은 것으로 바꿀 수 있다. 합치는 방식은 `no-ff`(기본) · `squash` · `rebase` · `pr`.
  - 명령 순서는 스크립트가 내고, 스킬은 미리보기·승인 뒤 한 단계씩 실행한다.
  - `pr` 방식은 피처 브랜치를 push하고 `gh`·`glab`으로 PR을 연다. 둘 다 없으면 PR 만들기 주소(`gitWebUrl.mjs compare`)를 보인다.
  - 설정이 없으면 예전과 같다: main · `--no-ff` · 머지 뒤 push.
- `/dt-wrap`의 단계와 순서를 팀이 정한다. `.dt.json`의 `wrap.steps`(기본 `commit` → `wiki` → `tracker`)와 `scripts/wrapState.mjs`. (GEN-11)
  - `wiki`·`tracker`가 꺼져 있으면 그 단계는 한 줄로 알리고 건너뛴다.
  - Stop 훅 알림 문구도 실제 단계로 만든다.
- git 호스트별 커밋·PR 주소 `scripts/gitWebUrl.mjs` — GitHub·GitLab·Bitbucket. 이름으로 알 수 없는 사설 호스트는 지어내지 않고 묻는다(`gitHost`). (GEN-09)

#### 입력 소스 — 정의서·스펙

- UX 소스 어댑터 `docs/refs/ux-sources.md`. (GEN-14)
  - 소스 종류별로 읽는 방법: Notion·Confluence는 MCP → 없으면 `WebFetch` → 그래도 안 되면 내보낸 파일이나 붙여 넣기를 묻는다.
  - 주 소스 정하기, Figma·Notion에서 할 일마다 쓸 도구를 정리한 대응표(접두어 세 가지), 접두어를 찾는 Figma 사전 점검, 소스별 출처 표기.
- `/dt-devspec --primary <locator>` — 어떤 화면·기능이 있는지 소스끼리 엇갈릴 때 기준으로 삼을 주 소스를 정한다. (GEN-14)
- API 규칙 프리셋 `docs/refs/api-conventions.md`와 `.dt.json`의 `conventions.preset`(`rest-v1` 기본 · `custom`). 정의서 §3이 URL 규칙을 물을 때의 제안값이다. `custom`은 모양을 전제하지 않고 항목마다 묻는다(경로 규칙 없음 포함). (GEN-14)

#### 스택 설정 — FE·BE

- 스택 설정 키 전체의 원본 `docs/refs/stack-config.md`. (GEN-04)
- 패키지 관리자·테스트 도구를 고른다. `scripts/stackCommands.mjs`. (GEN-04·GEN-08)
  - 고르는 순서: 스택 설정 `packageManager`·`testRunner` → package.json → lockfile. 대상은 pnpm·npm·yarn, vitest·jest.
  - 설치·테스트·커버리지·수용 e2e·개발 서버 명령을 낸다. `commands.*`로 직접 적을 수도 있다.
  - 리뷰 커버리지·스캐폴드 게이트·e2e·가이드 스킬이 이것을 쓴다. 설정이 없고 지금 조합이면 명령은 그대로다.
- 폴더 구조를 바꿔 끼운다. 규칙은 표준 경로(`src/…`·`e2e/…`)로 두고, 리뷰 엔진이 스택 설정 `paths.src`·`paths.e2e`·`layout`으로 프로젝트 경로로 바꾼다. 지금까지는 `src/`가 아닌 프로젝트에서 검사 파일이 0개가 되어 "Ready to merge: Yes"를 냈다. (GEN-04)
- 테스트 파일 이름·자리를 바꿔 끼운다. 스택 설정 `testing.location`(`__tests__`·`colocated`)·`testing.suffix.{unit,integration,e2e,any}`·`paths.test`. 리뷰 엔진이 테스트 규칙의 경로와 "테스트가 있어야 한다" 규칙이 찾는 이름을 바꾼다. NestJS 관례(`posts.service.spec.ts`·`test/app.e2e-spec.ts`) 예시는 `docs/refs/stack-config.md` §3. 설정이 없으면 그대로다. (GEN-06)
- 스택 설정 `apiPrefix` — 스펙의 API 주소에서 도메인을 뽑을 때 `/api` 말고 `/v1`·접두어 없음(`GET /posts`)·여러 접두어를 받는다. `/api/v1/…`의 버전 조각은 건너뛴다. (GEN-04)
- BE 리뷰가 Prisma 말고 TypeORM·Drizzle 같은 다른 스택에도 맞춰 검사한다. 스택 어댑터 `scripts/stackAdapters.mjs`. 설정 없는 Prisma 프로젝트의 규칙은 그대로다. (GEN-05)
  - 설정 키: `stack.orm`(`prisma`·`typeorm`·`drizzle`·`none`)·`stack.db`·`stack.cache`·`stack.queue`·`stack.auth`.
  - 적지 않으면 package.json(DB는 `schema.prisma` provider)에서 대안만 감지한다. 그래도 없으면 기본값(prisma·postgresql·redis·bullmq·passport-jwt)을 쓴다.
  - 리뷰 엔진이 ORM 규칙의 빈칸(`"$orm.access"`·`{{orm.mockRegex}}`)을 그 ORM으로 채운다. `none`인 영역의 규칙(머리말 `requiresStack`)은 건너뛴다.
  - 보고서 끝에 고른 스택과 근거가 나온다.
  - `be-builder`·e2e 작성은 `--json`의 `container`로 DB별 Testcontainers 모듈을 고른다.
- FE 스타일링을 고른다. 스택 설정 `stack.styling`(`tailwind`·`css-vars`·`scss`). 없으면 `tailwindcss`·`sass`를 감지하고, 그래도 없으면 `tailwind`. 설정이 없는 Tailwind 프로젝트의 규칙은 그대로다. (GEN-07)
  - 토큰 출력 방식과 `view-styling` 검사를 여기에 맞춘다.
  - 빈칸(`"$styling.forbiddenStyleImports"`)을 채울 값이 없어 검사할 것이 남지 않은 규칙은 건너뛰고, 보고서에 `규칙(stack.styling = scss)`로 적는다.
  - 토큰 출력 `materialize-tokens.mjs --emit tailwind|css-vars|scss` — `@theme` · `:root` · `src/styles/_tokens.scss`의 `$변수`. 변수 이름은 같고, 없으면 `stack.styling`을 따른다. Tailwind 출력은 그대로다.

#### 스캐폴드

- 새 프로젝트를 스택 프리셋으로 만든다. 프리셋 `templates/presets/{fe,be}/*.json`, 스크립트 `scripts/scaffoldPreset.mjs`. (GEN-07)
  - 프리셋과 패키지 관리자(`--pm npm|pnpm|yarn`)를 받아 생성·설치 명령, `playwright.config.ts`·`docker-compose.yml`·`.env`·`prisma/schema.prisma`, 스택 설정 조각을 낸다.
  - 프리셋: FE `vite-tailwind`(기본)·`vite-css-vars`, BE `nest-prisma-postgres`(기본)·`nest-prisma-mysql`. 선택 묶음 `--with auth|sentry`.
  - 두 체크리스트에 고정돼 있던 명령(`pnpm add`·`npm i`·5173·Postgres compose)을 이것으로 바꿨다.
  - 설치 버전은 `stack-versions.json` 묶음 이름으로만 고른다. 묶음은 tailwind·cssVars·prisma·postgresql·mysql로 나눴다(`stackVersions.mjs --group`).
- TypeORM 프리셋 `nest-typeorm-postgres` — TypeORM 0.3과 PostgreSQL 16. (GEN-43)
  - 마이그레이션 CLI 연결 `src/database/data-source.ts`와 package.json `migration:*` 스크립트를 낸다.
  - 모듈 체크리스트(new-module·extend-module)의 Phase 1·2를 ORM별로 나눴다: 스키마 계약(prisma `schema.delta.prisma` · typeorm `entities/*.entity.ts`, 예시 `examples/order.entity.ts`), 마이그레이션, 트랜잭션 자리(Repository 메서드 안).
  - `be-builder`·`plan-author`도 그 절을 따른다. 스펙의 Prisma 스케치는 모델 표기로 두고, TypeORM이면 엔티티로 옮긴다.
- 스캐폴드 게이트가 ORM에 맞는 검사를 고른다. `gate.mjs --orm-check schema|migrations|off`(`stackAdapters.mjs`의 `ORM_GATE_CHECKS`). (GEN-43)
  - prisma: `validate`·`migrate diff`. typeorm: `migration:generate --check`(모델을 바꾸고 마이그레이션을 빠뜨리면 실패).
  - 옛 `--prisma`·`--prisma-args`도 받는다.
- 선택 참고 문서 `docs/refs/docker-runtime-hints.md` — colima·rancher-desktop·podman 소켓, Ryuk 끄기. 규칙·체크리스트·`be-builder`에 흩어져 있던 값을 모았다. (GEN-06)

#### 가이드·핸드북

- 가이드·핸드북 PDF 출력 설정을 한곳에 모았다. 설명 `docs/refs/doc-output.md`, 읽는 코드 `scripts/lib/docOutput.mjs`. `.dt-guide.json`·`.dt-handbook.json`이 같은 키를 받는다. (GEN-17)
  - `versionSource`: `auto`(package.json → Cargo.toml → pyproject.toml 순) · `git-tag` · `file:<경로>`
  - `ticketKeyPattern`
  - `theme.{accent,font,logo}`
  - `pdf.pageSize`: `A4` · `A5` · `Letter` · `Legal`
  - `language`: 목차·문서 제목 문구와 `<html lang>`
  - 핸드북도 `docs/handbook/theme.override.html`로 테마를 통째 바꿀 수 있다.
- 핸드북 진입점 감지를 넓혔다. Express·Koa(router)·Fastify 라우트, Next.js 파일 라우트(`app//page`·`route`, `pages/` — `next` 의존이 있을 때만). 그 밖의 언어는 `.dt-handbook.json`의 `entrypoints.extraPatterns`로 더한다(`ext`로 `.py`·`.go` 같은 파일도 읽는다). (GEN-17)
- 핸드북의 "왜" 근거를 찾는 순서 `scripts/handbook/sources.mjs`. (GEN-13)
  - 결정 기록(PD·TP)을 먼저 읽는다. MCP가 필요 없다.
  - 위키는 `wiki` 설정을 따른다: confluence면 `doc-design`·`doc-guide` 라벨로 좁히고, markdown이면 `docs/wiki/design`·`guide`를 읽는다.
  - 트래커는 `tracker: jira`일 때만 쓴다.
  - 옛 `sources.atlassian.enabled: off`는 MCP 원천만 끈다.

#### 비용·도구

- 에이전트 비용 측정 `scripts/agentCost.mjs`. 기준선과 원인 분석은 `docs/specs/2026-11-27-agent-cost-baseline.md`. (GEN-41)
  - Claude Code 세션 기록에서 서브에이전트마다 턴 수, 시작·평균·최대 맥락, 출력, 환산 비용, 시간, 읽은 파일을 표로 낸다(`--match`·`--files`·`--json`).
  - 프롬프트 본문은 내지 않는다.
- 헤더를 명령으로 만든다. `buildSpecHeader.mjs`·`buildDefinitionHeader.mjs`를 명령으로 실행한다. (GEN-41)
  - `--replace <파일>`은 헤더 줄만 바꾸고 다른 주석은 남긴다. 빠진 값은 지금 헤더에서 가져온다.
  - `validateDefinition.mjs`도 결과 JSON을 출력하고, 무효면 종료 코드 1을 낸다.
- 스킬 동작 평가 `evals/` — `claude plugin eval` 형식 4건(dt-spec·dt-be-spec·dt-review·dt-migrate). 예제 프로젝트를 만들어 실제로 돌리고 결정적 채점기로 본다. CI에는 넣지 않고 손으로 돌린다(`evals/README.md`). (GEN-28)

#### 기여자용

- 기여 가이드 `CONTRIBUTING.md` — 폴더 구분·이름·언어·머리말 형식, 리뷰 규칙 하나 추가 따라 하기, 올리기 전 점검. (GEN-27)
- 리뷰 규칙 머리말 스키마 `docs/refs/rule-frontmatter.schema.json`과 검사기 `scripts/validateRules.mjs` — 필수 필드·severity·검출 type과 type별 필수 인자·relatedRules. (GEN-27)
- README 전체 목록 자동 생성 `scripts/readmeCatalog.mjs`. (GEN-27)

### 바뀜

이미 있던 기능의 동작이 달라진 것이다. 설정을 바꿔야 하는 것은 위 "올릴 때 할 일"에 모아 두었다.

#### 리뷰 규칙

- **리뷰가 "사람 확인"으로만 넘기던 규칙 15개를 정리했다.** 기계로 볼 수 있는 부분은 실제로 검사하고, 단정하지 못하는 부분은 같은 규칙에 `manual`로 적어 리뷰어가 본다. 이번 버전부터 아래 모양의 코드가 리뷰에 걸린다. 커버리지 기준(critical)은 머지 판정을 No로, 나머지(important·minor)는 고쳐서 머지(With fixes)로 바꾼다.
  - `ast-rule` 자리표였던 8개 (GEN-40):
    - FE: Business Hook이 JSX를 반환하거나 `react-dom`을 import함 / hook·store 안에 `limit: 10`·`sort: 'x'`를 직접 적음 / 에러 폴백에 `throw`가 없음 / 브레드크럼 `data`에 개인정보 키 / `vitest.config` 커버리지 기준이 없거나 80 미만
    - BE: 컨트롤러의 `for`·`while`·`.reduce(`·`switch` / jest `coverageThreshold`가 없거나 80 미만
    - `where-does-business-logic-go`는 `src/business/`만, `adding-business-params`는 `src/business/hooks/`·`src/store/**`만 본다(Page는 값을 정하는 곳이다).
    - `unit-view-component`는 짝 규칙 `view-test-props-only`와 겹쳐 `manual`로 바꿨다.
  - 설명 문구로 검사를 고르던 7개 (GEN-44):
    - 결정 로그(FE·BE): 제목 줄 없이 `- …` 항목으로 시작하는 블록
    - `integration-page`: `createMemoryRouter`·`RouterProvider`·MSW
    - `integration-domain`: MSW·에러 응답 분기, business·store `vi.mock` 금지
    - `unit-store-query`: 에러 케이스
    - `e2e-playwright`: `page.goto`·`expect`
    - `unit-ui-store`는 `manual`이다.
  - 리포트의 "AST 미구현" 문구는 "사람 확인"으로 바꿨다. 팀이 만든 규칙이 `ast-rule`을 쓰면 그 항목으로 남는다.
- BE 규칙 4개의 이름을 계층 기준으로 바꿨다. 바뀐 이름은 위 "올릴 때 할 일"에 있다. `service-requires-unit-test`는 `src/prisma/**`의 서비스에도 단위 테스트를 요구하지 않는다. (GEN-05)
- 리뷰 엔진을 공용 자리 `scripts/review/`로 옮겼다(테스트는 `tests/review/`). 옛 경로 `skills/dt-frontend-review/scripts/review.mjs`는 경고를 내고 새 엔진을 부른다. 0.17.0에서 지운다. (GEN-08)
- 리뷰 보고서의 건너뛴 규칙 줄이 `건너뛴 규칙(stack.<영역> = none): 규칙(영역)`에서 `건너뛴 규칙(스택에 맞지 않음): 규칙(stack.영역 = 값)`으로 바뀌었다. (GEN-07)

#### 정의서·스펙

- `/dt-devspec`은 Figma 없이도 시작한다. (GEN-14)
  - 기획 문서(Notion·Confluence·PDF·Markdown)에서 목차 → 화면·기능 후보 → 인터페이스 후보 → 규칙 문장을 뽑는다(`skills/dt-devspec/references/source-discovery.md`). Figma는 있으면 함께 쓴다.
  - 충돌 정리의 "원본(Figma) 우선"은 "주 소스 우선"이 됐다.
  - Figma 사전 점검도 새로 들어갔다.
- Figma 화면의 오른쪽 주석 틀만 읽는 판별은 opt-in이 됐다. 기본은 데이터가 오가는 화면을 통째로 한 번 읽는다. 예전처럼 쓰려면 위 "올릴 때 할 일"의 설정을 넣는다. (GEN-14)
- `dt-spec` Figma 사전 점검이 연결 방식별 접두어(`plugin_figma_figma`·`claude_ai_Figma`·`figma`)를 찾아 쓴다. 예전에는 한 가지 이름으로만 확인해, 다른 방식으로 연결한 사람은 "연결 안 됨"이 됐다. (GEN-14)
- 작성 에이전트가 덜 읽고 턴을 덜 쓴다. 같은 입력으로 정의서 작성을 다시 돌려 환산 비용이 15% 줄었다(73.5만 → 62.5만, 품질 게이트 그대로 통과). (GEN-41)
  - spec-author·bespec-author·definition-author·adopt-extractor·plan-author에 규칙 세 줄을 넣었다: 플러그인 스크립트 소스를 읽지 않고 명령으로 실행한다 / 같은 문서를 두 번 읽지 않고 필요한 절만 읽는다 / 읽기·고치기를 묶는다.
  - 정의서 버전만 오른 재결속은 드리프트 검사가 0이면 에이전트 없이 헤더 명령 한 줄로 한다(`docs/refs/spec-pipeline.md` §5-5).

#### 작업 기록·위키·마무리

- `/dt-worklog` 기본 규칙을 사내 가이드라인에서 TP-002로 바꿨다. 이미 쓰던 설정은 그대로다. (GEN-09)
  - 새 프로젝트: Story·Task·Bug에 설명·진행·마무리 댓글로 기록한다. Sub-task·날짜·"수행" Epic·산출물 커스텀 필드를 강제하지 않는다. 커밋 주소도 GitLab 고정이 아니라 호스트에 맞춘다.
  - 기존 설정: `preset` 없이 옛 키가 있으면 `org-guideline`으로 읽고 "`preset`을 적으라"고 경고한다. 옮기는 법은 위 "올릴 때 할 일"에 있다.
  - 위저드는 프리셋을 묻는다(기본 `basic`).
  - `references/jira-guideline.md`·`output-field-rules.md`는 `references/presets/org-guideline.md` 하나로 합쳤다.
- `/dt-confluence` 문서 종류가 4종에서 7종이 됐다. (GEN-10)
  - `worklog` → `report`(작업 보고). 옛 이름은 경고 후 `report`로 처리한다.
  - `techdoc` → 설계 문서(`design`)·운영 가이드(`guide`)로 나뉜다. 옛 이름을 쓰면 어느 쪽인지 묻는다.
  - 회고의 릴리즈노트 모드는 `release`로 따로 섰다.
  - 모든 문서 맨 위에 공통 머리가 붙고, 종류별 구역 페이지 아래에 들어간다(없으면 묻고 만든다).
  - 옛 `parentPageId`는 구역 페이지가 없는 종류의 부모로 쓰고 경고한다.
- `/dt-confluence`의 이슈 역링크가 댓글 대신 이슈 웹 링크로 들어간다. (GEN-44)
  - 달기 전에 웹 링크 목록을 읽어, 같은 문서 주소가 있으면 건너뛴다. 같은 주소를 다시 넣으면 링크가 둘이 되고 지우는 도구가 없기 때문이다.
  - 웹 링크 도구가 없거나 실패하면 예전 형식의 댓글로 대신한다.
  - TP-003 "이슈 → 문서", 트래커 대응표(`issue.link.web`), Atlassian 도구표(`jira.remoteLinks`·`jira.remoteLink`)를 맞췄다. `/dt-worklog` 댓글의 "관련 문서" 줄은 그대로다.
- Stop 훅이 `/dt-wrap`을 마친 시점부터 정리 안 된 커밋을 센다. 트래커를 안 쓰거나 기록을 건너뛰어도, 마무리 뒤에는 알림이 뜨지 않는다. (GEN-11)
  - `/dt-wrap`을 마치면(단계를 건너뛰어도) `.dt-pipeline.local.json`의 `lastWrapSha`에 HEAD를 남긴다.
  - 훅은 이 값과 옛 `lastSyncSha` 중 더 최근 것부터 센다.
  - `/dt-wrap --init`은 이 파일을 `.gitignore`에 더하고, 트래커·위키를 쓰는지 묻는다.
  - 설정이 없는 프로젝트의 단계와 알림 문구는 예전과 같다.
- `/dt-wrap` 단계 설명을 TP-002·TP-003 기준으로 고쳤다 — 기록 단위는 Story·Task·Bug(Sub-task는 나눌 때만), 완료 조건은 HTML 체크박스, 문서 종류는 7종 중에서 권한다. (GEN-11)
- 훅이 `gitFlow.baseBranch`를 따른다. 시작 알림은 기준 브랜치 위에서 뜨고, 마무리 알림의 통합 문구는 기준 브랜치·`pr`·`pushPolicy: none`을 반영한다. `dt-git-flow`의 상태 스크립트는 `isBase`·`baseBranch`를 낸다. (GEN-12)
- `/dt-audit` 후속 기록이 `tracker`를 따른다. (GEN-13)
  - `jira`면 코드 수정 묶음을 Task 하나로 만든다(완료 조건 = finding 해소). 아니면 `docs/audits/pending.md`가 백로그다.
  - 기록한 이슈 키를 `traceability.md`의 "후속 기록" 표에 되적는다. 다음 감사는 남은 finding 옆에 진행 상태를 보이고, "이슈는 완료인데 finding이 남음"을 따로 알린다.

#### 가이드·핸드북

- 가이드·핸드북의 티켓 키 검사는 키 형식을 알 때만 막는다. (GEN-17)
  - 예전: 아무 `대문자-숫자`나 사내 티켓으로 막아 `ES-2015`·`PEP-8`이 걸렸다. 핸드북 `audience: external`은 `UTF-8`·`ISO-8601`까지 막았다.
  - 이제: `ticketKeyPattern` → 트래커 설정의 `defaultProjectKey`(`SHOP`이면 `SHOP-123`만) → `issueKeyPattern` 순으로 찾고, 없으면 보지 않는다.
- 핸드북 분석이 모노레포·브라우저 앱에서도 구조를 바로 본다. 실제 프로젝트(React·Vite 모노레포)로 끝까지 돌려 보니 세 곳이 빗나갔다. (GEN-44)
  - import 간선: tsconfig `paths` 별칭(`@/…`)과 워크스페이스 패키지(`@acme/ui`)를 못 따라가 군집 응집도가 틀렸다. 이제 가장 가까운 tsconfig의 별칭과 `package.json` `name`(`exports['.'].source` → `src/index`)으로 푼다. 그 프로젝트에서 간선이 507 → 766이 됐다.
  - 데이터 쓰기 지점: 브라우저 저장을 못 봤다. 이제 IndexedDB(`objectStore('x').put`·`db.put('x')`)·Web Storage(`setItem`)를 잡는다. Zustand `set({ a })`·`setState({ a, b })`는 필드마다 센다. 테스트 파일은 데이터 주인에서 뺀다. 쓰기 대상이 2 → 32가 됐다.
  - 결정 기록: `docs/decisions`에서만 찾아 ADR 47개를 놓쳤다. 이제 흔한 ADR 폴더(`docs/adr` 등)를 함께 읽는다. `.dt-handbook.json` `sources.decisions.dirs`로 폴더를 더할 수 있다.
- 핸드북 게이트 G2가 군집 폴더를 하나하나 본문에 요구하지 않는다. 예전에는 군집을 묶어 설명해도 폴더 70개짜리 색인표를 붙여야 통과했다. (GEN-44)
  - 상위 폴더(두 단계 이상)를 적었으면 그 아래 폴더도 다룬 것으로 본다.
  - 테스트 폴더(`__tests__`·`e2e`·`fixtures` …)는 보지 않는다.
- 핸드북 추적 규격에 경계 종류 `Worker`·`Lock`·`Queue`·`Disk`·`External`과 진입점 종류 `ui`·`lifecycle`·`alternates`를 더했다. 브라우저 앱을 추적한 워커 셋이 저마다 이름을 지어 붙였기 때문이다. (GEN-44)
- `/dt-handbook`은 `tracker`·`wiki`가 없으면 MCP 연결 안내를 띄우지 않는다. 외부 공개 게이트(G8)는 Atlassian 말고도 Notion과 팀 설정(`.dt-confluence.json`·`.dt-worklog.json`)의 `site` 호스트 링크를 막는다. (GEN-13)

#### 스택·스캐폴드

- BE 스캐폴드 게이트(`gate.mjs --stack backend`)는 `--prisma`가 없으면 `stack.orm`이 prisma일 때만 Prisma 검사를 켠다. 문서의 `--prisma true` 고정을 지웠다. `--prisma true|false`는 덮어쓰기로 남는다. FE 게이트는 그대로다. (GEN-07)
- `stack-versions.json` 묶음을 나눴다: FE `tailwindcss`·`@tailwindcss/vite`는 `tailwindDevDependencies`로, BE `@prisma/client`·`prisma`·`@testcontainers/postgresql`은 `prismaDependencies`·`prismaDevDependencies`·`postgresqlDevDependencies`로. major 비교(스택 사전 점검)는 모든 묶음을 본다. (GEN-07)
- 스택 사전 점검: TypeORM·Drizzle은 `blocking`이 아니라 `adaptable`이다(리뷰 규칙 어댑터가 있다). 아키텍처 문서의 인증 "캐논"은 `stack.auth: passport-jwt`일 때의 기본값이고, `other`면 프로젝트 방식을 따른다. (GEN-05)

### 고침

잘못 동작하던 것을 바로잡았다. 각 항목은 "무엇이 잘못됐나 — 이제 어떻게 되나" 순서다.

- `modal-management` 규칙이 `NiceModal.register`를 한 번도 잡지 못하던 것 — 머리말 정규식에 백슬래시를 두 번 써서(`\\.`) 글자 그대로 `\`를 찾았다. 이제 잡는다. 규칙 머리말에 이중 백슬래시가 다시 들어오지 않게 테스트를 뒀다. (GEN-44)
- 리뷰 full 모드가 git을 못 쓰면 0개 파일을 검사하고 "Ready to merge: Yes"를 내던 것 — 이제 폴더를 훑고, 새 파일(untracked)도 보고, 검사 파일 수를 적고, 0개면 `Unknown`을 낸다. 스킬 문서의 기본 범위 설명도 "커밋 안 된 변경"에서 "프로젝트 전체"로 코드에 맞췄다. (GEN-28)
- new-module Phase 2의 Prisma 게이트가 마이그레이션을 빠뜨려도 늘 통과하던 것 — 인자(`migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`)가 스키마를 자기 자신과 비교했다. 이제 dev DB와 비교한다(`--from-schema-datasource`). (GEN-43)
- TypeORM·Drizzle 프로젝트에서 계층 규칙(서비스·컨트롤러·DTO의 ORM 직접 사용, 통합 테스트의 DB mock)이 하나도 걸리지 않던 것 — 이제 `stack.orm` 설정에 맞춰 검사한다. (GEN-05)
- 테스트를 `__tests__` 밖에 두거나 `*.spec.ts`로 짓는 프로젝트에서 테스트 파일 규칙(mock·대기 금지·전체 앱 부팅 등)이 하나도 걸리지 않던 것 — 이제 `testing` 설정에 맞춰 검사한다. (GEN-06)
- FE 테스트 규칙 `integration-no-hook-mocking`·`unit-business-hook`이 `vi.mock`만 보고 jest의 `jest.mock`을 놓치던 것 — 이제 `jest.mock`도 본다. (GEN-04)
- View·View 테스트 규칙(`pure-view-component`·`view-test-props-only`)이 `react-router-dom`만 보던 것 — 이제 스캐폴드가 까는 `react-router`에서 가져와도 걸린다. (GEN-07)
- 대기 금지 규칙(BE·FE `flaky-test-prevention`, FE `test-anti-patterns`)이 `jest.setTimeout(…)`(테스트 시간 한도)을 대기용 `setTimeout`으로 잡던 것 — Testcontainers 통합 테스트의 기본 설정이 막혔다. 이제 넘긴다. (GEN-43)
- 결정 로그 규칙의 검출 8개가 정규식 없이 아무것도 검사하지 않던 것 — 허용 레이어 밖 항목·이유 없는 항목은 정규식으로 잡고, 날짜 순서·제목 갱신은 `manual`로 적었다. (GEN-27)
- `/dt-worklog`가 완료 조건 체크박스를 markdown(`- [x]`)으로 써서 Jira에 체크박스가 아닌 `[x]` 글자로 저장되던 것 — 이제 체크박스가 든 설명은 HTML task list로 쓴다. 예전 규칙의 DoD 체크도 같은 문제였다. (GEN-09)
- `/dt-migrate`가 물을 수 없는 실행에서 확인 없이 `--write`로 쓰던 것 — 이제 미리보기로 끝낸다. (GEN-28)
- `fe-builder`가 없는 설정 키 `frontend.*`를 따르라고 하던 것 — 이제 기존 코드 패턴과 `paths.src`·`layout`·`stackCommands`를 따른다. (GEN-04)
- BE 새 프로젝트의 `prisma init`(Prisma 6.19+)이 Prisma 7 모양 스키마(generator `prisma-client` + `output` + dotenv를 읽는 `prisma.config.ts`)를 써서 캐논 `import { PrismaClient } from '@prisma/client'`가 깨지던 것 — 이제 프리셋이 고정 스키마 파일을 쓴다. (GEN-07)
- pnpm 10+에서 FE 새 프로젝트의 `pnpm add`가 설치 스크립트 패키지(esbuild·msw)를 막고 실패로 끝나던 것 — 이제 프리셋 `allowBuilds`를 `--allow-build`로 넘긴다. (GEN-07)
- BE 새 프로젝트가 패키지 관리자를 묻고도 명령은 `npm`으로 고정돼 있던 것, FE가 `npm create`와 `pnpm add`를 섞어 쓰던 것 — 이제 고른 패키지 관리자로 명령을 낸다. (GEN-07)
- 스캐폴드가 규칙·키트가 쓰는 패키지를 깔지 않던 것 — 이제 `@ebay/nice-modal-react`(`modal-management`), `react-router-dom`(에러 키트·테스트 예시)을 깐다. (GEN-07)
- `docs/refs/docker-runtime-hints.md`: colima에서 `DOCKER_HOST`만으로는 Ryuk이 호스트 소켓 경로를 마운트하다 실패하던 것 — 이제 `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`을 먼저 안내한다. (GEN-43)
- Atlassian 대응표에 v2 라벨 도구(`addLabelsToConfluenceContent`)와 이슈 웹 링크 도구(`createJiraIssueRemoteIssueLink`)가 없다고 적혀 있던 것 — 이제 둘 다 있다. (GEN-10)
- README 전체 목록이 접은 블록 설명(`description: >-`)을 `>-`로 적던 것(`dt-worklog-sync`·`auditor`). (GEN-09)
- BE 규칙 2개가 FE 규칙을 `relatedRules`로 가리키던 것, `flaky-test-prevention` 요약이 스킬 목록과 달랐던 것. (GEN-27)

### 내부 정리 (동작 변화 없음)

할 일은 없다. 플러그인을 고치는 사람에게만 필요한 내용이다.

- 스크립트가 글자 그대로 찾는 산출물 제목·상태 라벨(정의서 절·상태, 스펙 필수 절, interactions 소유 절, project-context 절, 결정 문서 절, 마무리 댓글 줄 이름)을 `scripts/lib/headings.mjs` 한곳으로 모았다. 값은 그대로라 산출물은 바뀌지 않는다. 두 곳에 복사돼 있던 interactions 소유 절 목록도 하나가 됐다. (GEN-15 일부)
- 코딩 규율 4원칙의 원본을 `docs/refs/coding-discipline.md` 하나로 모았다. FE·BE 스킬(이름 그대로)은 스택 예시만 둔다. 결정 로그·쉬운 글쓰기 규칙을 다시 적던 곳은 원본을 가리킨다. (GEN-26)
- FE·BE 스펙 파이프라인 공용 단계(실행 모드·정의서 게이트·헤더·역참조·변경 전파·상향 정합·상태·재실행·완료 알림)를 `docs/refs/spec-pipeline.md` 하나로 모았다. `dt-spec-generate-spec`은 548줄에서 289줄이 됐다(소스 입력·산출물 본문을 `references/`로). 동작은 그대로다. (GEN-26)
- 같은 이름 명령이 있는 스킬 15개를 `/` 메뉴에서 숨겼다(`user-invocable: false` — 모델은 계속 부른다). 명령은 인자 처리와 스킬 가리키기만 하고, `/dt-review`·`/dt-be-review`의 절차는 리뷰 스킬로 옮겼다. 구조 테스트가 스킬 300줄·명령 40줄 상한, 명령의 절차 절, 원본 규칙 문장의 재서술을 잡는다. (GEN-26)

## [0.15.0] - 2026-11-16

### 추가
- `/dt-adopt` — 기존 프로젝트를 정의서·스펙·결정 기록으로 들인다. 워커 `adopt-extractor`, 기계 추출 `scripts/adopt/` (GEN-29)
- `/dt-decision` — 팀 정책(TP)·프로젝트 결정(PD) 기록. 규칙을 끄는 override에는 근거 결정이 필요하다 (GEN-21)
- 공통 설정 `.dt.json`(`hooks`·`team.*`·`decisions.sharedDir`)과 공용 로더, `dt-wrap --init` (GEN-03, GEN-29)
- 스택 사전 점검 — 플러그인 기본 기술과 다르면 영역별로 묻고 PD로 남긴다 (GEN-31)
- 산출물 형식 검사기 `validateSpec.mjs`, 정의서 정합 게이트 `checkDefinitionDrift.mjs` (GEN-22, GEN-23)
- `dt-fullstack` 이름 있는 단계·선택 단계(e2e·감사·가이드·핸드북·마무리)·재개, `/dt-fullstack` (GEN-37)
- e2e 작성 워커 `e2e-author` (GEN-39)
- Atlassian MCP 도구 대응표 `docs/refs/atlassian-mcp.md` — v1·v2 모두 동작 (GEN-42)
- 버전 올리기 `scripts/release.mjs`, 이 변경 기록, 호환 정책, 산출물 형식 점검 `/dt-migrate` (GEN-25)
- 전체 테스트·CI, 플러그인 구조 검사, 금칙어 스캐너 (GEN-01, GEN-19, GEN-20)

### 변경
- 에이전트↔조율자 공용 프로토콜(반환 봉투·needsDecision·질문 묶음) — 에이전트 16개가 따른다 (GEN-35)
- 스펙 작성이 빈틈·모호함을 스스로 찾아 되묻고, 나머지는 가정으로 보고한다 (GEN-30)
- 리뷰어 dispatch·수리 루프를 빌더에서 조율자로 올렸다 — 격리 리뷰 (GEN-36)
- 막혔을 때 그만두지 않고 선택지(복구·우회·이어서 실행·중단)를 준다 (GEN-32)
- 게이트: 건너뜀은 실패, 규칙 검출 구현 (GEN-23). draft 구현 규칙, 스택 버전 고정 설치, 플랜 최신 여부(`specHash`), 정의서 계약 해시 버전 (GEN-24)
- FE 스펙도 FR 줄에 정의서 결속 `<!-- from: IF-n -->`를 단다 (GEN-29)
- `/dt-review`·`/dt-be-review`가 스킬 절차(설정 부트스트랩)를 따른다 (GEN-33)

### 고침
- FE·BE가 같은 `project-context.md`를 서로 덮어쓰던 것 (GEN-34)
- 형식 검사기가 이미 쓰던 스펙(옛 표 열 이름·원장 마커 없음)을 막던 것, 통합 `radix-ui` 패키지 미감지 (GEN-22·23 후속)
- Atlassian MCP v2에서 없어진 v1 도구를 부르던 것, 명령의 도구 허용 누락 (GEN-42)

### 산출물 형식 변경
- `docs/project-context.md` — 절 이름에 스택 접두어(`## FE 기술 스택` 등). 옛 형식·플러그인 밖 문서는 다음 스펙 작성 때 멈추고 옮길지 묻는다. 미리 보려면 `/dt-migrate`.
- `docs/specs/interactions.md` — `## FE 크로스페이지`·`## BE 크로스리소스` 절로 나뉜다. 옛 형식은 `/dt-migrate`가 FE 절 아래로 모은다.
- 새로 만드는 md·설정에 형식 버전 표시(`<!-- dt-schema: 종류@N -->`·`"$schemaVersion"`)가 붙는다. 없는 기존 파일은 구조로 판정하므로 **옮길 필요 없다**.
- 스펙(`specVersion` 1.1)·정의서(1.2) 형식은 바뀌지 않았다.

## [0.14.0] - 2026-09-29
- 사내판 0.14.0 반영 — 결정 로그 주석 규칙, worklog 릴리즈 마일스톤

## [0.13.0] - 2026-09-15
- `dt-handbook` — 코드 인수인계 핸드북 PDF

## [0.12.0] - 2026-09-14
- 설정이 없으면 스킬이 물러나지 않고 만들고 계속한다

그 이전은 git 기록을 본다.
