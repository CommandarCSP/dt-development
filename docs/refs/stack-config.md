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
