# 스택 설정 (.dt-frontend.json · .dt-backend.json)

프로젝트 루트의 스택 설정 파일이 갖는 키 전체다. 없으면 `stack-config-bootstrap.md` 절차로 만든다. **모든 키는 적지 않아도 된다** — 적지 않으면 아래 "기본" 열대로 동작하고, 그것이 플러그인이 처음부터 전제한 구조(`src/` + FE pnpm·vitest / BE npm·jest + `/api/...`)다.

| 키 | 기본 | 뜻 | 읽는 곳 |
|---|---|---|---|
| `$schemaVersion` | 1 | 설정 형식 버전 | `/dt-migrate` |
| `paths.src` | `"src"` | 규칙의 표준 `src/` 자리. `"app"`, `"packages/web/src"`, `"."`(루트) | 리뷰 엔진 |
| `paths.e2e` | `"e2e"` | 규칙의 표준 `e2e/` 자리 | 리뷰 엔진 |
| `paths.test` | `"test"` | BE 규칙의 표준 `test/`(e2e) 자리 | 리뷰 엔진 |
| `testing.location` | `"__tests__"` | 테스트 파일 자리. `"colocated"`면 소스 옆(`posts.service.spec.ts`) | 리뷰 엔진 |
| `testing.suffix.<종류>` | 아래 §3 | 테스트 파일 이름 꼬리. 종류: `unit` · `integration` · `e2e` · `any` | 리뷰 엔진 |
| `layout` | `{}` | `src` 아래 층 폴더 이름 바꾸기. 키·값 모두 `src` 기준 | 리뷰 엔진 |
| `packageManager` | lockfile 감지 | `pnpm` · `npm` · `yarn` | 명령 고르기 |
| `testRunner` | package.json 감지 | `vitest` · `jest` | 명령 고르기 |
| `commands.<이름>` | 고른 값 | 명령을 직접 적는다. 이름: `install` · `test` · `coverage` · `accept` · `acceptLive` · `dev`. 문자열은 셸, 배열은 `[명령, ...인자]` | 명령 고르기 |
| `apiPrefix` | `"/api"` | 스펙의 API 주소 접두어(문자열 또는 배열). `""`이면 `GET /posts`처럼 메서드 뒤 주소에서 뽑는다. `/v1` 같은 버전 조각은 건너뛴다 | 도메인 뽑기(`parseSpecForScaffold.mjs`) |
| `stack.orm` | package.json 감지, 없으면 `"prisma"` | BE만. `prisma` · `typeorm` · `drizzle` · `none`. 계층 규칙이 검사하는 ORM | 리뷰 엔진·`be-builder` |
| `stack.db` | `schema.prisma` provider·드라이버 감지, 없으면 `"postgresql"` | BE만. `postgresql` · `mysql` · `sqlite` · `mongodb` · `sqlserver` · `none`. 테스트 컨테이너 고르기 | `be-builder`·e2e 작성 |
| `stack.cache` · `stack.queue` | `"redis"` · 감지 또는 `"bullmq"` | BE만. `none`이면 캐시·큐 규칙을 건너뛴다. 큐: `bullmq` · `bull` · `none` | 리뷰 엔진 |
| `stack.auth` | `"passport-jwt"` | BE만. `passport-jwt` · `other` · `none`. `other`면 아키텍처 문서의 인증 방식 대신 프로젝트 방식 | 스킬 문서 |
| `stack.styling` | package.json 감지(`tailwindcss`·`sass`), 없으면 `"tailwind"` | FE만. `tailwind` · `css-vars` · `scss`. 스타일 규칙·토큰 출력 방식 | 리뷰 엔진·`materialize-tokens.mjs` |
| `preset` | 없음 | 새 프로젝트를 만든 스캐폴드 프리셋 이름. 기록용이라 아무 동작도 바꾸지 않는다. 아래 §5 | 사람 |
| `coverage.mode` | `"full"` | `full` · `off` | 리뷰 엔진 |
| `coverage.baselineRef` | `"HEAD"` | 비교 기준 커밋 | 리뷰 스킬 |
| `coverage.newCodeThreshold` | 80 | 새 파일 줄 커버리지 하한(%) | 리뷰 엔진 |
| `coverage.baselineProtection` | `true` | 고친 파일이 기준보다 떨어지면 막는다 | 리뷰 엔진 |
| `overrides.<키>` | `{}` | 끌 수 있는 규칙 끄기. 근거 결정(`decisionRef`)이 있어야 한다 | 리뷰 엔진 |
| `enabledSkills` | 스택 스킬 4개 | 스킬 문서가 발동 조건으로 읽는다 | 스킬 |

## 1. 폴더 구조 (`paths`·`layout`)

규칙 파일은 표준 경로(`src/pages/**`, `src/business/hooks/**`, `e2e/**`)로 적혀 있다. 리뷰 엔진이 규칙을 읽을 때 이 설정으로 바꾼다(`scripts/review/lib/layout.mjs`).

```json
{ "paths": { "src": "app" }, "layout": { "business": "features", "components/domain": "widgets" } }
```

- `src/business/hooks/**` → `app/features/hooks/**`, `src/components/domain/**` → `app/widgets/**`. 키가 겹치면 긴 키가 먼저다.
- 바뀌는 곳: 규칙의 `appliesTo`·`excludePathPatterns`, import 규칙의 폴더 이름(`**/business/**` → `**/features/**`), 호출 규칙의 `matchArguments`.
- **리뷰가 "검사한 소스 파일 0개"를 내면** 먼저 `paths.src`를 본다.

## 2. 명령 고르기 (`packageManager`·`testRunner`·`commands`)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stackCommands.mjs" --stack frontend --project .   # 표
node "${CLAUDE_PLUGIN_ROOT}/scripts/stackCommands.mjs" --stack frontend --json       # 스킬이 읽는 형식
```

스킬·에이전트는 명령을 문서에 고정하지 않고 이 결과를 쓴다. 고르는 순서:

| 순서 | 어디서 | 패키지 관리자 | 테스트 도구 |
|---|---|---|---|
| 1 | `commands.<이름>` | 그대로 쓴다 | |
| 2 | `packageManager`·`testRunner` | `pnpm` · `npm` · `yarn` | `vitest` · `jest` |
| 3 | 프로젝트 `package.json` | `packageManager` 필드 | 의존성에 하나만 있으면 그것, 둘 다 있으면 `scripts.test` |
| 4 | lockfile | `pnpm-lock.yaml` · `yarn.lock` · `package-lock.json` | |
| 5 | 스택 기본값 | FE `pnpm` · BE `npm` | FE `vitest` · BE `jest` |

| 이름 | 고른 명령(`<실행>` = pnpm `pnpm exec` · npm `npx` · yarn `yarn`) | 쓰는 곳 |
|---|---|---|
| `install` | pnpm `install --prefer-frozen-lockfile` · npm `ci` · yarn `install --frozen-lockfile` | 리뷰 기준 커밋 설치 |
| `test` | `<실행> vitest run` · `<실행> jest` | 스캐폴드 게이트 |
| `coverage` | `test` + vitest `--coverage --coverage.reporter=json-summary` · jest `--coverage --coverageReporters=json-summary` | 리뷰 커버리지 |
| `accept` · `acceptLive` · `dev` | `<관리자> run test:accept` · `test:accept:live` · `dev` | 수용 e2e·가이드 캡처 |

- pnpm + vitest에 `test` 스크립트가 있으면 `coverage`는 지금까지처럼 `pnpm test --run --coverage --coverage.reporter=json-summary`다.
- 두 도구 모두 `coverage/coverage-summary.json`을 내야 리뷰가 읽는다.
- 모르는 `packageManager`·`testRunner` 값은 막고 고칠 방법을 알린다. 목록에 없는 도구(bun·mocha 등)는 `commands.*`로 적는다.

## 3. 테스트 파일 이름 (`testing`)

테스트 규칙은 `src/**/__tests__/**/*.unit.test.ts`, `test/**/*.e2e.test.ts` 같은 표준 이름으로 적혀 있다. 프로젝트가 다른 관례를 쓰면 리뷰 엔진이 이 설정으로 바꾼다. 바꾸지 않으면 테스트 파일을 검사하는 규칙이 하나도 걸리지 않는다.

| 종류 | 기본 꼬리 | 쓰는 규칙 예 |
|---|---|---|
| `unit` | `.unit.test` | 서비스 단위 테스트는 저장소를 mock 한다 |
| `integration` | `.integration.test` | 통합 테스트는 DB를 mock 하지 않는다 |
| `e2e` | FE `.spec`(`e2e/`) · BE `.e2e.test`(`test/`) | 전체 앱을 띄운다 |
| `any` | `.test` | 대기 금지처럼 모든 테스트에 거는 규칙(옆에 둘 때만 쓴다) |

NestJS 기본 관례:

```json
{
  "testing": {
    "location": "colocated",
    "suffix": { "unit": ".spec", "integration": ".integration.spec", "e2e": ".e2e-spec", "any": ".spec" }
  }
}
```

- `src/**/__tests__/**/*.unit.test.ts`는 `src/**/*.spec.ts`가 된다. `test/**/*.e2e.test.ts`는 `test/**/*.e2e-spec.ts`가 된다.
- "테스트가 있어야 한다" 규칙이 찾는 이름도 바뀐다(`__tests__/posts.controller.integration.test.ts` → `posts.controller.integration.spec.ts`). 검사는 지금처럼 `.spec`·옆자리 변형도 함께 받는다.
- 적지 않은 종류는 표준 이름 그대로다. `__tests__` 자리를 두고 꼬리만 바꿔도 된다.
- 꼬리가 겹치면(`unit` `.spec`과 `integration` `.integration.spec`) 단위 테스트 규칙에서 통합 테스트 파일을 뺀다.
- 옆에 두면 `src/pages/*.tsx`처럼 소스를 가리키는 규칙에서 테스트 파일을 뺀다. BE 구조 규칙의 테스트 제외 목록에도 설정한 꼬리를 더한다.
- 테스트 도구는 `testRunner`(§2)가 정한다. Docker 런타임 문제는 선택 참고 문서 [docker-runtime-hints.md](docker-runtime-hints.md)를 본다.
- 모르는 `location`·종류는 리뷰를 멈추고 고칠 방법을 알린다(종료 코드 2).

## 4. BE 스택 (`stack.*`)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stackAdapters.mjs" --project .          # 표
node "${CLAUDE_PLUGIN_ROOT}/scripts/stackAdapters.mjs" --project . --json   # 스킬·에이전트가 읽는 형식(container 포함)
```

고르는 순서: `.dt-backend.json`의 `stack.<영역>` → package.json 의존성(DB는 `prisma/schema.prisma`의 `provider`가 먼저) → 기본값. **감지는 대안만 고른다.** 아무것도 없으면 기본값이고, `none`은 설정으로만 정한다. 그래서 설정이 없는 Prisma 프로젝트의 규칙은 예전과 같다.

| ORM | 검사하는 import | 저장소 밖에서 가져와도 되는 자리 |
|---|---|---|
| `prisma` | `@prisma/client`, `prisma.service` | `src/prisma/**`, `prisma.service.ts` |
| `typeorm` | `typeorm`, `@nestjs/typeorm`, `data-source` | `*.entity.ts`, `entities/`, `migrations/`, `*.subscriber.ts`, `data-source.ts`, `src/database/`, `*.module.ts` |
| `drizzle` | `drizzle-orm`, `db`·`db/schema` | `src/db/`, `src/database/`, `schema.ts`, `*.schema.ts`, `*.module.ts` |

- 규칙 파일에는 ORM 이름 대신 빈칸(`"$orm.access"`, `{{orm.mockRegex}}`)을 적는다. 엔진이 위 표로 채운다(`scripts/stackAdapters.mjs`). 통합 테스트에서 금지하는 mock(TypeORM `getRepositoryToken(…), useValue` 등)과 단위 테스트에서 금지하는 실제 연결(`new DataSource(` 등)도 ORM마다 다르다.
- 규칙 머리말 `requiresStack: [orm]`인 규칙은 그 영역이 `none`이면 건너뛴다. 보고서에 "건너뛴 규칙"으로 적는다.
- 보고서 끝에 `스택: orm typeorm(package.json) · …`으로 무엇을 왜 골랐는지 나온다. ORM이 둘 이상이면 기본값으로 보고 "스택 주의"를 낸다 — `stack.orm`을 적는다.
- Sequelize·Mongoose·MikroORM 등 표에 없는 ORM은 어댑터가 없다. 스택 사전 점검이 `blocking`으로 묻는다(`stack-precheck.md`).
- 모르는 값은 리뷰를 멈추고 고칠 방법을 알린다(종료 코드 2).

## 5. 스캐폴드 프리셋과 FE 스타일 (`preset`·`stack.styling`)

새 프로젝트를 만들 때 무엇을 깔지는 프리셋이 정한다. 프리셋은 `templates/presets/<fe|be>/<이름>.json` 하나이고, 설치 버전은 `templates/stack-versions.json`의 묶음 이름으로만 고른다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffoldPreset.mjs" frontend --list
node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffoldPreset.mjs" backend --preset nest-prisma-mysql --pm pnpm --root api --with auth   # 실행할 명령
node "${CLAUDE_PLUGIN_ROOT}/scripts/scaffoldPreset.mjs" backend --preset nest-prisma-mysql --file compose                    # playwright · compose · env · config
```

| 스택 | 프리셋 | 내용 | 설정 조각 |
|---|---|---|---|
| FE | `vite-tailwind`(기본) | Vite + React + Tailwind v4 + shadcn/ui + MSW, dev 5173 | `stack.styling: tailwind` |
| FE | `vite-css-vars` | Tailwind 없이 CSS 변수 + CSS 모듈, `cn` = clsx | `stack.styling: css-vars` |
| BE | `nest-prisma-postgres`(기본) | NestJS + Prisma 6 + PostgreSQL 16 compose + Testcontainers Postgres | `stack.orm: prisma`, `stack.db: postgresql` |
| BE | `nest-prisma-mysql` | NestJS + Prisma 6 + MySQL 8.4 compose + Testcontainers MySQL | `stack.orm: prisma`, `stack.db: mysql` |

- 패키지 관리자는 `--pm`(없으면 프리셋 값: FE pnpm · BE npm). 생성·설치·실행 명령의 모양을 바꾼다(`pnpm add` · `npm i` · `yarn add`).
- `--file config`는 `.dt-*.json`에 넣을 조각(`preset`·`packageManager`·`stack.*`)이다. 리뷰·게이트·토큰이 같은 값을 읽는다.
- 선택 묶음: FE `--with sentry` · BE `--with auth`(Passport + JWT).
- TypeORM·Drizzle 프리셋은 아직 없다. 리뷰 규칙은 그 ORM을 지원한다(§4). 스캐폴드 게이트는 `stack.orm`이 prisma가 아니면 Prisma 검사를 끈다.

**FE 스타일(`stack.styling`)** — 고르는 순서는 설정 → package.json(`tailwindcss`·`@tailwindcss/vite` → `tailwind`, `sass` → `scss`) → `tailwind`. `css-vars`는 설정으로만 정한다.

| 값 | 토큰 출력(`materialize-tokens.mjs`) | `view-styling` 규칙 |
|---|---|---|
| `tailwind` | `src/styles/globals.css`의 `@theme { --color-x: … }` | CSS·SCSS import 금지(`globals.css`만 예외) |
| `css-vars` | `src/styles/globals.css`의 `:root { --color-x: … }` | SCSS import만 금지 — CSS 모듈은 된다 |
| `scss` | `src/styles/_tokens.scss`의 `$color-x: …;` | 검사하지 않는다(보고서에 "건너뛴 규칙") |

- 변수 이름은 세 방식 모두 같다(`--color-primary` · `$color-primary`). 마커 블록 밖은 건드리지 않는다.
- 규칙 파일은 빈칸 `"$styling.forbiddenStyleImports"`를 쓴다. 빈칸이 비어 검출이 하나도 안 남으면 엔진이 그 규칙을 건너뛰고 보고서에 `규칙(stack.styling = scss)`로 적는다.

