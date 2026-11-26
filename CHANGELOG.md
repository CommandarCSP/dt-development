# 변경 기록

이 플러그인의 바뀐 점을 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전의 뜻은 [호환 정책](docs/refs/compat-policy.md)이 정한다.

- 바꿀 때마다 맨 위 **미출시** 절에 적는다. 버전을 올릴 때 `node scripts/release.mjs <patch|minor|major>`가 이 절을 그 버전 절로 바꾼다.
- **산출물 형식 변경** 절은 사용자 프로젝트에 이미 있는 파일(스펙·project-context·설정 등)에 영향이 있을 때 쓴다. 옮기는 방법(`/dt-migrate`)이나 "옮길 필요 없음"을 함께 적는다.

## [미출시]

### 추가
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
