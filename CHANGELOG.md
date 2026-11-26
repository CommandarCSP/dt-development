# 변경 기록

이 플러그인의 바뀐 점을 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전의 뜻은 [호환 정책](docs/refs/compat-policy.md)이 정한다.

- 바꿀 때마다 맨 위 **미출시** 절에 적는다. 버전을 올릴 때 `node scripts/release.mjs <patch|minor|major>`가 이 절을 그 버전 절로 바꾼다.
- **산출물 형식 변경** 절은 사용자 프로젝트에 이미 있는 파일(스펙·project-context·설정 등)에 영향이 있을 때 쓴다. 옮기는 방법(`/dt-migrate`)이나 "옮길 필요 없음"을 함께 적는다.

## [미출시]

### 없앰
- **`/dt-explain`(문제 설명) 스킬·명령을 없앴다.** "설명해줘"·"왜 이래?"에 자동으로 걸려 간단한 질문에도 6절 틀과 한글 리뷰가 붙었고, 산출물이 없어 다른 흐름과 이어지지 않았다. 버그 기록은 `/dt-worklog`(Bug), 장애 정리는 `/dt-confluence`(장애 회고)가 맡는다. 호환 정책은 한 minor 동안 경고한 뒤 없애게 하지만, 팀 결정으로 바로 없앴다. 한글 검사의 `docType: explain`도 함께 없앴다 (GEN-13)

### 추가
- 가이드·핸드북 PDF 출력 설정 `docs/refs/doc-output.md`(읽는 곳 `scripts/lib/docOutput.mjs`) — `.dt-guide.json`·`.dt-handbook.json`이 같은 키로 받는다. `versionSource`(`auto` = package.json → Cargo.toml → pyproject.toml · `git-tag` · `file:<경로>`), `ticketKeyPattern`, `theme.{accent,font,logo}`, `pdf.pageSize`(`A4` · `A5` · `Letter` · `Legal`), `language`(목차·문서 제목 문구와 `<html lang>`). 핸드북도 `docs/handbook/theme.override.html`로 테마를 통째 바꿀 수 있다 (GEN-17)
- 핸드북 진입점 감지에 Express·Koa(router)·Fastify 라우트와 Next.js 파일 라우트(`app/**/page`·`route`, `pages/**`, `next` 의존이 있을 때만)를 더했다. 그 밖의 언어는 `.dt-handbook.json`의 `entrypoints.extraPatterns`(`ext`로 `.py`·`.go` 같은 파일도 읽는다)로 더한다 (GEN-17)
- UX 소스 어댑터 `docs/refs/ux-sources.md` — 소스 종류별 읽는 방법(Notion·Confluence는 MCP → 없으면 `WebFetch` → 그래도 안 되면 내보낸 파일·붙여 넣기를 묻는다), 주 소스 정하기, Figma·Notion 하는 일 → 도구 대응표(접두어 세 가지), 접두어를 찾는 Figma 사전 점검, 소스별 출처 표기 (GEN-14)
- API 규칙 프리셋 `docs/refs/api-conventions.md`와 `.dt.json`의 `conventions.preset`(`rest-v1` 기본 · `custom`) — 정의서 §3이 URL 규칙을 물을 때의 제안값. `custom`은 모양을 전제하지 않고 항목마다 묻는다(경로 규칙 없음 포함) (GEN-14)
- `/dt-devspec --primary <locator>` — 화면·기능의 존재를 다툴 때 기준이 되는 주 소스 (GEN-14)
- `scripts/handbook/sources.mjs` — 핸드북의 "왜" 근거 원천. 결정 기록(PD·TP)을 먼저 읽고(MCP 불필요), 위키는 `wiki`(confluence면 `doc-design`·`doc-guide` 라벨로 좁힘, markdown이면 `docs/wiki/design`·`guide`), 트래커는 `tracker: jira`일 때만. 옛 `sources.atlassian.enabled: off`는 MCP 원천만 끈다 (GEN-13)
- 트래커 어댑터의 `issue.read`(이슈 하나 읽기) (GEN-13)
- 공통 설정 `.dt.json`의 `gitFlow`(`baseBranch`·`mergeStrategy`·`branchPrefix`·`pushPolicy`)와 `scripts/gitFlow.mjs` — `/dt-git`의 기준 브랜치(예: `develop`)와 합치는 방식(`no-ff` 기본 · `squash` · `rebase` · `pr`)을 팀이 정한다. 명령 순서는 스크립트가 내고, 스킬은 미리보기·승인 뒤 한 단계씩 실행한다. `pr` 방식은 피처 브랜치를 push하고 `gh`·`glab`으로 PR을 열거나, 없으면 PR 만들기 주소(`gitWebUrl.mjs compare`)를 보인다. 설정이 없으면 예전과 같은 main · `--no-ff` · 머지 뒤 push다 (GEN-12)
- 공통 설정 `.dt.json`의 `wrap.steps`(기본 `commit` → `wiki` → `tracker`)와 `scripts/wrapState.mjs` — `/dt-wrap`의 단계와 순서를 팀이 정한다. `wiki`·`tracker`가 꺼진 단계는 한 줄로 알리고 건너뛰며, Stop 훅 알림 문구도 실제 단계로 만든다 (GEN-11)
- 위키 문서 규칙 팀 정책 `docs/policies/TP-003-wiki-docs.md` — 문서 7종(회의록·작업 보고·설계 문서·운영 가이드·회고·릴리즈 노트·장애 회고), 공통 머리(상태·담당자·검토일·관련 이슈·관련 결정·요약, 검토일은 설계·가이드만 6개월), 구역 6개 페이지 트리·제목 규칙·`doc-*` 라벨, 트래커 양방향 연결 (GEN-10)
- `scripts/wikiConfig.mjs` — 위키 설정 합치기(`sections`·`labelsByType`·`reviewMonths`), 제목·공통 머리(HTML·markdown)·markdown 경로. `/dt-confluence`의 템플릿 7종 (GEN-10)
- 공통 설정 `.dt.json`의 `wiki`(`confluence` 기본 · `markdown` · `notion` · `none`)와 `docs/refs/wiki-adapter.md`. `markdown`은 같은 템플릿으로 저장소 `docs/wiki/`에 쓴다. `/dt-worklog`의 관련 문서 찾기도 이 값을 따른다 (GEN-10)
- 작업 기록 규칙 팀 정책 `docs/policies/TP-002-task-records.md` — 계층(Epic → Story·Task·Bug가 기본 단위 → Sub-task는 나눌 때만, 크기 한 주 안), 설명 템플릿(배경·목표·완료 조건·참고), 진행 댓글·마무리 댓글 템플릿, 마무리 규칙(Done 전 마무리 댓글에 산출물이나 결정 사항). 관련 Confluence 문서가 있으면 댓글의 "관련 문서" 줄로 링크한다 (GEN-09)
- 작업 기록 프리셋 — `basic`(기본, TP-002)과 `org-guideline`(사내 가이드라인 v1.0: Sub-task 강제·1~3일·수행 Epic·날짜·산출물 필드·릴리즈 필수). 설정을 합치고 검사하는 `scripts/worklogConfig.mjs`(`--json`, 마무리 댓글 검사 `check-close`), 키 설명 `skills/dt-worklog-sync/references/presets/README.md` (GEN-09)
- git 호스트별 커밋·PR 주소 `scripts/gitWebUrl.mjs` — GitHub·GitLab·Bitbucket. 이름으로 모르는 사설 호스트는 지어내지 않고 묻는다(`gitHost`) (GEN-09)
- 공통 설정 `.dt.json`의 `tracker`(`jira` 기본 · `github` · `linear` · `none`)와 트래커 어댑터 문서 `docs/refs/tracker-adapter.md`. 연동은 Jira만, GitHub·Linear는 스텁, `none`은 정리한 작업을 마크다운으로만 보인다 (GEN-09)
- `CONTRIBUTING.md` — 폴더 구분·이름·언어·머리말 형식, 리뷰 규칙 하나 추가 따라 하기, 올리기 전 점검 (GEN-27)
- 리뷰 규칙 머리말 스키마 `docs/refs/rule-frontmatter.schema.json`과 검사기 `scripts/validateRules.mjs` — 필수 필드·severity·검출 type과 type별 필수 인자·relatedRules (GEN-27)
- README 전체 목록 자동 생성 `scripts/readmeCatalog.mjs` (GEN-27)
- 스킬 동작 평가 `evals/` — `claude plugin eval` 형식 4건(dt-spec·dt-be-spec·dt-review·dt-migrate), 예제 프로젝트를 만들어 실제로 돌리고 결정적 채점기로 본다. CI에는 넣지 않고 손으로 돌린다(`evals/README.md`) (GEN-28)
- 스택 명령 고르기 `scripts/stackCommands.mjs` — 패키지 관리자(pnpm·npm·yarn)·테스트 도구(vitest·jest)를 스택 설정 `packageManager`·`testRunner` → package.json → lockfile 순으로 고르고, 설치·테스트·커버리지·수용 e2e·개발 서버 명령을 낸다(`commands.*`로 직접 적기). 리뷰 커버리지(GEN-08)·스캐폴드 게이트·e2e·가이드 스킬이 이것을 쓴다. 설정이 없고 지금 조합이면 명령은 그대로다 (GEN-08·GEN-04)
- 폴더 구조 바꿔 끼우기 — 규칙은 표준 경로(`src/…`·`e2e/…`)로 두고, 리뷰 엔진이 스택 설정 `paths.src`·`paths.e2e`·`layout`으로 프로젝트 경로로 바꾼다. 지금까지는 `src/`가 아닌 프로젝트에서 검사 파일이 0개가 되어 "Ready to merge: Yes"를 냈다 (GEN-04)
- 스택 설정 `apiPrefix` — 스펙의 API 주소에서 도메인을 뽑을 때 `/api` 말고 `/v1`·접두어 없음(`GET /posts`)·여러 접두어를 받는다. `/api/v1/…`의 버전 조각은 건너뛴다 (GEN-04)
- 스택 설정 키 전체의 원본 `docs/refs/stack-config.md` (GEN-04)
- 테스트 파일 이름·자리 바꿔 끼우기 — 스택 설정 `testing.location`(`__tests__`·`colocated`)·`testing.suffix.{unit,integration,e2e,any}`·`paths.test`로 리뷰 엔진이 테스트 규칙의 경로와 "테스트가 있어야 한다" 규칙이 찾는 이름을 바꾼다. NestJS 관례(`posts.service.spec.ts`·`test/app.e2e-spec.ts`) 예시는 `docs/refs/stack-config.md` §3. 설정이 없으면 그대로다 (GEN-06)
- BE 스택 어댑터 `scripts/stackAdapters.mjs` — 스택 설정 `stack.orm`(`prisma`·`typeorm`·`drizzle`·`none`)·`stack.db`·`stack.cache`·`stack.queue`·`stack.auth`. 적지 않으면 package.json(DB는 `schema.prisma` provider)에서 대안만 감지하고, 없으면 기본값(prisma·postgresql·redis·bullmq·passport-jwt)이다. 리뷰 엔진이 ORM 규칙의 빈칸(`"$orm.access"`·`{{orm.mockRegex}}`)을 그 ORM으로 채우고, `none`인 영역의 규칙(머리말 `requiresStack`)은 건너뛴다. 보고서 끝에 고른 스택과 근거가 나온다. `--json`의 `container`로 `be-builder`·e2e 작성이 DB별 Testcontainers 모듈을 고른다. 설정 없는 Prisma 프로젝트의 규칙은 그대로다 (GEN-05)
- 스캐폴드 스택 프리셋 `templates/presets/{fe,be}/*.json`과 `scripts/scaffoldPreset.mjs` — 새 프로젝트의 생성·설치 명령, `playwright.config.ts`·`docker-compose.yml`·`.env`·`prisma/schema.prisma`, 스택 설정 조각을 프리셋 + 패키지 관리자(`--pm npm|pnpm|yarn`)로 낸다. FE `vite-tailwind`(기본)·`vite-css-vars`, BE `nest-prisma-postgres`(기본)·`nest-prisma-mysql`. 선택 묶음 `--with auth|sentry`. 두 체크리스트의 고정 명령(`pnpm add`·`npm i`·5173·Postgres compose)을 이것으로 바꿨다. 설치 버전은 `stack-versions.json` 묶음 이름으로만 고른다(묶음을 tailwind·cssVars·prisma·postgresql·mysql로 나눴다. `stackVersions.mjs --group`) (GEN-07)
- TypeORM 스캐폴드 프리셋 `nest-typeorm-postgres` — TypeORM 0.3 + PostgreSQL 16, 마이그레이션 CLI 연결 `src/database/data-source.ts`와 package.json `migration:*` 스크립트를 낸다. 모듈 체크리스트(new-module·extend-module)의 Phase 1·2를 ORM별로 나눴다: 스키마 계약(prisma `schema.delta.prisma` · typeorm `entities/*.entity.ts`, 예시 `examples/order.entity.ts`), 마이그레이션, 트랜잭션 자리(Repository 메서드 안). `be-builder`·`plan-author`도 그 절을 따른다. 스펙의 Prisma 스케치는 모델 표기로 두고 TypeORM이면 엔티티로 옮긴다 (GEN-43)
- 스캐폴드 게이트 `gate.mjs --orm-check schema|migrations|off` — `stack.orm`에 맞는 ORM 검사를 고른다(`stackAdapters.mjs`의 `ORM_GATE_CHECKS`). prisma `validate`·`migrate diff`, typeorm `migration:generate --check`(모델을 바꾸고 마이그레이션을 빠뜨리면 실패). 옛 `--prisma`·`--prisma-args`도 받는다 (GEN-43)
- FE 스택 설정 `stack.styling`(`tailwind`·`css-vars`·`scss`, 없으면 `tailwindcss`·`sass` 감지 → `tailwind`) — 토큰 출력 방식과 `view-styling` 검사를 맞춘다. 빈칸(`"$styling.forbiddenStyleImports"`)이 비어 검출이 안 남은 규칙은 건너뛰고 보고서에 `규칙(stack.styling = scss)`로 적는다. 설정이 없는 Tailwind 프로젝트의 규칙은 그대로다 (GEN-07)
- 토큰 출력 방식 `materialize-tokens.mjs --emit tailwind|css-vars|scss` — `@theme` · `:root` · `src/styles/_tokens.scss`의 `$변수`. 변수 이름은 같고, 없으면 `stack.styling`을 따른다. Tailwind 출력은 그대로다 (GEN-07)
- 선택 참고 문서 `docs/refs/docker-runtime-hints.md` — colima·rancher-desktop·podman 소켓, Ryuk 끄기. 규칙·체크리스트·`be-builder`에 흩어져 있던 값을 모았다 (GEN-06)

### 고침
- Atlassian 대응표에 v2 라벨 도구(`addLabelsToConfluenceContent`)와 이슈 웹 링크 도구(`createJiraIssueRemoteIssueLink`)를 더했다 — 스킬이 "없다"고 적고 있었다 (GEN-10 실기록에서 발견)
- `/dt-worklog`가 완료 조건 체크박스를 markdown(`- [x]`)으로 써서 Jira에 체크박스가 아닌 `[x]` 글자로 저장되던 것 — 체크박스가 든 설명은 HTML task list로 쓴다(예전 규칙의 DoD 체크도 같은 문제였다) (GEN-09 DEV-14 기록에서 발견)
- README 전체 목록이 접은 블록 설명(`description: >-`)을 `>-`로 적던 것(`dt-worklog-sync`·`auditor`) (GEN-09)
- new-module Phase 2의 Prisma 게이트 인자(`migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`)가 스키마를 자기 자신과 비교해 마이그레이션을 빠뜨려도 늘 통과하던 것 — dev DB와 비교한다(`--from-schema-datasource`) (GEN-43)
- 대기 금지 규칙(BE·FE `flaky-test-prevention`, FE `test-anti-patterns`)이 `jest.setTimeout(…)`(테스트 시간 한도)을 대기용 `setTimeout`으로 잡던 것 — Testcontainers 통합 테스트의 기본 설정이 막혔다 (GEN-43 실설치에서 발견)
- `docs/refs/docker-runtime-hints.md`: colima에서 `DOCKER_HOST`만으로는 Ryuk이 호스트 소켓 경로를 마운트하다 실패하던 것 — `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock`을 먼저 안내한다 (GEN-43 실설치에서 발견)
- 스캐폴드가 규칙·키트가 쓰는 패키지를 깔지 않던 것 — `@ebay/nice-modal-react`(`modal-management`), `react-router-dom`(에러 키트·테스트 예시) (GEN-07)
- View·View 테스트 규칙(`pure-view-component`·`view-test-props-only`)이 `react-router-dom`만 보고, 스캐폴드가 까는 `react-router`에서 가져오면 걸리지 않던 것 (GEN-07)
- BE 새 프로젝트의 `prisma init`(Prisma 6.19+)이 Prisma 7 모양 스키마(generator `prisma-client` + `output` + dotenv를 읽는 `prisma.config.ts`)를 써서 캐논 `import { PrismaClient } from '@prisma/client'`가 깨지던 것 — 프리셋이 고정 스키마 파일을 쓴다 (GEN-07 실설치에서 발견)
- pnpm 10+에서 FE 새 프로젝트의 `pnpm add`가 설치 스크립트 패키지(esbuild·msw)를 막고 실패로 끝나던 것 — 프리셋 `allowBuilds`를 `--allow-build`로 넘긴다 (GEN-07 실설치에서 발견)
- BE 새 프로젝트가 패키지 관리자를 묻고도 명령은 `npm`으로 고정돼 있던 것, FE가 `npm create`와 `pnpm add`를 섞어 쓰던 것 (GEN-07)
- TypeORM·Drizzle 프로젝트에서 계층 규칙(서비스·컨트롤러·DTO의 ORM 직접 사용, 통합 테스트의 DB mock)이 하나도 걸리지 않던 것 — 위 `stack.orm`으로 (GEN-05)
- 테스트를 `__tests__` 밖에 두거나 `*.spec.ts`로 짓는 프로젝트에서 테스트 파일 규칙(mock·대기 금지·전체 앱 부팅 등)이 하나도 걸리지 않던 것 — 위 `testing` 설정으로 (GEN-06)
- FE 테스트 규칙 `integration-no-hook-mocking`·`unit-business-hook`이 `vi.mock`만 보고 jest의 `jest.mock`을 놓치던 것 (GEN-04)
- `fe-builder`가 없는 설정 키 `frontend.*`를 따르라고 하던 것 — 기존 코드 패턴·`paths.src`·`layout`·`stackCommands`로 (GEN-04)
- 리뷰 full 모드가 git을 못 쓰면 0개 파일을 검사하고 "Ready to merge: Yes"를 내던 것 — git 실패 시 폴더를 훑고, 새 파일(untracked)도 보고, 검사 파일 수를 적고, 0개면 `Unknown`. 스킬 문서의 기본 범위 설명("커밋 안 된 변경")도 코드와 맞춰 "프로젝트 전체"로 (GEN-28 평가에서 발견)
- `/dt-migrate`가 물을 수 없는 실행에서 확인 없이 `--write`로 쓰던 것 — 미리보기로 끝낸다 (GEN-28 평가에서 발견)
- 결정 로그 규칙의 검출 8개가 정규식 없이 아무것도 검사하지 않던 것 — 허용 레이어 밖 항목·이유 없는 항목은 정규식으로 잡고, 날짜 순서·제목 갱신은 `manual`로 (GEN-27)
- BE 규칙 2개가 FE 규칙을 `relatedRules`로 가리키던 것, `flaky-test-prevention` 요약이 스킬 목록과 달랐던 것 (GEN-27)

### 변경
- 스크립트가 글자 그대로 찾는 산출물 제목·상태 라벨(정의서 절·상태, 스펙 필수 절, interactions 소유 절, project-context 절, 결정 문서 절, 마무리 댓글 줄 이름)을 `scripts/lib/headings.mjs` 한곳으로 모았다. 값은 그대로라 산출물은 바뀌지 않는다. 두 곳에 복사돼 있던 interactions 소유 절 목록도 하나가 됐다 (GEN-15 일부)
- **가이드·핸드북의 티켓 키 검사는 키 형식을 알 때만 막는다.** 예전에는 아무 `대문자-숫자`나 사내 티켓으로 막아 `ES-2015`·`PEP-8`이 걸렸고, 핸드북 `audience: external`은 `UTF-8`·`ISO-8601`까지 막았다. 이제 `ticketKeyPattern` → 트래커 설정의 `defaultProjectKey`(`SHOP`이면 `SHOP-123`만) → `issueKeyPattern` 순으로 찾고, 없으면 보지 않는다. 예전처럼 다 막으려면 `"ticketKeyPattern": "[A-Z][A-Z0-9]+-\\d+"`를 적는다 (GEN-17)
- **`/dt-devspec`은 Figma 없이도 시작한다.** 기획 문서(Notion·Confluence·PDF·Markdown)에서 목차 → 화면·기능 후보 → 인터페이스 후보 → 규칙 문장을 뽑는 절차를 두었고(`skills/dt-devspec/references/source-discovery.md`), Figma는 있으면 함께 쓴다. 충돌 정리의 "원본(Figma) 우선"은 "주 소스 우선"이 됐다. Figma 사전 점검도 새로 들어갔다 (GEN-14)
- **Figma 화면의 오른쪽 주석 틀만 읽는 판별은 opt-in이 됐다.** 기본은 데이터가 오가는 화면을 통째로 한 번 읽는다. 화면을 [왼쪽 UI]+[오른쪽 주석]으로 그리는 팀은 `.dt.json`에 `"uxSources": { "figma": { "annotationLayout": "right-panel" } }`을 넣으면 예전과 같다 (GEN-14)
- `dt-spec` Figma 사전 점검이 연결 방식별 접두어(`plugin_figma_figma`·`claude_ai_Figma`·`figma`)를 찾아 쓴다 — 예전에는 한 가지 이름으로만 확인해 다른 방식으로 연결한 사람은 "연결 안 됨"이 됐다 (GEN-14)
- `/dt-audit` 후속 기록이 `tracker`를 따른다 — `jira`면 코드 수정 묶음을 Task 하나로(완료 조건 = finding 해소), 아니면 `docs/audits/pending.md`가 백로그. 기록한 이슈 키를 `traceability.md`의 "후속 기록" 표에 되적어, 다음 감사가 잔존 finding 옆에 진행 상태를 보이고 "이슈는 완료인데 finding이 남음"을 따로 알린다 (GEN-13)
- `/dt-handbook`은 `tracker`·`wiki`가 없으면 MCP 연결 안내를 띄우지 않는다. 외부 공개 게이트(G8)는 Atlassian 말고도 Notion과 팀 설정(`.dt-confluence.json`·`.dt-worklog.json`)의 `site` 호스트 링크를 막는다 (GEN-13)
- 훅이 `gitFlow.baseBranch`를 따른다 — 시작 알림은 기준 브랜치 위에서 뜨고, 마무리 알림의 통합 문구는 기준 브랜치·`pr`·`pushPolicy: none`을 반영한다. `dt-git-flow`의 상태 스크립트는 `isBase`·`baseBranch`를 낸다(`isMain`은 0.16.x 동안 남긴다) (GEN-12)
- **Stop 훅 기준점을 마무리 루틴으로.** `/dt-wrap`을 마치면 `.dt-pipeline.local.json`의 `lastWrapSha`에 HEAD를 남기고(단계를 건너뛰어도), 훅은 이 값과 옛 `lastSyncSha` 중 더 최근 것부터 정리 안 된 커밋을 센다. 트래커를 안 쓰거나 기록을 건너뛰어도 마무리 뒤에는 알림이 조용하다. `/dt-wrap --init`은 이 파일을 `.gitignore`에 더하고, 트래커·위키를 쓰는지 묻는다. 설정이 없는 프로젝트의 단계와 알림 문구는 예전과 같다 (GEN-11)
- `/dt-wrap` 단계 설명을 TP-002·TP-003 기준으로 고쳤다 — 기록 단위는 Story·Task·Bug(Sub-task는 나눌 때만), 완료 조건은 HTML 체크박스, 문서 종류는 7종 중에서 권한다 (GEN-11)
- **`/dt-confluence` 문서 종류를 4종에서 7종으로.** `worklog`는 `report`(작업 보고)로 이름이 바뀌고, `techdoc`은 설계 문서(`design`)와 운영 가이드(`guide`)로 나뉘고, 회고의 릴리즈노트 모드는 `release`로 따로 섰다. 옛 이름은 0.16.x 동안 받는다(`worklog`는 경고 후 `report`, `techdoc`은 어느 쪽인지 묻는다). 모든 문서 맨 위에 공통 머리가 붙고, 종류별 구역 페이지 아래에 들어간다(없으면 묻고 만든다). 옛 `parentPageId`는 구역 페이지가 없는 종류의 부모로 쓰고 경고한다 (GEN-10)
- **`/dt-worklog` 기본 규칙을 사내 가이드라인에서 TP-002로.** 새 프로젝트는 Story·Task·Bug에 설명·진행·마무리 댓글로 기록하고, Sub-task·날짜·"수행" Epic·산출물 커스텀 필드를 강제하지 않는다. 커밋 주소도 GitLab 고정이 아니라 호스트에 맞춘다. **이미 쓰던 설정은 그대로다** — `preset` 없이 옛 키(`issueTypeNames`·`transitionMap`·`outputFieldName`·`outputFieldId`)가 있으면 `org-guideline`으로 읽고 "`preset`을 적으라"고 경고한다. 옛 키는 0.16.x 동안 함께 받는다(새 키 `issueTypes`·`transitions`·`outputField`). 위저드는 프리셋을 묻는다(기본 `basic`). `references/jira-guideline.md`·`output-field-rules.md`는 `references/presets/org-guideline.md` 하나로 합쳤다 (GEN-09)
- 스캐폴드 게이트(`gate.mjs --stack backend`)는 `--prisma`가 없으면 `stack.orm`이 prisma일 때만 Prisma 검사를 켠다. 문서의 `--prisma true` 고정을 지웠다 — `--prisma true|false`는 덮어쓰기로 남는다. FE 게이트는 그대로다 (GEN-07)
- 리뷰 보고서의 건너뛴 규칙 줄: `건너뛴 규칙(stack.<영역> = none): 규칙(영역)` → `건너뛴 규칙(스택에 맞지 않음): 규칙(stack.영역 = 값)` (GEN-07)
- `stack-versions.json` 묶음 나누기: FE `tailwindcss`·`@tailwindcss/vite`는 `tailwindDevDependencies`로, BE `@prisma/client`·`prisma`·`@testcontainers/postgresql`은 `prismaDependencies`·`prismaDevDependencies`·`postgresqlDevDependencies`로. `stackVersions.mjs --deps|--dev`만 쓰던 곳은 `scaffoldPreset.mjs`로 바꾼다. major 비교(스택 사전 점검)는 모든 묶음을 본다 (GEN-07)
- BE 규칙 이름을 계층 기준으로: `repository-only-prisma` → `repository-only-orm`, `controller-no-direct-prisma` → `controller-no-direct-orm`, `service-no-direct-prisma` → `service-no-direct-orm`, `dto-no-prisma-import` → `dto-no-orm-import`. 규칙 끄기(`overrides`)는 규칙 이름을 쓰지 않아 설정은 그대로 둔다 — 보고서·CI에서 옛 이름을 찾고 있었다면 바꾼다. `service-requires-unit-test`는 `src/prisma/**`의 서비스에도 단위 테스트를 요구하지 않는다 (GEN-05)
- 스택 사전 점검: TypeORM·Drizzle은 `blocking`이 아니라 `adaptable`(리뷰 규칙 어댑터가 있다). 아키텍처 문서의 인증 "캐논"은 `stack.auth: passport-jwt`일 때의 기본값으로 — `other`면 프로젝트 방식을 따른다 (GEN-05)
- 리뷰 엔진을 `skills/dt-frontend-review/scripts/`에서 공용 자리 `scripts/review/`로(테스트는 `tests/review/`). **옛 경로 `skills/dt-frontend-review/scripts/review.mjs`는 경고를 내고 새 엔진을 부른다 — 0.17.0에서 지운다** (GEN-08)
- 코딩 규율 4원칙의 원본을 `docs/refs/coding-discipline.md` 하나로 — FE·BE 스킬(이름 그대로)은 스택 예시만 둔다. 결정 로그·쉬운 글쓰기 규칙을 다시 적던 곳은 원본을 가리킨다 (GEN-26)
- FE·BE 스펙 파이프라인 공용 단계(실행 모드·정의서 게이트·헤더·역참조·변경 전파·상향 정합·상태·재실행·완료 알림)를 `docs/refs/spec-pipeline.md` 하나로. `dt-spec-generate-spec`은 548줄 → 289줄(소스 입력·산출물 본문을 `references/`로), 동작은 그대로 (GEN-26)
- 진입점을 하나로: 같은 이름 명령이 있는 스킬 15개는 `/` 메뉴에서 숨긴다(`user-invocable: false` — 모델은 계속 부른다). 명령은 인자 처리와 스킬 가리키기만 하고, `/dt-review`·`/dt-be-review`의 절차는 리뷰 스킬로 옮겼다. 구조 테스트가 스킬 300줄·명령 40줄 상한, 명령의 절차 절, 원본 규칙 문장의 재서술을 잡는다 (GEN-26)

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
