# dt-development 범용화 로드맵 (피처 분해)

- 작성일: 2026-11-13
- 목표: 특정 회사·프로젝트에 묶인 흐름과 값을 걷어내, 어느 팀·프로젝트에도 붙일 수 있는 플러그인으로 만든다.
- 원칙: 플러그인의 **의도된 의견**(FE 5계층 React, BE NestJS 계층형, 스펙 우선 SDD, dry-run→승인)은 유지한다. 그 밖에 **우연히 고정된 것**(회사 프로세스, 벤더, 스택 세부, 언어, 예시 데이터)만 설정·어댑터·프리셋으로 뺀다.
- 기본값 원칙: 설정이 없으면 지금 동작과 같게 둔다(하위 호환). 회사 규칙은 지우지 않고 "프리셋 하나"로 내린다.
- 이슈 관리: 피처 하나 = Jira 이슈 하나(DEV 프로젝트). 피처마다 이 문서의 ID(GEN-xx)를 이슈 제목 앞에 붙인다.

## Jira 대응표 (DEV 프로젝트, commandarcsp.atlassian.net)

| 에픽 | 피처 → 이슈 |
|---|---|
| DEV-1 [M0] | GEN-01 DEV-6 · GEN-02 DEV-7 · GEN-03 DEV-8 |
| DEV-2 [M1] | GEN-04 DEV-9 · GEN-05 DEV-10 · GEN-06 DEV-11 · GEN-07 DEV-12 · GEN-08 DEV-13 · GEN-43 DEV-52 |
| DEV-3 [M2] | GEN-09 DEV-14 · GEN-10 DEV-15 · GEN-11 DEV-16 · GEN-12 DEV-17 · GEN-13 DEV-18 |
| DEV-4 [M3] | GEN-14 DEV-19 |
| DEV-5 [M4] | GEN-15 DEV-20 · GEN-16 DEV-21 · GEN-17 DEV-22 |
| (에픽 없음) | GEN-18 DEV-23 (버그 — GEN-24가 흡수) · GEN-42 DEV-51 (버그 — Atlassian MCP v2, GEN-09·10과 겹침) |
| DEV-24 [M5] | GEN-19 DEV-25 · GEN-20 DEV-26 · GEN-21 DEV-27 · GEN-22 DEV-28 · GEN-23 DEV-29 · GEN-24 DEV-30 · GEN-25 DEV-31 · GEN-26 DEV-32 · GEN-27 DEV-33 · GEN-28 DEV-34 · GEN-40 DEV-49 |
| DEV-35 [M6] | GEN-29 DEV-36 · GEN-30 DEV-37 · GEN-31 DEV-38 · GEN-32 DEV-39 · GEN-33 DEV-40 · GEN-34 DEV-41 · GEN-35 DEV-42 · GEN-36 DEV-43 · GEN-37 DEV-44 · GEN-38 DEV-45 · GEN-39 DEV-46 · GEN-41 DEV-50 |

## 진행 순서

2026-11-13 3관점 리뷰(결과 일관성·플러그인 구조·팀 의사결정) 뒤 재정렬했다. 안전망 없이 큰 구조 변경을 하면 깨져도 모르므로 M5 앞부분을 M1~M4보다 먼저 한다.

같은 날 설계 4원칙(P1 단독 실행 · P2 유연한 되묻기 · P3 한 흐름 연결 · P4 전문 에이전트) 리뷰로 M6을 더했다. 원칙을 받치는 공용 규약(프로토콜·되묻기 정책)을 먼저 세우고, 그 위에서 개별 스킬을 고친다.

```
완료     ─ GEN-01 → GEN-02
1 안전망 ─ GEN-19 안전망 → GEN-20 구조 검사
2 공용 규약 ─ GEN-35 오케스트레이션 프로토콜(P4) → GEN-36 리뷰 루프 상향(P4 결함) → GEN-30 되묻기 정책(P2) → GEN-03 공통 설정(+팀 프로필)
3 결정 기록 ─ GEN-21 ADR(TP·PD)
4 원칙 적용 ─ GEN-33 · GEN-34 (결함) → GEN-32 하드 스톱 → GEN-31 스택 사전 점검
5 흐름 완성 ─ GEN-38 산출물 소유 경계 → GEN-39 전문 에이전트 보강 → GEN-37 dt-fullstack 확장
6 검증    ─ GEN-22 산출물 검증 → GEN-23 게이트 엄격화 → GEN-24 지침·재실행(GEN-18 흡수)
7 도입    ─ GEN-29 dt-adopt (GEN-21·22 이후)
7.5 후속   ─ GEN-42 Atlassian MCP v2 도구 이름(완료) · GEN-40 남은 AST 규칙 · GEN-41 에이전트 비용
8 유지보수 ─ GEN-25 버전(완료) → GEN-26 중복·진입점(완료 — GEN-08은 M1으로) → GEN-27 기여 가이드(완료) → GEN-28 evals(완료)
9 범용화  ─ M1~M4. GEN-09·10(새 Jira·Confluence 규칙)은 GEN-21 위에서 팀 정책(TP)으로 정한다.
```

---

## M0. 기반

### GEN-01 사내 식별자·실데이터 제거와 스캐너 상시화
- 문제: 플러그인 안에 사내 식별자 590건. 테스트 픽스처(`tests/guideGate|guideBuild|guideCapture.test.mjs`)에 실제 직원 이메일·홈 경로·사내 호스트, `dt-worklog-sync` 테스트에 고객사 코드명, 예시 곳곳에 사내 티켓 키·제품명·릴리즈 접두어·사내 Confluence URL.
- 할 일:
  - 픽스처를 중립 값(`jane.doe@example.com`, `/Users/alice`, `ACME`, `PROJ-1`)으로 교체.
  - 스킬 본문·patterns·references의 예시 티켓 키·팀명(정산팀/CS팀)·제품명을 중립 예시로 교체.
  - 금칙어 스캐너를 플러그인 테스트에 편입해 재유입 차단.
- 결정(2026-11-13): 엔진은 `scripts/scanForbidden.mjs`(내장 규칙: 이메일·cloudId, `npm run scan`·`npm test` 포함). 조직별 금칙어 목록은 목록 자체가 식별자라 저장소 밖 JSON(`--rules` / `DT_FORBIDDEN_RULES`)으로 받는다. 공개 GitHub 저장소를 단일 원본으로 삼는다.
- 완료 기준: 저장소에 올라갈 파일에서 스캔 0건(내장 규칙 + 조직 목록). — 완료(DEV-6)

### GEN-02 런타임 문서와 개발 이력 문서 분리
- 문제: 스킬이 배포되지 않는 설계 문서(모노레포 루트 `docs/superpowers/specs/...`)를 "설계 SOT"로 참조해, 설치한 사람에겐 링크가 끊긴다. `docs/plans`·사내판 `docs/specs`의 원 프로젝트 이력 문서가 플러그인 폴더 안에 있다.
- 결정(2026-11-13):
  - 스킬이 참조하는 설계 문서(dt-audit·dt-e2e·dt-be-e2e·dt-devspec 2건)는 식별자를 정리해 `docs/specs/`로 들여오고 링크를 고친다(가이드·핸드북·한글 규율 설계와 같은 방식).
  - 이력 문서(`docs/plans` 22개, 사내판 `docs/specs` 11개)는 저장소 밖 로컬 `dt_development/docs/history/plugin/`으로 옮긴다.
- 완료 기준: 런타임 파일(`skills/`·`agents/`·`commands/`·`scripts/`·`templates*/`)이 참조하는 문서가 모두 저장소 안에 있고, `docs/plans`·`docs/superpowers` 참조 0건.

### GEN-03 공통 설정 스키마와 로더
- 문제: 팀·프로젝트별로 달라야 할 값이 본문에 하드코딩. `.dt-frontend.json`은 `coverage`·`overrides`만 실제로 읽힘.
- 할 일:
  - `.dt-pipeline.json` 확장: `locale`, `tracker`(none|jira|github|linear), `wiki`(none|confluence|notion|markdown), `uxSources`, `gitFlow`, `models`(planner/builder/verifier 티어).
  - 공용 로더 `scripts/lib/config.mjs`(기본값 병합·검증·`.local.json` 오버레이).
  - `detectStackConfig.mjs`가 감지 결과로 초기값을 채움. 스키마 문서 `docs/refs/config-schema.md`.
- 완료 기준: 설정 없이 실행하면 현재 동작과 동일(회귀 테스트), 각 키가 문서화.
- **완료(DEV-8, 2026-11-13).** 결정: `.dt-pipeline.json`을 넓히지 않고 공통 설정 `.dt.json`(+개인 `.dt.local.json`)을 새로 둔다. 옛 파일은 `hooks` 자리로 계속 읽는다. 키는 **지금 읽는 곳이 있는 것만** 넣었다: `hooks.*`(훅), `team.execution`(정책 원칙 1), `team.models.{planner,builder,reviewer}`(dispatch 때 Agent `model` 덮어쓰기, 티어는 `AGENT_TIERS`), `team.locale`(ko만), `team.requiredMcp`(시작 시 연결 점검) — 정책 원칙 8. `tracker`·`wiki`·`uxSources`·`gitFlow`는 그 기능을 범용화할 때 읽는 곳과 함께 넣는다(GEN-09·10·12, M3). 로더 `scripts/lib/config.mjs`(병합·검증·경고, 던지지 않음, CLI), 스키마 `docs/refs/config-schema.md`, `/dt-wrap --init`이 `.dt.json`을 만들고 옛 파일을 옮긴다. 구조 테스트가 문서 표 ↔ 로더 키, 키마다 읽는 곳의 언급을 검사한다. 원래 할 일의 "`detectStackConfig.mjs`가 감지 결과로 초기값을 채움"은 이번 키 중 스택에 따라 달라지는 값이 없어, `--init`이 스택 설정 부트스트랩을 함께 돌리는 것으로 대신했다.

## M1. 기술 스택

### GEN-04 FE 설정 실연결(경로·명령·러너)
- 문제: 룰 `appliesTo`가 `src/...` 고정, `pnpm`·`vitest` 명령 하드코딩(`dt-frontend-review/scripts/lib/stacks.mjs`, `coverage.mjs`), `fe-builder`가 없는 `frontend.*` 키 참조, 도메인을 `/api/<seg>`에서만 추출(`parseSpecForScaffold.mjs`).
- 할 일: `.dt-frontend.json`에 `layout.*`, `packageManager`(lockfile 감지), `commands.{test,install,dev,accept}`, `testRunner`, `apiPrefix` 추가. 룰 로더가 `appliesTo`를 `layout` 기준으로 재작성.
- 완료 기준: `src` 대신 `app/` 레이아웃·npm·jest 조합 픽스처에서 리뷰 엔진 통과.
- **완료(DEV-9, 2026-11-16).** 경로: 규칙 49개는 표준 경로(`src/…`·`e2e/…`) 그대로 두고, 엔진이 읽을 때 `paths.src`·`paths.e2e`·`layout`(src 아래 층 이름, 긴 키 먼저)으로 `appliesTo`·`excludePathPatterns`·import `matches`·호출 `matchArguments`를 바꾼다(`scripts/review/lib/layout.mjs`). 할 일의 "`layout.*`"는 층 이름 지도 하나로 했다. 명령: `packageManager`·`testRunner`·`commands.{install,test,coverage,accept,acceptLive,dev}`를 `scripts/stackCommands.mjs` 하나가 고르고(CLI `--json`), 엔진 커버리지·스캐폴드 게이트·e2e·가이드 스킬이 쓴다. 구조 테스트가 스킬·에이전트 문서의 고정 명령을 잡는다(새 프로젝트 체크리스트는 GEN-07까지 예외). `apiPrefix`(문자열·배열·빈 값, 버전 조각 건너뜀)는 `parseSpecForScaffold`가 `projectRoot`의 설정에서 읽는다. jest 프로젝트를 위해 테스트 규칙 2개에 `jest.mock`을 더했다. 키 원본 `docs/refs/stack-config.md`. 완료 기준 픽스처: `app/` + `layout.business=features` + npm + jest 프로젝트가 같은 내용의 `src/` 프로젝트와 같은 위반 목록을 낸다(`tests/review/layout.test.mjs`). 템플릿·부트스트랩은 새 키를 넣지 않는다(적지 않으면 감지).

### GEN-05 BE 스택 어댑터(ORM·DB·캐시·큐·인증)
- 문제: 룰이 `@prisma/client`·`ioredis`·`new Queue(`를 문자 그대로 매칭 → 다른 ORM 프로젝트는 보호 없음. Passport+JWT를 "정석"으로 고정.
- 할 일: `.dt-backend.json`에 `stack.{orm,db,cache,queue,auth}`. 패턴 `matches`를 프리셋(prisma/typeorm/drizzle)에서 주입, 기능이 `none`이면 룰 skip. 룰 이름을 계층 기준(`repository-only-orm`)으로. `dt-bespec-collect-project-context` 감지표 확장 + 하위 스킬이 그 값을 읽게.
- 완료 기준: TypeORM 픽스처에서 계층 위반 룰이 동작.
- GEN-06에서 넘어옴: `testing.container` — DB별 Testcontainers 모듈 선택(Postgres·MySQL 등).
- **완료(DEV-10, 2026-11-24).** `scripts/stackAdapters.mjs` 하나가 `stack.{orm,db,cache,queue,auth}`를 설정 → package.json(DB는 `schema.prisma` provider 먼저) → 기본값 순으로 고른다. 감지는 대안만 고르고 `none`은 설정으로만 정해, 설정 없는 Prisma 프로젝트의 규칙은 예전 리터럴과 같다(지금 규칙을 저장해 비교했고 테스트로 고정). ORM 어댑터는 prisma·typeorm·drizzle·none — 규칙 파일은 ORM 이름 대신 빈칸(`"$orm.access"` 배열·`{{orm.mockRegex}}` 정규식)을 쓰고, 엔진이 어댑터 표로 채운 뒤 GEN-04·06의 경로 바꾸기를 한다(`scripts/review/lib/stack-rules.mjs`). 머리말 `requiresStack`인 규칙은 그 영역이 `none`이면 건너뛰고 보고서에 적는다. 규칙 이름은 계층 기준으로 4개 바꿨다(`repository-only-orm` 등, git mv). `validateRules`가 모르는 빈칸과, 어댑터마다 채운 정규식 오류를 잡는다. 사전 점검은 TypeORM·Drizzle을 `adaptable`로 본다. 프로젝트 맥락 스킬은 감지표를 따로 두지 않고 이 스크립트를 읽는다. `testing.container`는 `stack.db` → `--json`의 `container`(DB별 Testcontainers 모듈)로 `be-builder`·e2e 작성이 읽는다. 할 일과 다르게 한 것: 캐시·큐는 지원 라이브러리를 이미 잡아서 어댑터 대신 `none`(규칙 건너뛰기)만, 인증은 검사 규칙이 없어 아키텍처 문서를 "기본값"으로 바꾸는 것만 했다. `be-builder`의 Prisma 단계(스키마 델타·migrate·게이트 `--prisma`)와 스캐폴드 템플릿은 GEN-07 프리셋 몫이다 — 지금은 "다른 ORM이면 같은 역할로 바꾸고 형제 모듈을 따른다"고만 안내한다. 완료 기준 예제: 같은 계층 위반을 담은 TypeORM·Drizzle 프로젝트가 Prisma 프로젝트와 같은 위반 목록을 내고, 엔티티·마이그레이션·스키마 파일은 걸리지 않는다(`tests/review/stack-adapters.test.mjs`).

### GEN-06 BE 테스트 전략 설정화
- 문제: 파일명 규칙(`*.unit.test.ts`), Testcontainers Postgres, colima 소켓 경로, 커버리지 80/85% 고정.
- 할 일: `testing.{runner,unitGlob,integrationGlob,container}`, `coverage.newCodeThreshold`. DB별 컨테이너 선택. OS별 Docker 힌트는 선택 참고 문서로 분리.
- 완료 기준: `*.spec.ts` 규칙 프로젝트에서 `requires-sibling-test` 정상 동작.
- **완료(DEV-11, 2026-11-24).** 확인해 보니 `requires-sibling-test`는 이미 `.spec`·옆자리 파일을 받았다. 진짜 구멍은 테스트 파일을 검사하는 규칙(FE 14개·BE 9개)이 `__tests__/*.unit.test.ts`·`test/*.e2e.test.ts`에만 걸려, NestJS 관례(`*.spec.ts` 옆자리·`test/*.e2e-spec.ts`)나 FE 옆자리(`Card.test.tsx`) 프로젝트에서 위반을 하나도 못 잡던 것이다. GEN-04의 바꿔 끼우기를 넓혀 `testing.location`(`__tests__`|`colocated`)·`testing.suffix.{unit,integration,e2e,any}`·`paths.test`로 테스트 glob과 `testPath`를 바꾼다. 꼬리가 겹치면 단위 규칙에서 통합 테스트를 빼고, 옆자리면 한 층 소스 규칙(`src/pages/*.tsx`)·"테스트가 있어야 한다" 규칙에서 테스트 파일을 뺀다. BE 구조 규칙의 테스트 제외 목록에도 설정한 꼬리를 더한다. 구조 테스트가 테스트 규칙 경로가 모두 엔진이 아는 모양인지 본다. 할 일의 `testing.runner`는 GEN-04 `testRunner`로 끝났고, `unitGlob`·`integrationGlob`은 glob 대신 꼬리·자리 두 키로 했다. 커버리지 80%는 이미 `coverage.newCodeThreshold`(FE 규칙 문서에 키를 적었다), 85%는 권장 문구로 둔다. Docker 런타임별 값(colima·rancher-desktop 소켓, Ryuk 끄기)은 선택 참고 문서 `docs/refs/docker-runtime-hints.md` 한 곳으로 모았다(구조 테스트). **`testing.container`(DB별 컨테이너 선택)는 GEN-05로 넘긴다** — DB 종류를 정하는 어댑터가 거기 있고, 컨테이너 수명 규칙은 이미 `GenericContainer`·`@testcontainers` 전체를 잡는다. 완료 기준 픽스처: NestJS 관례 BE 프로젝트와 FE 옆자리 프로젝트가 `__tests__` 프로젝트와 같은 위반 목록을 낸다(`tests/review/testing-layout.test.mjs`).

### GEN-07 스캐폴드 스택 프리셋
- 문제: FE는 Vite+Tailwind v4+shadcn+MSW, 포트 5173 고정. 토큰 출력이 Tailwind `@theme` 전용. BE는 npm·Prisma·Postgres16 compose·JWT 패키지 고정, 게이트에 `--prisma true` 리터럴.
- 할 일: `presets/fe/*`, `presets/be/*` 스니펫(설치·init·compose·env). 기본 프리셋 = 현재 조합. 토큰 emitter 어댑터(tailwind|css-vars|scss). 게이트 플래그를 설정에서 전달.
- 완료 기준: 기본 프리셋으로 현재와 같은 결과, 대체 프리셋 1개 이상 동작.
- **완료(DEV-12, 2026-11-26).** 프리셋은 `templates/presets/{fe,be}/<이름>.json`(로드맵의 `presets/`를 스캐폴드 입력이 이미 있는 `templates/` 아래에 뒀다)이고, `scripts/scaffoldPreset.mjs`가 프리셋 + 패키지 관리자로 생성·설치 명령과 `playwright.config.ts`·compose·`.env`·`prisma/schema.prisma`·설정 조각을 낸다. 설치 버전은 `stack-versions.json` 묶음 이름으로만 고른다. 두 체크리스트의 고정 명령을 이것으로 바꿨고, 구조 테스트의 "명령 고정 없음" 예외를 지웠다. 기본 프리셋(`vite-tailwind`·`nest-prisma-postgres`)은 예전 체크리스트의 명령·playwright 설정과 같다(테스트로 고정). 다른 점은 고친 것들이다: 규칙이 쓰는데 깔지 않던 `@ebay/nice-modal-react`·`react-router-dom`, pnpm 10+의 설치 스크립트 차단(`--allow-build`), 6.19+ `prisma init`이 Prisma 7 모양을 쓰던 것(고정 스키마 파일). 뒤의 둘은 실설치에서 찾았다. 대체 프리셋 `vite-css-vars`·`nest-prisma-mysql`은 scratchpad에서 실제로 만들고 돌렸다: FE는 tsc·토큰(`:root`)·리뷰 통과, BE는 MySQL compose 기동·`prisma migrate dev`·게이트(tsc + prisma) 통과. 토큰 emitter는 `materialize-tokens.mjs --emit tailwind|css-vars|scss`이고, 없으면 새 FE 키 `stack.styling`을 따른다. 그 값이 `view-styling` 빈칸(`$styling.forbiddenStyleImports`)도 채워, CSS 변수 프로젝트가 CSS 모듈 import로 막히지 않는다(GEN-05 어댑터를 FE로 넓힘). 게이트 플래그는 `--stack backend`이면 `stack.orm`에서 Prisma 검사를 고른다. 할 일과 다르게 한 것: TypeORM 프리셋과 `be-builder`의 ORM별 단계(엔티티·마이그레이션·트랜잭션)는 범위가 두 배라 후속 티켓으로 넘긴다 — 지금은 "형제 모듈을 따른다" 안내와 리뷰 어댑터가 받친다. 조사 중 `pure-view-component`·`view-test-props-only`가 `react-router`를 놓치던 것도 고쳤다.

### GEN-43 TypeORM 스캐폴드 프리셋과 be-builder ORM별 단계
- 문제: GEN-07의 BE 프리셋은 Prisma만, 모듈 체크리스트·`be-builder`의 Phase 1·2(스키마 델타 → migrate → `$transaction`)가 Prisma 전제. TypeORM 프로젝트는 "형제 모듈을 따른다" 안내와 리뷰 어댑터(GEN-05)에만 기댔다.
- 할 일: `nest-typeorm-postgres` 프리셋, 체크리스트 Phase 1·2 ORM별 절, 게이트 ORM 검사 슬롯.
- 완료 기준: TypeORM 프리셋으로 만든 프로젝트에 모듈 하나를 스캐폴드하면 게이트·리뷰 통과(실설치).
- **완료(DEV-52, 2026-11-26).** 프리셋 `nest-typeorm-postgres`(TypeORM 0.3·`@nestjs/typeorm@11` — Nest 11의 짝, 1.x는 검증 안 함)가 `src/database/data-source.ts`와 `migration:*` 스크립트를 낸다. new-module·extend-module의 Phase 1·2를 ORM별 절로 나눴다(스키마 계약 · 마이그레이션 · 트랜잭션은 Repository 메서드 안). 게이트는 `--orm-check schema|migrations`로 `ORM_GATE_CHECKS`에서 고른다 — typeorm `migrations`는 `migration:generate --check`. 같은 김에 Prisma `migrations` 인자를 고쳤다: 예전 인자는 스키마를 자기 자신과 비교해 늘 통과했다. 실설치(scratchpad)로 `posts` 모듈을 Phase 1~5까지 만들었다: Phase 1 게이트 통과 → 마이그레이션 없이 `migrations` 검사가 실패하는 것을 확인 → 생성·적용 뒤 Phase 2 게이트(tsc·typeorm·jest 단위+Testcontainers 통합·리뷰) 통과 → 풀 리뷰(기준 커밋 커버리지 포함) Ready to merge: Yes. 실설치에서 둘을 더 고쳤다: 대기 금지 규칙이 `jest.setTimeout`을 잡던 것, colima에서 Ryuk 소켓 마운트 실패(힌트 문서에 `TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE`). 할 일과 다르게 한 것: 스펙의 "Prisma 스케치"는 산출물 형식이라 그대로 두고 모델 표기로 본다(TypeORM이면 빌더가 엔티티로 옮긴다). Drizzle 프리셋은 하지 않았다 — 체크리스트 표에 열 하나를 더하면 된다.

### GEN-08 리뷰 엔진 공용화
- 문제: BE 리뷰가 `skills/dt-frontend-review/scripts/review.mjs`를 직접 호출. 커버리지 러너가 jest/vitest로 고정.
- 할 일: 엔진을 `scripts/review/`로 이동, FE·BE가 스택 파라미터로 공유. `coverage.runner` 설정.
- 완료 기준: FE·BE 리뷰가 같은 엔진 경로로 동작, 기존 테스트 통과.
- **완료(DEV-13, 2026-11-16).** 엔진·검출기를 `scripts/review/`, 테스트를 `tests/review/`로 옮겼다(git 이력 유지). FE·BE 리뷰 스킬·`reviewer`·스캐폴드 게이트·`validateRules`가 새 경로를 부른다. 옛 `skills/dt-frontend-review/scripts/review.mjs`는 경고를 내고 새 엔진을 부르는 호환 파일로 0.16.x 동안 남긴다(호환 정책 §4, 0.17.0에서 지움). 커버리지 명령은 스택 설정 → package.json(`packageManager`·의존성·`scripts.test`) → lockfile → 스택 기본값 순으로 고른다(출시 전 GEN-04에서 키를 최상위 `packageManager`·`testRunner`·`commands.*`로 옮기고 `scripts/stackCommands.mjs`로 모았다). 설정·lockfile이 지금 조합과 같으면 명령도 같다(테스트). 원본 문서 `docs/refs/review-engine.md`.

## M2. 회사 프로세스

### GEN-09 이슈 트래커 어댑터와 worklog 일반화
- 문제: `dt-worklog-sync`가 사내 Jira 가이드라인(Sub-task 1~3일, "수행" Epic, 파트별 Story 상태, Bug Deployed/Verified 댓글, "산출물" 커스텀 필드 필수, GitLab URL 규칙)을 범용 규칙처럼 강제.
- 할 일:
  - 핵심 흐름만 남김: 작업 수집 → 요약 → 부모 매칭 → dry-run → 기록 → 상태 전이.
  - 조직 규칙을 프리셋으로: `references/presets/<name>.md` + 설정(`issueTypes`, `hierarchy`, `transitions`, `outputField`(선택), `epicPolicy`, `sizeRule`).
  - git 호스트별 커밋/PR URL 규칙(GitHub/GitLab/Bitbucket) 자동 감지.
  - 트래커 어댑터 인터페이스(jira 우선, github/linear는 스텁).
- 완료 기준: 프리셋 없이 "기본 Jira"(Story/Task/Sub-task, 기본 전이)로 동작. 기존 회사 규칙은 프리셋으로 재현.
- **완료(DEV-14, 2026-11-26).** 진행 중 방향을 바꿨다: 회사 가이드라인을 일반화하는 대신, 일반 프로젝트에 맞는 기록 규칙을 리서치해(Atlassian 계층·DoD, Linear 방식) 팀 정책 **TP-002**로 새로 정했다. 내용은 Epic → Story·Task·Bug(같은 층, 기본 단위, 한 주 안) → Sub-task(나눌 때만), 설명·진행·마무리 템플릿, 마무리 규칙(산출물이나 결정 사항), 관련 Confluence 문서 링크다. 이것이 기본 프리셋 `basic`이고, 회사 규칙은 선택 프리셋 `org-guideline`이다. 할 일의 설정 키는 `scripts/worklogConfig.mjs`가 프리셋 → 팀 → 개인 순으로 합친다(`issueTypes`·`unit`·`subtask`·`transitions`·`epic`·`size`·`requiredDates`·`outputField`·`releases`·`close`·`bugComments`·`gitHost`). 이미 쓰던 설정(옛 위저드가 회사 예시를 복사한 것)은 `org-guideline`으로 읽어 동작을 바꾸지 않는다(테스트로 고정). 마무리 댓글은 `check-close`가 기계로 검사한다. git URL은 `scripts/gitWebUrl.mjs`(GitHub·GitLab·Bitbucket, 모르는 호스트는 묻기). 트래커 어댑터는 `.dt.json` `tracker` + `docs/refs/tracker-adapter.md` — 연동은 jira, github·linear는 스텁, none은 마크다운 요약만. 흐름 확인은 이 작업의 기록 자체를 `basic`으로 DEV-14에 남겨서 했다: 기존 Story라 새 이슈 없이 설명 완료 조건 + 마무리 댓글(`check-close` 통과, 한글 리뷰 4건 반영) + 완료 전이. 릴리즈는 DEV에 없어 묻지 않고 넘어갔고, Confluence 관련 문서는 검색 0건이었다. 이 기록에서 Jira markdown이 `- [x]`를 체크박스로 만들지 않는 것을 찾아, 완료 조건은 HTML task list로 쓰게 고쳤다. GEN-11(훅의 `lastSyncSha`)·GEN-10(위키 어댑터)은 각자 티켓이다.

### GEN-10 위키 어댑터와 문서 스킬 일반화
- 문제: `dt-confluence-doc`이 Atlassian 전용, 문서 4종 고정, 예시 URL이 사내 사이트.
- 할 일: `wiki` 어댑터(confluence|notion|markdown 로컬). 문서 종류를 템플릿 디렉터리 기반으로 확장 가능하게. 역링크 포맷은 트래커 어댑터와 공유.
- 완료 기준: `wiki: markdown`으로 로컬 `docs/`에 문서 생성 가능.
- **완료(DEV-15, 2026-11-26).** GEN-09처럼 진행 중 방향을 바꿨다: Confluence 전용 규칙을 넓히는 대신 문서 표준을 리서치해(Diátaxis, Confluence 구조 권장, Google 설계 문서·SRE 장애 회고, 문서 신선도) 팀 정책 **TP-003**으로 정했다. 문서 7종(회의록·작업 보고·설계·운영 가이드·회고·릴리즈 노트·장애 회고), 공통 머리(상태·담당자·검토일은 설계·가이드만 6개월·관련 이슈·관련 결정·요약), 구역 6개 페이지 트리와 제목 규칙·`doc-*` 라벨, 트래커 양방향 연결(머리의 관련 이슈 + TP-002와 같은 `📄 관련 문서` 댓글, 액션은 `/dt-worklog` Task)이다. `scripts/wikiConfig.mjs`가 설정 합치기·제목·공통 머리(HTML·markdown)·markdown 경로를 낸다. 옛 종류(`worklog`→`report`, `techdoc`→design·guide 묻기)와 옛 키(`parentPageId`·옛 라벨 키)는 경고와 함께 받는다. 위키 어댑터는 `.dt.json` `wiki`(confluence·markdown·notion 스텁·none) + `docs/refs/wiki-adapter.md`. 문서 종류를 템플릿 디렉터리로 늘린다는 할 일은 종류 표(`TYPES`)와 템플릿 파일 한 쌍으로 했다. 확인: 같은 작업 보고를 markdown 위키(scratchpad)와 Confluence 개인 스페이스에 실제로 썼다 — 구역 페이지(하위 목록 매크로) → 작업 보고(공통 머리·표·경고 패널) → `doc-report` 라벨 → DEV-2·3·15 역링크 댓글. 한글 리뷰 4건 반영, Confluence 산문 정중체 규칙에 맞췄다. 이때 v2에 라벨 도구와 이슈 웹 링크 도구가 있는 것을 찾아 대응표를 고쳤다(웹 링크는 후속).

### GEN-11 dt-wrap·Stop 훅과 트래커 분리
- 문제: 마무리 순서가 커밋→Confluence→Jira로 고정. Stop 훅이 `.dt-worklog.local.json`의 `lastSyncSha`로 미정리 커밋을 셈 → 트래커를 안 쓰면 알림이 꺼지지 않음.
- 할 일: 마무리 단계를 설정(`wrap.steps`)으로 구성, 꺼진 어댑터 단계는 생략. 훅 기준을 파이프라인 상태(`.dt-pipeline.local.json`의 `lastWrapSha`)로 이동.
- 완료 기준: `tracker: none`, `wiki: none`에서 훅·루틴 정상 동작.
- **완료(DEV-16, 2026-11-26).** `.dt.json` `wrap.steps`(기본 commit → wiki → tracker = 예전 순서)를 `scripts/wrapState.mjs`가 실제 단계로 바꾼다. wiki는 confluence·markdown일 때만, tracker는 jira일 때만 돌고, 뺀 단계는 이유와 함께 알린다. 루틴과 훅이 같은 계산을 써서 알림 문구도 실제 단계로 나온다. 훅 기준점은 `/dt-wrap`이 마칠 때 남기는 `.dt-pipeline.local.json` `lastWrapSha`로 옮겼고, 옛 `lastSyncSha`도 함께 봐서 더 최근 것부터 센다(`/dt-worklog`만 돌려도 조용, 기존 사용자 동작 그대로). 기준점이 dangling이면 빼고, 다 없으면 예전처럼 origin/main 기준. 단계 설명은 TP-002·TP-003 용어로 고쳤다. 확인: `tracker: none`·`wiki: none` 임시 저장소에서 실제 훅 스크립트를 돌려 커밋 단계만 권함 → 마무리(`mark`) 뒤 조용 → 새 커밋에 다시 알림을 봤고, 같은 흐름을 entry 테스트로 고정했다.

### GEN-12 git-flow 설정화
- 문제: `main` + rebase + `--no-ff` 팀 정책을 "표준 절차"로 고정.
- 할 일: `gitFlow.{baseBranch, mergeStrategy(no-ff|squash|rebase|pr), branchPrefix, pushPolicy}`. 기본값 = 현재 정책. PR 기반 팀을 위한 `pr` 모드(머지는 호스트에 위임).
- 완료 기준: `develop` 베이스·squash 설정으로 start/finish 동작.
- **완료(DEV-17, 2026-11-26).** `.dt.json` `gitFlow`의 네 키를 그대로 넣었다. `pushPolicy`는 `push`(머지 뒤 기준 브랜치 push, 기본)·`none`(사람이 push) 두 값으로 정했고, 원격은 origin 고정이다. `scripts/gitFlow.mjs`가 start·finish 명령 순서를 낸다 — 실행은 하지 않고 스킬이 미리보기·승인 뒤 한 단계씩 실행한다. 네 방식 모두 먼저 `origin/<base>` 위로 리베이스해 충돌을 피처 브랜치에서 잡고 재개 규칙을 같게 했다. squash는 git이 머지로 보지 않아 `branch -D`가 필요해 그 단계만 따로 승인받는다. `pr`은 피처 브랜치만 `--force-with-lease`로 push하고 `gh`·`glab`이 있으면 그것으로, 없으면 `gitWebUrl.mjs`의 새 `compareUrl`로 PR 만들기 주소를 보인다. 훅(시작 알림 브랜치, 마무리 통합 문구, 기준점 없을 때 `origin/<base>`)도 같은 설정을 읽는다. 기본값의 명령 순서와 훅 문구는 예전과 같음을 테스트로 고정했다. 확인: 임시 저장소에서 develop·squash 설정으로 start(origin/develop에서 분기) → 커밋 2개 → finish 계획을 실제 git으로 실행 — develop에 커밋 하나, push, 피처 브랜치 정리, main 그대로. pr 모드는 GitHub 모양 리모트에서 `gh` 없이 PR 만들기 주소로 끝나는 것을 봤다.

### GEN-13 기타 스킬의 트래커·위키 참조 정리
- 대상: `dt-explain`(티켓 읽기 Atlassian 고정, 사내 티켓 키 예시 — 결국 없앰), `dt-audit`(후속 조치를 Jira로), `dt-handbook`(`sources.atlassian`만, `atlassian.net`만 위키 링크로 판정).
- 할 일: GEN-09·10 어댑터를 통해 읽기. `allowed-tools`의 벤더 도구 이름을 어댑터 설정에 맞춤.
- 완료 기준: 세 스킬이 `tracker: none`에서도 동작.
- **완료(DEV-18, 2026-11-26).** 진행 중 범위를 바꿨다: 세 스킬의 목적을 다시 보고 **`dt-explain`은 없앴다**(자동 발동 비용이 크고 산출물·후속 연결이 없음 — 기록은 `/dt-worklog` Bug, 장애는 `/dt-confluence` 장애 회고). 호환 정책의 한 minor 경고를 건너뛴 것은 사용자 결정이다. `dt-audit`은 후속 기록을 `tracker`로 보낸다(jira면 Task 하나, 아니면 `pending.md`)에 더해, 이슈 키를 `traceability.md` "후속 기록" 표에 되적어 다음 감사의 증분 표기에 진행 상태와 "완료인데 남음"을 보인다(`issue.read`를 트래커 어댑터에 추가). `dt-handbook`은 `scripts/handbook/sources.mjs`로 근거 원천을 정한다 — 결정 기록(PD·TP)이 첫 출처, 위키는 `wiki`(TP-003 라벨·폴더로 좁힘), 트래커는 jira일 때만, MCP 안내는 필요할 때만. G8은 팀 사이트·Notion 링크까지 막는다. `allowed-tools`는 머리말이라 설정으로 바꿀 수 없어, 본문이 설정을 보고 도구를 쓸지 정하게 했다. 확인: 근거 원천 네 조합(jira+confluence · none+none · none+markdown · 옛 off)과 G8을 테스트로, 감사 절차는 구조 테스트로 고정. 핸드북 전체 실행 확인은 비용 때문에 하지 않았다.

## M3. 입력 소스

### GEN-14 UX 소스 어댑터와 API 규칙 프리셋
- 문제: `dt-devspec`이 "이 팀의 Figma" 배치(왼쪽 UI·오른쪽 주석 패널, x좌표 판별)를 전제. Figma·Notion·Atlassian MCP 도구 이름을 본문·`allowed-tools`에 하드코딩. `/api/v1`·복수형 kebab 등 REST 규칙을 보편 규칙으로 제시. 실제 사고 이력 문구 포함.
- 할 일: `uxSources` 어댑터(figma|pdf|md|url) + 도구 이름 설정화 + WebFetch 대체 경로. 주석 패널 휴리스틱은 `figma.annotationLayout` opt-in. API 규칙을 `conventions.preset`(rest-v1|custom)으로.
- 완료 기준: Figma 없이 PDF/Markdown만으로 정의서 생성. 사고 이력 문구 제거.
- **완료(DEV-19, 2026-11-26).** 사용자 요청으로 전제를 넓혔다: Figma는 없을 수 있고 정의서는 Notion·Confluence 같은 기획 문서에서 시작할 수 있다. 그래서 `uxSources` 어댑터를 "종류 목록"이 아니라 **소스 종류와 상관없는 발견 절차**로 만들었다 — `docs/refs/ux-sources.md`(읽는 방법·MCP 없을 때 WebFetch → 묻기·주 소스·Figma/Notion 대응표·접두어 찾는 사전 점검·출처 표기)와 `skills/dt-devspec/references/source-discovery.md`(기획 문서: 목차 → SP 후보 → IF 후보 → 규칙 문장 / Figma: 화면 트리 → 데이터 화면만 본문 한 번). 3자 충돌의 "Figma=UX SOT"는 "주 소스"로 바꿨다. 주석 패널 판별은 `uxSources.figma.annotationLayout`(`none` 기본 · `right-panel`) opt-in으로 옮겼다 — 기존 팀은 한 줄 설정으로 예전 동작. API 규칙은 `conventions.preset`(`rest-v1` 기본 = 지금 제안값 · `custom` = 빈칸 질문, 경로 규칙 없음 포함), 값은 늘 §3에서 사람이 정한다. Figma·Notion 도구 전체 이름은 대응표와 명령 `allowed-tools`에만 두게 구조 테스트로 막았다. 사고 이력 문구(다른 스코프 덮어쓰기 사건, 실제 노드 id, 감사 회차 표시, 파일럿 실측)를 지웠고, 다시 들어오지 않게 테스트를 뒀다. 확인(dogfood): scratchpad에 회의실 예약 서비스 기획서(Markdown, 주 소스)와 운영 정책(PDF 한 쪽)만 두고 Figma 없이 `definition-author`를 실제로 돌렸다. 두 소스를 읽어 SP 8 · IF 14 · DM 5 초안과 협의 질문 23개를 냈고, 추천안으로 답하자 §3.5가 경로 충돌(내 예약 ↔ 관리자 예약 목록)과 빈 사내 도메인을 스스로 잡아 2라운드 질문 2개를 냈다. 답한 뒤 `definition.md`는 `validateDefinition` 통과, `status: finalized`, IF 14개 모두 `컨벤션`(rest-v1로 경로 도출), 출처는 전부 `문서 § 절`·`PDF p.N` 표기였고 Figma 언급은 0이었다. Confluence 소스는 이번 확인에 넣지 않았다(읽기 경로는 GEN-10에서 이미 실제로 썼다).

## M4. 언어

### GEN-15 locale 기반 구조(파싱·템플릿·라벨)
- 문제: `project-context.md`를 한글 제목으로 파싱, `[제안]` 라벨 카운트, 템플릿 제목·상태 라벨(확정/협의중) 한글 고정.
- 할 일: 섹션 앵커(`<!-- section:overview -->`) 기반 파싱으로 전환(한글 제목은 하위 호환으로 계속 인식). 템플릿 `*.ko.tmpl`/`*.en.tmpl`. 상태 라벨을 locale 키로.
- 완료 기준: `locale: en`으로 스펙 생성→스캐폴드 파이프라인 통과.
- **일부 완료·나머지 보류(DEV-20, 2026-11-26).** 했다: 스크립트 10곳에 흩어진 한글 제목·상태 라벨을 `scripts/lib/headings.mjs` 레지스트리 한곳으로 모았다(언어 묶음 구조, 지금은 `ko` 하나). 값은 그대로라 동작은 같다. 템플릿 제목과 레지스트리가 같은지, 레지스트리 밖 스크립트에 제목 문자열이 다시 생기지 않는지 `tests/headings.test.mjs`가 본다. 보류했다: 영어 템플릿(`*.en.tmpl`)·`en` 묶음·`team.locale` 읽기. 글쓰기 규칙·리뷰어·템플릿이 모두 한국어 독자 기준이고 영어 팀이 쓴다는 신호가 없어, 지금 만들면 쓰는 사람 없는 템플릿 12벌을 유지해야 한다. 영어 사용자가 생기면 레지스트리에 `en` 묶음을 더하고 읽는 쪽이 `headingsFor(locale)`로 고르게 하면 된다. 섹션 앵커(`<!-- section:… -->`) 전환도 그때 함께 본다.

### GEN-16 글쓰기 리뷰의 locale화
- 문제: 한국어 문장 검사가 spec-author·plan-author·e2e·worklog·confluence·explain에서 무조건 실행. docType이 벤더 이름(jira/confluence) 기준.
- 할 일: `locale=ko`일 때만 실행. docType을 독자 기준(internal-terse|internal-prose|external-user|dev-handbook)으로 개명(구 이름은 별칭 유지). `writingReviewers[locale]` 레지스트리.
- 완료 기준: `locale: en`에서 ko 검사 미실행, `ko`에서 기존과 동일.
- **보류(DEV-21, 2026-11-26).** GEN-15의 영어 템플릿 없이 `locale: en`은 동작하지 않는다. 그 상태에서 한글 검사만 끄면 검사받지 않은 한글 본문이 나간다. 영어 산출물을 만들 때 함께 한다.

### GEN-17 가이드·핸드북 산출물 일반화
- 문제: `dt-guide` 게이트가 `[A-Z]+-\d+`를 전부 사내 티켓으로 차단(`ES-2015`·`PEP-8` 오탐). `language` 설정이 있으나 미사용. 버전은 `package.json`만, PDF A4·강조색·Pretendard 고정. 핸드북 진입점 감지가 JS/Node 전용.
- 할 일: `forbiddenMarkers`·`ticketKeyPattern` opt-in, `versionSource`(package.json|Cargo.toml|file|git-tag), `theme.{accent,logo,font}`, `pdf.pageSize`, 진입점 패턴 확장 지점.
- 완료 기준: 기본 설정에서 일반 약어 오탐 0, `language`가 게이트·폰트·개요에 반영.
- **완료(DEV-22, 2026-11-26).** 공통 모듈 `scripts/lib/docOutput.mjs`와 설명 `docs/refs/doc-output.md`를 두고 가이드·핸드북이 같은 키를 받게 했다. 티켓 키는 기본으로 끄고 키 형식을 알 때만 막는다(`ticketKeyPattern` → 트래커 `defaultProjectKey` → `issueKeyPattern`, 표준 약어 접두어는 늘 넘긴다). `versionSource`는 `auto`(package.json → Cargo.toml → pyproject.toml)·`git-tag`·`file:<경로>`. `theme.{accent,font,logo}`·`pdf.pageSize`(핸드북 그림 폭 검사도 용지 폭을 따른다), 핸드북 테마 통째 바꾸기. 진입점은 Express·Koa·Fastify·Next.js와 설정 패턴 `entrypoints.extraPatterns`(다른 언어 파일도 읽는다). `language`는 PDF 틀(목차·제목 꼬리·발췌 머리말·`<html lang>`)에 반영했다. **게이트 쪽 반영(언어가 `ko`가 아니면 한글 검사·리뷰를 끄는 일)은 GEN-16과 함께 보류했다** — 영어 본문 파이프라인이 없는 지금 끄면 검사 없는 한글 본문이 나간다. 글꼴은 Pretendard가 라틴 글자도 덮어 언어별로 바꾸지 않고 `theme.font`로 연다. 확인(dogfood): scratchpad에 `Cargo.toml`만 있는 Rust 프로젝트를 두고 `audience: external` · `language: en` · `pdf.pageSize: Letter` · `theme.accent`로 핸드북 PDF를 실제로 만들었다. 버전 0.7.0을 Cargo.toml에서 읽었고, 본문의 `ES-2015`·`UTF-8`은 막히지 않았고, PDF 용지는 612×792pt(Letter), 제목은 "Developer Handbook", 목차는 "Contents"였다.

## 버그

### GEN-18 감사 중 발견한 결함 묶음
- `dt-fullstack`: 부분 실행 모드 단계 번호가 파이프라인과 불일치("BE만 → [2]·[4]"인데 [4]는 FE).
- `ko-writing-reviewer`: docType 목록에 `spec` 누락(`dt-ko`는 전달함). 임시 파일을 `/tmp`에 씀.
- `commands/dt-scaffold.md`·`dt-be-scaffold.md`: 없는 `prompts/<agent>.md` 참조. — GEN-20에서 수정(DEV-26). "쓰지 않는 worktree 언급"은 잘못된 지적이었다(worktree.mjs·extend-domain 체크리스트가 실제로 쓴다).
- `dt-be-e2e`: 없는 설계 문서 참조.
- 완료 기준: 항목별 수정 + 해당 테스트/문서 확인.

## M5. 품질·일관성 기반 (2026-11-13 추가)

배경: 3관점 리뷰 결과, 플러그인은 양 끝(헤더 생성·정의서 게이트·리뷰 엔진·PDF 게이트)은 기계적이지만 가운데(스펙 본문·구현 계획·스펙↔코드 정합)는 모델 판단에 맡겨져 있다. 사람이 내린 결정은 세션과 함께 사라지고, 플러그인을 고쳐도 깨졌는지 알 장치가 약하다. 목표는 "같은 팀이 어떤 프로젝트에서 돌려도 비슷한 결과"다.

### GEN-19 안전망 — 전체 테스트 실행과 CI
- 문제: `npm test`가 `tests/*.test.mjs`만 돈다. `skills/*/tests`·`hooks/tests`(약 20개 파일)가 빠져 있고, 하위 `package.json`이 따로 논다. CI가 없다.
- 할 일: 루트 `npm test`가 모든 테스트를 돌게 한다. 하위 `package.json`을 정리한다. GitHub Actions(테스트 + 금칙어 스캔)를 추가한다. GEN-02에서 놓친 깨진 링크(`docs/orchestration-policy.md:4`)를 고친다.
- 완료 기준: `npm test` 한 번으로 전부 돌고 CI가 녹색.

### GEN-20 구조 검사 — 머리말·이름·링크 자동 점검
- 문제: 스킬·에이전트·명령 머리말 형식을 검사하지 않는다. 없는 문서("design doc(2026-06-01)")를 인용하고, 내부 개발 용어("Plan 1·Plan 2")가 스킬 설명에 남아 있다. README 개수가 실제와 다르다.
- 할 일: 구조 테스트(머리말 필수 필드, `name`=폴더, `${CLAUDE_PLUGIN_ROOT}` 경로·문서 링크 실재)를 만들고, 찾아낸 것을 정리한다.
- 결정(2026-11-13): "design doc(2026-06-01)" 인용 32곳은 원 프로젝트 폴더에 있던 dt-spec 설계 문서를 `docs/specs/2026-06-01-dt-spec-multi-source-design.md`로 들여와 연결(파일 머리에 경로 한 줄 + 본문은 "dt-spec 설계 §N"). 구조 테스트는 `tests/pluginStructure.test.mjs`. 스킬이 사용자 프로젝트에 만드는 산출물 경로(`docs/specs/pages/…`·`docs/project-context.md`)는 검사하지 않는다.
- 완료 기준: 구조 테스트가 `npm test`에서 통과. — 완료(DEV-26)

### GEN-21 결정 기록 체계(ADR) — 팀 정책 TP · 프로젝트 결정 PD
- 문제: 결정이 5곳(결정 로그 주석·정의서 상태·감사 decisions.md·needsDecision·overrides)에 흩어져 있다. 스펙 질문에 대한 답은 git 무시 폴더에만 남아 재실행 때 다시 묻는다. overrides에 근거가 없고, 팀 규칙의 "왜"가 남지 않는다.
- 할 일:
  - 팀 정책 `docs/policies/TP-NNN-*.md`(플러그인), 프로젝트 결정 `docs/decisions/PD-NNN-*.md`(각 프로젝트). 양식: 상태(proposed·accepted·superseded·deprecated)·범위·맥락·결정·이유·버린 대안·출처·만료.
  - 계속 유효한 사람 결정은 스킬이 PD 초안을 제안하고 승인 시 채택. 스펙·계획·구현 스킬은 채택된 PD를 고정 입력으로 읽는다.
  - 근거 PD 없는 overrides는 리뷰 오류, 만료 PD는 경고. 리뷰 규칙에 `decisionRef`·`status`.
  - 감사의 규칙 환류는 TP 초안으로.
- 완료 기준: PD로 남긴 결정을 다음 실행이 다시 묻지 않고, 근거 없는 override를 리뷰가 잡는다.
- **완료(DEV-27, 2026-11-13).** 결정: ① 여러 단위·다음 실행에도 걸리는 답만 PD 초안을 제안하고 승인받아 저장(한 단위 답은 산출물에만), ② 근거 없는 override는 풀 리뷰 Critical(`override-decision-ref`, 만료는 Important — 빌더 partial 게이트는 막지 않음), ③ 관리 스킬 `dt-decision` + `/dt-decision` 신설(스킬 37·커맨드 21). 반영: `scripts/decisions.mjs`(파싱·양식 검사·번호·만료·`checkDecisionRef`·CLI list|next|check|show), `templates/decision.md.tmpl`, 첫 팀 정책 `docs/policies/TP-001-decision-records.md`, 리뷰 엔진 `overrides.mjs`(`decisionRefOf`·`overrideDecisionFindings`, override 값은 `{ value, decisionRef }` 또는 `"PD-NNN"`), 정책 원칙 9(범위별 기록 위치·읽기·쓰기·규칙 끄기), 작성 에이전트 4개의 `decisions` 고정 입력, askquestion "답을 남기는 곳", 감사 §5 환류의 TP 초안, FE/BE 리뷰·아키텍처 스킬 안내. 기존 프로젝트의 옛 형식 override(`"styling": "mui"`)는 이제 풀 리뷰에서 Critical이 된다 — `/dt-decision override <키>`로 근거를 단다.

### GEN-22 산출물 검증 — 스펙·계획 문서 형식 검사기
- 문제: 구조 검사는 정의서에만 있다. requirements·design·tasks·api-contract·plan·interactions·e2e 원장은 형식 검사가 없다.
- 할 일: 산출물별 `validateSpec.mjs`(필수 섹션·FR 번호·EARS 문형·정의서 결속 마커·api-contract 표 열·plan 체크박스 문법). `status: finalized` 전 필수 게이트.
- 완료 기준: 형식이 깨진 스펙은 확정되지 않는다.
- **완료(DEV-28, 2026-11-13).** `scripts/validateSpec.mjs` — 경로로 종류·스택을 가려 requirements(머리 주석·필수 절·FR 제목 형식·번호 중복·출처/패턴 라벨·EARS 키워드)·design/tasks(필수 절·FR 참조 무결성·체크박스)·layout-skeleton·api-contract(엔드포인트 표 열·Method·Path·Status)·plan(Phase·체크박스·자리표)·interactions(소유 절)·e2e 원장(basedOnSpec 마커·상태 값)을 본다. 공통으로 채우지 않은 `{{…}}`를 잡는다. 결정: 오류가 있으면 finalized 불가(draft), 경고는 보고만. `specVersion` 1.1 이상 스펙만 엄격하고, 머리 주석 없음·옛 버전은 같은 검사를 경고로 낮춘다(plan·interactions·원장은 늘 엄격). 게이트: spec·bespec·plan·e2e-author, dt-spec [7-6]·dt-bespec 확정 단계. 테스트 12개(템플릿 채운 FE·BE 7종 통과 포함), 구조 테스트 1개.

### GEN-23 게이트 엄격화
- 문제: 도구가 없으면 스캐폴드 게이트가 건너뛰고 통과(`gate.mjs:94`). `detectDrift`가 필수가 아니다. 리뷰 규칙 73개 중 24개가 실제 검사를 안 한다(검출 비어 있음 12, 미구현 ast-rule 12).
- 할 일: 건너뜀=실패(명시 옵션으로만 허용), `detectDrift` 필수 게이트, 심각도 높은 미구현 규칙부터 구현.
- 완료 기준: 도구 없는 환경에서 게이트가 통과하지 않고, 지정 규칙이 위반을 잡는다.
- **완료(DEV-29, 2026-11-13).** ① `gate.mjs`: 실행하지 못한 검사는 실패(`review (no paths)`만 예외), `--allow-skip <이름>`(사용자 허용 시에만)으로만 건너뜀 인정 — 빌더는 도구가 없으면 blocked + needsDecision(설치 / 이번만 허용 / 중단). ② `scripts/checkDefinitionDrift.mjs`: api-contract 엔드포인트의 `from: IF-n`·메서드·경로·IF 없는 새 엔드포인트와 스펙의 IF 참조 무결성을 정의서와 대조, `conflict:`·`skipped:` 마커는 제외 — bespec·spec-author가 consume 확정 직전에 돌림(upward-alignment 최종 정합 게이트의 구조 부분). ③ 검출 3종 추가(`pattern-pair`·`jsx-tag-attrs`·`registered-in-sibling-module`)와 `manual`. 구현한 규칙: FE list-empty-state·interactive-a11y·server-vs-client-state·avoid-effect-for-derived-state·flaky-test-prevention, BE flaky-test-prevention·repository-integration-real-db·controller-integration-supertest·service-unit-mocks-repository·testcontainers-lifecycle·e2e-full-app·module-registration. 판단 규칙(테스트 설계 기법 등 5개 + 알 수 없는 타입 `pattern-rule`을 쓰던 vendored 2개)은 `manual`로 명시. 빈 검출 규칙 FE 4·BE 8 → 0. 남은 AST 껍데기는 FE 6·BE 2(coverage-rules는 커버리지 모듈이 담당). 테스트: 게이트 2·드리프트 5·검출 11·구조 1.

### GEN-24 지침 충돌·재실행 정리 (GEN-18 흡수)
- 문제: draft 스펙 구현 허용 여부와 질문 방식(묶어서 vs 하나씩)이 스킬마다 다르다. dt-fullstack 단계 번호가 어긋난다. 스캐폴드 버전이 고정되지 않았다. "plan이 최신이면 생략"의 기준이 없다. 정의서는 문구만 바뀌어도 버전이 오른다. 모호한 표현이 있다.
- 할 일: draft·질문 정책을 하나로(정책 문서), 단계 이름화, 버전 고정, 내용 해시 기반 재생성·버전 판단, 모호한 표현의 조건화, GEN-18 결함 수정.
- 완료 기준: 같은 입력으로 두 번 돌려도 버전·계획이 불필요하게 바뀌지 않는다.
- **완료(DEV-30, 2026-11-13 — GEN-18 DEV-23 흡수 완료).** ① 정책 원칙 6.5(draft 구현: 미해소는 빼고 TODO·stub, 시작 전 1회 확인, 커밋 노트·완료 보고에 기록)로 implement 2개·dt-fullstack 통일. 원칙 6에 "하나씩"은 순서 의존·협의 카드(dt-audit)만 — dt-spec [7-5] 위반 질문도 주제별 묶음으로. ② `templates/stack-versions.json`(규칙이 검증된 major, 확인 시점 최신 major는 `latestSeen`에 기록 — react-router 8·Vite 8·Vitest 5·MSW 3·NestJS 12·Jest 30·Testcontainers 12가 이미 나와 있음) + `scripts/stackVersions.mjs`(설치 목록·major 비교). 체크리스트는 `@latest` 대신 이 파일로 설치(BE 인증·FE Sentry는 선택 묶음), 스택 사전 점검이 major 차이를 알림. ③ `scripts/planFreshness.mjs`(유닛 스펙+자기 스택 interactions 절의 내용 해시, plan 머리 `specHash`) — implement 2개가 fresh 유닛만 건너뜀. ④ `scripts/definitionVersion.mjs`(전역 규약·SP·IF·DM 행의 계약 해시가 바뀔 때만 +1) — devspec·definition-author. ⑤ 조건 없는 표현 12곳을 조건으로. GEN-18 항목(fullstack 번호 GEN-37, ko-writing-reviewer GEN-39, prompts 참조 GEN-20, be-e2e 설계 문서 GEN-19)은 이미 해결됨을 확인. 테스트 4개 + 구조 테스트 3개.

### GEN-25 버전·변경 관리
- 문제: 버전을 4곳에서 손으로 맞춘다. CHANGELOG가 없다. 생성 산출물에 스키마 버전이 없어 마이그레이션이 불가능하다. 호환성 정책이 없다.
- 할 일: 버전 맞춤 스크립트·일치 테스트, `CHANGELOG.md`, `$schemaVersion`·`migrations/`, `docs/refs/compat-policy.md`.
- 완료 기준: 버전 올리기가 명령 하나이고, 산출물 버전 차이를 감지해 안내한다.

### GEN-26 중복·진입점 정리 (GEN-08과 함께)
- 문제: 결정 로그 규칙 5곳, FE·BE coding-discipline 거의 동일, 쉬운 글쓰기 규칙 재서술 3곳, BE 스펙 파이프라인이 FE 손 복사본. 같은 이름 스킬·명령 11쌍. 544줄 조율 스킬.
- 할 일: 단일 원본 참조화, coding-discipline 통합, `docs/refs/spec-pipeline.md`, 명령=인자 처리·스킬=절차, 스킬 크기 상한.
- 완료 기준: 규칙마다 원본이 하나이고 구조 테스트가 중복 진입점·크기 초과를 잡는다.

### GEN-27 기여 가이드
- 문제: 새 스킬·규칙 작성법, 머리말·규칙 형식, 이름·언어 규칙, `docs/refs` vs `skills/*/references` 구분이 없다. README 목록이 수작업이다.
- 할 일: `CONTRIBUTING.md`, 규칙 머리말 JSON 스키마·테스트, README 목록 자동 생성.
- 완료 기준: CONTRIBUTING만 보고 규칙 하나를 추가할 수 있다.

### GEN-28 스킬 동작 평가(evals)
- 문제: 스킬 본문 변경이 결과를 바꿨는지 확인할 방법이 없다.
- 할 일: `evals/<skill>/`(고정 예제 프로젝트·입력·기대 산출물), GEN-22 검사기와 핵심 항목 비교로 채점, dt-spec·dt-bespec·리뷰부터.
- 완료 기준: 핵심 스킬 2개 이상이 평가 세트를 갖는다.

## M6. 설계 원칙 정합 (2026-11-13 추가)

설계 4원칙:
- **P1 단독 실행** — 앞 단계 산출물이 없어도 만들거나 물어서 진행한다. 조용히 거부·축소하지 않는다.
- **P2 유연한 되묻기** — 모호하거나 다른 기술·내용이면 묻고, 사용자가 결정하면 기록하고 진행한다.
- **P3 한 흐름 연결** — 전체 스킬이 하나의 파이프라인으로 이어진다(앞 산출물 = 다음 입력).
- **P4 전문 에이전트** — 단계마다 전문 에이전트가 정해진 입출력 계약대로 일한다.

리뷰 결과 요약: P1 대체로 충족(소프트 게이트 덕분). P2 대체로 미충족(스택 불일치 시 묻지 않고 기본값 강요·중단). P3는 리뷰 단계에서 끝나고 e2e·감사·문서·마무리로 이어지지 않음. P4는 빌더가 서브에이전트 안에서 리뷰어를 부르는 구조라 격리 불성립, 에이전트 반환 형식이 제각각.

| 피처 | 원칙 | 요지 |
|---|---|---|
| GEN-29 dt-adopt | P1 | 기존 프로젝트를 정의서·스펙·PD 초안으로 들이는 스킬(흩어진 역추출 기능을 묶음). GEN-21·22 이후 |
| GEN-30 공용 되묻기 정책 | P2 | `askquestion-principle.md`에 기술·내용 불일치 절과 답 저장 규칙. bootstrap 미상 스택은 그만두지 않고 묻기. `vite` 단독 React 판정 수정 |
| GEN-31 스택 사전 점검 | P2 | 구현·스캐폴드·e2e·fullstack 시작 전 프로젝트 스택 대조, 다르면 묻고 기록 |
| GEN-32 하드 스톱 → 선택지 | P1 | dt-audit·dt-spec(Figma 실패)·dt-be-spec(Figma만)·implement(스펙 없음)·devspec(소스 0개) |
| GEN-33 /dt-review 단독 실행 (결함) | P1 | 명령이 스킬 절차(설정 부트스트랩)를 건너뛰고 조용히 기본값으로 리뷰 |
| GEN-34 project-context 충돌 (결함) | P1·P3 | FE·BE가 같은 파일을 다른 템플릿으로 덮어씀 |
| GEN-35 공용 오케스트레이션 프로토콜 | P4 | 반환 봉투·needsDecision·answers·왕복 상한·질문 묶음 규칙을 하나로 |
| GEN-36 리뷰 루프 상향 (결함) | P4 | 빌더(서브에이전트)가 리뷰어(서브에이전트)를 부를 수 없음 → 조율자로 올림 |
| GEN-37 dt-fullstack 확장 | P3 | e2e·감사·가이드·핸드북·마무리 선택 단계, 단계 이름화, 명령 파일, plan 담당·경로 통일 |
| GEN-38 산출물 소유 경계 | P3 | interactions.md FE·BE 섹션, 파이프라인 계약 표, plan·e2e 원장 입력 명시 |
| GEN-39 전문 에이전트 보강 | P4 | e2e-author 신설, 페이지 조립 fe-builder로, 읽기 전용 에이전트 도구 제한, tracer needsDecision, ko-writing-reviewer 계약 |
| GEN-41 에이전트 비용 측정과 절감 | P4 | 대표 흐름별 토큰·시간 기준선, 큰 비용 원인 분석, 절감안 적용 후 재측정(GEN-29 검증: 리소스 1·화면 1에 서브에이전트 약 90만 토큰) |

기존 피처에 붙인 원칙 리뷰 항목: GEN-09(DEV-14) Git 호스트별 URL, GEN-12(DEV-17) 기본 브랜치, GEN-05(DEV-10) BE 비기본 스택 감지.

### M6 진행 기록
- **GEN-35 완료(DEV-42, 2026-11-13).** 결정: 프로토콜은 `docs/orchestration-policy.md` 원칙 5~7로 둔다(기존 SSOT 확장). 에이전트를 작업형(11)·판정형(3)으로 나눈다 — 작업형 공통 `{status: done|draft|blocked, artifacts, needsDecision, summary}`, 판정형 공통 `{verdict, findings, summary}`, 역할별 필드는 유지. needsDecision 항목 `{id, topic, question, options:[{label,description}], recommended, evidence, reflectsTo}`, 답 `answers:[{id, choice, note?}]`, 왕복 상한 2회, 권장 선택지는 `recommended` 필드(질문 창에서 "(권장)"). 구조 테스트가 봉투·항목 모양·분류 누락을 잡는다. 이 과정에서 GEN-39 항목 중 두 가지를 먼저 처리했다: dt-handbook이 tracer의 needsDecision을 처리하지 않던 것, dt-handbook이 ko-writing-reviewer의 `PASS`를 `OK`로 기다리던 것.
- **GEN-36 완료(DEV-43, 2026-11-13).** 결정: (가) 빌더는 Phase마다 `gate.mjs`(tsc·테스트·규칙 검사)만 돌고 걸린 것을 스스로 고친다. 격리 리뷰(`mode:full`)와 수리 루프는 빌더 반환 뒤 조율자가 한다. 수리는 1회(질문 왕복 상한과 따로 센다). 빌더 봉투의 `reviewVerdict`를 `gateResult`·`baseRef`로 바꿨다. reviewer findings에 `source: code | spec | plan`을 더해, 스펙·플랜 결함은 빌더 재dispatch 대신 사용자에게 보고하고 앞 단계로 되돌린다. 반영 위치: 정책 원칙 3, fe/be-builder, reviewer, plan-author, 스캐폴드 SKILL 2개, 체크리스트 4개, dt-implement·dt-be-implement·dt-fullstack. 구조 테스트가 작업형 에이전트의 다른 에이전트 dispatch 지시와, 체크리스트에서 주어가 조율자가 아닌 reviewer dispatch를 잡는다. FE 스캐폴드 개요의 "Phase 2 병렬 dispatch(store-query·view·ui-store 에이전트)"도 같은 원인이라 빌더 안 순차로 고쳤다.
- **GEN-30 완료(DEV-37, 2026-11-13).** 사용자 요청으로 범위를 넓혔다: 기술 불일치만이 아니라 **스펙의 빈틈·모호함도 스펙 작성 스킬이 스스로 찾아 되묻는다** — 사람과 일할 때 모호한 부분을 묻는 방식. 결정: 결과가 달라지는 것(보이는 동작·데이터 삭제·권한·API 계약·되돌리기 어려운 것·해석 둘 이상)만 묻고, 나머지는 가정하고 `[inferred]` + `assumptions`로 알린다. 답은 산출물의 그 절에만 반영한다(결정 파일은 GEN-21). 기술 불일치는 기존 코드 패턴이 분명하면 따르고 알린다. 반영: `askquestion-principle.md` "빈틈 찾기와 묻기 기준"(가정 목록·세 갈래 판단표·예시 A~D·답 저장), 작성 에이전트 4개(definition·spec·bespec·plan-author)에 빈틈 스윕 게이트와 `assumptions` 반환, 스펙 조율자 5곳의 가정 목록 보고, ask-missing 2개에 목록 밖 빈틈 단계, 정책 원칙 5·7. 스택 설정 부트스트랩은 스택을 모르면 그만두지 않고 묻는다. `detectStackConfig`에서 `vite` 단독 React 판정을 없애고 `detectOtherFrameworks`를 더했다(테스트 포함). 구조 테스트가 작성 에이전트의 빈틈 스윕·`assumptions`를 검사한다.
- **GEN-33 완료(DEV-40, 2026-11-13).** `/dt-review`·`/dt-be-review` 명령이 리뷰 스킬의 "단독 실행 절차"를 따른다: 스택 설정 확인(없으면 부트스트랩) → 팀 설정 경고 → 실행 → 보고서 그대로 → 후속 안내(`override-decision-ref`면 `/dt-decision override`). 허용 도구를 `Bash(node:*)`에서 Read·Write·Bash·AskUserQuestion으로 넓혔다. 결정: 단독 명령은 보고서 전문을 보려는 것이라 메인에서 스크립트를 돌리고 해석·수리는 하지 않는다 — 정책 원칙 3에 단독 실행 예외로 적었다. 구조 테스트: 모든 명령이 실제 스킬을 가리키고, 도구를 스크립트 실행 하나로 묶지 않는다.
- **GEN-34 완료(DEV-41, 2026-11-13).** 결정: 파일은 `docs/project-context.md` 하나로 두고 절로 나눈다(읽는 곳이 수십 곳이라 경로 유지). 공통 절(개요·제약사항·도메인 용어)은 없을 때만 채우고, FE는 `## FE 기술 스택`·`## FE 프로젝트 기술/라이브러리`·`## 디자인 토큰`, BE는 `## BE 기술 스택`·`## BE 프로젝트 기술/라이브러리`·`## 공유 규약`만 갱신한다. 절 제목은 2단계를 유지했다(`materialize-tokens.mjs`가 `## 디자인 토큰` 아래 `###`를 읽음). `scripts/projectContextSync.mjs`에 `mergeStackSections`·`detectLegacy`·`migrateLegacy`와 CLI(merge·migrate)를 더했고, FE·BE 수집 스킬이 파일 전체를 쓰지 않고 merge로 합친다. 옛 형식 파일은 merge가 거절(exit 3)하고 migrate 미리보기 → 확인 → 쓰기로 옮긴다. 테스트: 어느 순서로 돌려도 상대 절 보존, 공통 절 사용자 편집 보존, 모르는 절 보존, 토큰 파싱 호환, 옛 형식 이전.
- **GEN-32 완료(DEV-39, 2026-11-13).** 정책 원칙 10(막혔을 때 선택지: 복구 / 우회(draft) / 앞 단계 스킬을 이어서 실행 후 복귀 / 중단 + 이유·다음 할 일). 결정: 앞 단계 스킬은 같은 세션에서 돌리고 원래 자리로 돌아온다. 정의서 깨짐·버전 초과처럼 진행하면 해가 되는 곳은 `<!-- hard-stop: 사유 -->`로 멈추되, 깨짐은 "재생성 이어서 실행" 선택지를 준다. 바꾼 곳: dt-spec(Figma 연결·토큰·권한·노드 실패, 소스 종류 모름, 소스 0개, design 2개, 복원 design 충돌, 전체 로드 실패, FE 어댑터 공집합, corrupt·versionTooHigh), dt-be-spec(공집합, corrupt·versionTooHigh)·bespec-author, dt-audit(기준 스펙 없음), dt-devspec(소스 0개), dt-implement·dt-be-implement(스펙 폴더 없음 — [0] 단계 신설), dt-git-flow(안전 멈춤 4곳에 hard-stop 사유). 구조 테스트가 선택지도 사유도 없는 멈춤 줄을 잡는다.
- **GEN-31 완료(DEV-38, 2026-11-13).** `scripts/stackPrecheck.mjs`가 영역별(FE 8·BE 5)로 플러그인 기본과 대조해 `same | absent | adaptable | blocking`을 낸다. 절차 SOT `docs/refs/stack-precheck.md`. 결정: blocking(규칙이 기본을 전제 — 예: TypeORM, React 아님)은 "규칙 없이 진행 / 중단"을 묻고, adaptable은 "프로젝트 방식 따르기(권장) / 기본으로 새로 도입 / 중단". 답은 PD 초안으로 제안하고 머리말 `topic`(예 `stack.fe.serverState`)으로 묶어 다음 점검이 다시 묻지 않는다(결정 템플릿에 `topic` 추가). 적용: dt-implement·dt-be-implement([0.5])·스캐폴드 2개·e2e 2개·dt-fullstack, fe/be-builder는 `decisions`의 스택 결정을 checklist 예시보다 우선. 다른 기술용 규칙·템플릿은 M1.
- **GEN-38 완료(DEV-45, 2026-11-13).** 결정: 계약은 문서 한 장의 표(`docs/refs/artifact-contract.md` — 경로·절·쓰는 쪽·읽는 쪽·고칠 때)로 두고 테스트가 읽는다. `interactions.md`는 `## FE 크로스페이지`(spec-author)·`## BE 크로스리소스`(bespec-author) 절로 나누고 `scripts/interactionsSync.mjs`(merge·migrate — 옛 형식은 소유 밖 절을 FE 절 아래로 한 단계 내려 모음)로만 쓴다. GEN-34 병합을 `scripts/lib/sections.mjs`(`mergeOwnedSections`)로 일반화해 project-context·interactions가 같이 쓴다. 입력 명시: plan-author(자기 스택 절은 근거, 상대 절은 읽기만), dt-e2e·dt-be-e2e(`plan.md` `[X]` 배선을 여정 근거로, 원장·테스트만 씀). 구조 테스트: 표의 쓰는 쪽 문서가 경로·절을 적었는지, 같은 경로·절의 쓰는 쪽이 한 줄인지, 에이전트 소유 경로가 표에서 그 에이전트 몫인지.
- **GEN-39 완료(DEV-46, 2026-11-13).** 결정: e2e 작성 에이전트는 FE·BE 공유 `e2e-author`(stack 파라미터, planner 티어) 하나 — 원장 제안(propose)·저작(author)·headless 사전 실행(preflight)을 맡고, 승인·`verified`·live 게이트·질문은 조율자(dt-e2e·dt-be-e2e)에 남는다. 페이지 조립은 dt-implement [5]가 도메인 빌더 뒤 fe-builder를 `variant: assemble`로 한 번 더 부른다(조율자는 홈 라우트 판단만). 판정 에이전트 도구 제한: reviewer·ko-writing-reviewer `tools: Read, Grep, Glob, Bash`, auditor는 ux 트랙의 브라우저 MCP(이름이 환경마다 다름) 때문에 허용 목록 없이 사유를 머리말에 적었다. ko-writing-reviewer: "한 번 불리면 한 번 판정, 반복은 조율자가 정함"(dt-handbook 최대 3회와 맞춤), `docType: spec` 추가, 임시 파일 `/tmp` → `.dt-ko/`, 번호 중복 정리. 에이전트 15개. 계약 표·분류·티어·정책 목록 갱신, 구조 테스트 3개.
- **GEN-37 완료(DEV-44, 2026-11-13).** dt-fullstack을 이름 있는 단계로 다시 썼다: 기본 `definition → be-spec → be-build → fe-spec → fe-build`, 선택 `e2e`·`audit`·`guide`·`handbook`·`wrap`. 결정: 선택 단계는 시작할 때 multiSelect 한 번(권장 기본 e2e·wrap 켬), 별도 리뷰 단계는 없앴다(implement가 격리 리뷰·수리를 이미 함 — 봉투에서 모아 보고). 플랜 담당은 implement 스킬로 통일(fullstack은 플랜을 따로 만들지 않음), 경로 `docs/specs/<pages|resources>/<unit>/plan.md`로 바로잡음. 진행 기록 `.dt-fullstack/progress.json`으로 재개, `--from`·`--only` 부분 실행, 단계 사이 확인 없이 넘어가지 않음. 새 명령 `/dt-fullstack`(커맨드 22). 구조 테스트: 단계표·실제 스킬·플랜 경로·리뷰 단계 부재·명령 인자.
- **GEN-29 완료(DEV-36, 2026-11-16).** `/dt-adopt`: 기존 프로젝트를 정의서·스펙·PD로 들인다. 코드는 고치지 않는다. 결정: 스펙은 새 형식을 만들지 않고 표준 작성 에이전트(spec-author·bespec-author)가 소스 `as-built:.dt-adopt/extraction.json`으로 쓴다 — 머리 `<!-- origin: as-built @<ref> -->`, `status: draft`, FR 라벨 `[inferred]`·`[user-resolved]`. 현행 동작을 의도로 가정하지 않고 "의도/버그/모르겠음"을 묻는다 — 버그로 답한 것은 스펙에 고친 동작을 쓰고 코드 수정 과제로 올린다. 기계 추출 `scripts/adopt/`(NestJS 엔드포인트·가드·상태 코드, FE API 호출, FE↔BE 대조와 짝 없는 엔드포인트, 결정 후보) 위에 새 워커 `adopt-extractor`(planner)가 근거(파일:줄)·신뢰도(code·doc·guess)를 단다. 정의서 역합치 뒤 **§3 협의로 버전이 정해진 다음** 스펙을 결속한다(6.5 — 병렬로 돌렸다가 v1 결속·v2 정의서로 어긋난 것을 겪음). 검증: 실제 FE·BE 저장소 사본(리소스 1·화면 1)으로 끝까지 — 화면 4·FE 호출 19·엔드포인트 23, 확인 10건, FR 16+28, 정의서 IF 15(v2), PD 9, 형식 검사·정합 0. 검증 리뷰에서 고친 것: ① 저장소가 나뉘면 `.dt.json` `decisions.sharedDir`로 정의서 쪽 결정 폴더를 함께 읽는다(읽기·번호 이어 세기·번호 중복 검사, 폴더가 없으면 근거 검사는 경고) ② 플러그인 형식이 아닌 project-context(제목·언어 무관 — 키워드로 절 자리를 찾음)는 merge가 멈추고 migrate 미리보기로 옮김·겹침(drop|keep)·코드에 없는 기술·대응 없는 절을 보인다 ③ FE도 FR 줄에 `<!-- from: IF-n -->`(스킬 문서끼리 규칙이 달랐음) — 형식 검사 `fr-from-missing` 경고 ④ 출처 ref `<sha>`·`<sha>-dirty`·`nogit-<날짜>` ⑤ 새 에이전트 타입이 설치본에 없으면 일반 에이전트가 지시 문서를 읽어 실행(정책 원칙 4). 이미 푸시한 GEN-22·23 결함(옛 열 이름·원장 마커·radix-ui)은 별도 fix 커밋. 후속: GEN-40(AST 규칙)·GEN-41(에이전트 비용)·GEN-42(Atlassian MCP v2).
- **GEN-40 완료(DEV-49, 2026-11-26).** `ast-rule` 자리표 8개를 정리했다. 새 의존성(ts-morph)은 넣지 않고 기존 검출 방식으로 다뤘다 — `forbidden-pattern` 4개(Business Hook의 JSX 반환·react-dom, hook·store의 비즈니스 값 직접 기입, 브레드크럼 개인정보 키, 컨트롤러 반복·누적 계산), `pattern-pair` 3개(폴백의 throw, vitest·jest 커버리지 기준 80). 기계로 단정하지 못하는 부분(Store Query의 ViewModel 가공, 컨트롤러 `if` 분기의 성격 등)은 같은 규칙에 `manual`로 적었다. `unit-view-component`는 짝 규칙과 겹쳐 `manual`만 남겼다. 리포트 문구를 "사람 확인"으로 바꿨다. 확인(dogfood): 위반을 넣은 임시 FE·BE 프로젝트에 리뷰 엔진을 실제로 돌렸고, 새 검사 7개가 모두 위반으로 잡혔다(FE 4 · BE 컨트롤러 1 · 커버리지 Critical 2). 남은 것: 설명 문구로만 검사를 고르는 `required-pattern` 규칙 7개(decision-log-format 등)는 여전히 "사람 확인"으로 나온다 — 이번 범위 밖이다.
- **GEN-41 완료(DEV-50, 2026-11-27).** 측정 도구 `scripts/agentCost.mjs`를 만들고, 세션 기록에 남은 두 흐름으로 기준선을 쟀다(`docs/specs/2026-11-27-agent-cost-baseline.md`). adopt 검증 흐름은 에이전트 9회 · 134턴 · 처리 1,217만 · 환산 280만이다(예전 "약 90만"은 캐시를 뺀 숫자). 원인은 같은 파일 다시 읽기가 아니라 **큰 맥락 × 많은 턴**이었다. spec-author는 39턴 가운데 10턴을 지시 문서 읽기에, 10턴을 플러그인 스크립트 소스 읽기에 썼다(헤더 스크립트에 명령줄이 없었다). 적용: 헤더 명령줄(`--replace`는 헤더 줄만 바꾼다)·`validateDefinition` 결과 출력, 작성 에이전트 5개에 비용 규칙 세 줄, 버전만 오른 재결속은 에이전트 없이. 재측정: 같은 입력으로 정의서 작성을 다시 돌려 환산 73.5만 → 62.5만(−15%), 최대 맥락 145k → 121k, 품질 게이트 그대로 통과. 한 번씩 돌린 비교라 실행 편차가 섞여 있다. dt-fullstack·dt-implement·dt-audit 기준선은 그 흐름을 실제로 쓸 때 잰다.
- **GEN-44 완료(DEV-53, 2026-11-27) — 출시 전 후속 정리.** ① 설명 문구로 검사를 고르던 리뷰 규칙 7개를 기존 검출 방식 + `manual`로 정리하고, `modal-management`가 이중 백슬래시 때문에 한 번도 잡지 못하던 버그를 고쳤다. ② `/dt-confluence` 역링크를 Jira 웹 링크로 바꿨다(같은 주소는 건너뜀, 못 쓰면 댓글) — 실제 이슈에 걸어 확인. ③ 실제 프로젝트 사본(React·Vite 모노레포, TS 146파일, ADR 47개)으로 `/dt-handbook`을 처음부터 PDF까지 무인으로 돌렸다(분석 → 추적 3 → 집필 → 한글 리뷰 3회 → 빌드, 21쪽 · 그림 11). 엔진이 빗나간 다섯 곳을 고쳤다 — import 별칭·워크스페이스 패키지(간선 507 → 766), 브라우저 저장 쓰기 지점(2 → 32, 주인이 여럿인 데이터 9개를 스크립트가 찾음), ADR 폴더, G2의 폴더 하나하나 요구, 추적 규격의 경계·진입점 종류. 리뷰 루프는 46 → 14 → 7건으로 줄었고 고치다 생긴 위반을 회차마다 기계 검사가 잡았다. 사람 확인 7건은 문서에 남는 사실 문제라 그대로 두었다. ④ spec-author·adopt-extractor를 같은 입력으로 다시 재 −30%·−26%(기준선 문서 §6-2).
- **GEN-42 완료(DEV-51, 2026-11-16).** Atlassian MCP v2(`/v2/mcp`)는 v1(2027-03-01 종료)과 도구 이름·인자가 다르다. 결정: 대응표 한 장 `docs/refs/atlassian-mcp.md`를 단일 출처로 두고, 스킬 본문은 도구 이름 대신 **하는 일 이름**(`jira.transitions`·`confluence.create` 등)을 쓴다 — 이름이 또 바뀌면 표만 고친다. 시작할 때 세션 도구 목록으로 v1/v2를 판정(`discover`·`executeRead` 있으면 v2), 연결이 없으면 선택지(원칙 10). 접두어는 직접 등록(`mcp__atlassian__`)·claude.ai 커넥터(`mcp__claude_ai_Atlassian__`) 둘 다. v2에서 직접 도구가 없는 일(전이 목록·프로젝트 목록·필드 메타·공간·워크로그)은 `executeRead`/`executeWrite` 연산 이름으로. 큰 인자 차이: 이슈 생성 `issueTypeName`→`issueType`(세션에 옛 스키마가 남으면 `executeWrite`로), 전이 `transition:{id}`→`transitionId`, Confluence 생성 `parent:{spaceId,parentContentId}`·`body:{format,value}`, 수정은 `snapshotToken` 필수. 명령 `allowed-tools`는 v1·v2·두 접두어를 함께 두고 범용 쓰기 실행기 `executeWrite`는 넣지 않는다(미리 허락 범위가 모든 제품 쓰기). 함께 고친 것: `/dt-worklog`에 이슈 수정, `/dt-confluence`에 코멘트 도구 누락, 설치 안내 3곳 v1→v2 URL, `buildProjectCandidates`가 v2 응답(`{data:{values}}`)을 읽음, 릴리즈 조회는 v2 `getJiraProjectVersions`(생성은 여전히 사람). 구조 테스트 2개: 본문에 v1 전용 이름 없음·적힌 도구는 표에 있음, 명령 allowed-tools의 v1·v2 짝·두 접두어·executeWrite 없음. 실제 v2 연결로 읽기 확인(프로젝트·전이·이슈 유형·필드 메타·공간·릴리즈). 쓰기 흐름(워크로그·페이지 생성)은 실제 데이터가 생겨 돌리지 않았다.
- **GEN-25 완료(DEV-31, 2026-11-16).** ① 버전 올리기 `scripts/release.mjs <patch|minor|major|x.y.z> [--write]` — 버전이 적힌 4곳(package.json·plugin.json·marketplace.json 2곳)과 `CHANGELOG.md` 미출시 절을 한 번에. 커밋·태그는 사람이. 테스트가 4곳 일치·CHANGELOG 맨 위 버전 일치를 본다. ② `CHANGELOG.md`(Keep a Changelog, 절: 추가·변경·고침·**산출물 형식 변경**) — GEN 작업을 0.15.0으로 묶었다. ③ `docs/refs/compat-policy.md` — 버전의 뜻(0.y에선 minor가 major 역할), 산출물 형식 표시 규칙, 읽기 호환(현재·옛것+이전 도구·옛것만·더 새것=멈춤), 없앨 때 한 minor 동안 함께 받기. ④ 산출물 형식: 결정 — 표시가 없는 파일은 깨뜨리지 않고 구조로 판정한다(GEN-22 교훈). 스펙·정의서는 기존 `specVersion`, 그 밖 md는 `<!-- dt-schema: 종류@N -->`, 설정 json은 `"$schemaVersion"`. 등록부 `scripts/artifactSchemas.mjs`(종류 8개, 이전 함수는 기존 projectContextSync·interactionsSync migrate를 감쌈), 점검·이전 `scripts/migrate.mjs`(미리보기 기본, 고를 것은 건너뛰고 알림, 두 번 돌려도 같음), 새 스킬·명령 `/dt-migrate`(스킬 39·명령 24), 시작 훅이 dt 명령을 시작할 때 옮길 것이 있으면 한 줄 알림(opt-in). 템플릿·작성 도구(project-context·interactions·decision·plan·e2e 원장·스택 설정·`.dt.json`)가 표시를 단다. 계약 표에 형식 이전 예외(내용은 그대로, 제목·표시만, 확인 뒤). 0.15.0으로 올리고 `v0.15.0` 태그.
- **GEN-26 완료(DEV-32, 2026-11-16).** 결정: 규칙마다 원본 하나 — ① `docs/refs/coding-discipline.md`(4원칙), FE·BE 스킬은 이름을 그대로 두고(`enabledSkills` 호환) 스택 예시만. 결정 로그 룰·쉬운 글쓰기를 다시 적던 곳은 원본을 가리킨다. ② `docs/refs/spec-pipeline.md`(FE·BE 스펙 공용 단계: 실행 모드·정의서 게이트·헤더·역참조·변경 전파·상향 정합·상태·재실행·완료 알림). `dt-spec-generate-spec` 548→289줄(FE 전용 소스 입력·산출물 본문은 `references/`로 그대로 이동), 옮기기 전후 문장 대조로 빠진 규칙 0. ③ 진입점: 같은 이름 명령이 있는 스킬 15개 `user-invocable: false`(공식 문서 확인 — `/` 메뉴에서 숨고 모델은 Skill 도구로 계속 부름). 명령=인자+스킬 가리키기, `/dt-review`·`/dt-be-review` 절차는 리뷰 스킬로. 구조 테스트 4개(스킬 300줄·명령 40줄 상한, 명령의 절차 절, 진입점 하나, 원본 문장 재서술). GEN-08(리뷰 엔진 공용화)은 코드 이동이라 M1 첫 단계로 미뤘다. 조사 중 알게 된 것: 공식 문서상 플러그인 `commands/`는 옛 형식이고 스킬이 대체한다. 같은 이름 명령·스킬의 우선순위는 문서에 없다 — 명령을 스킬로 합치는 일은 후속 과제.
- **GEN-27 완료(DEV-33, 2026-11-16).** ① `CONTRIBUTING.md` — 폴더 구분(`docs/refs` = 여러 스킬의 원본, `skills/*/references` = 그 스킬만), 이름·언어(description 영어 발동 문구, 본문 한국어), 스킬·에이전트·명령 머리말, **리뷰 규칙 하나 추가 따라 하기**, 스킬·에이전트 추가, 올리기 전 점검. ② 규칙 머리말 스키마 `docs/refs/rule-frontmatter.schema.json` + 의존성 없는 검사기 `scripts/validateRules.mjs`(필수 필드·severity·검출 type = 검출기 파일·type별 필수 인자·정규식·relatedRules·ruleId=파일 이름). 결정: `suggestion`은 외부 규칙용 minor 별칭으로 둔다. ③ README 전체 목록 자동 생성 `scripts/readmeCatalog.mjs`(명령·스킬·에이전트 표, 갈래 표는 손으로 유지). 검사기를 켜면서 찾은 결함: 결정 로그 검출 8개가 `pattern` 없는 forbidden-pattern이라 아무것도 검사하지 않았다(GEN-23 테스트는 type 이름만 봄) — 2개는 정규식 구현(허용 레이어 밖 항목, 이유 없는 항목), 날짜 순서·제목 갱신은 manual. BE 규칙 2개의 FE 규칙 참조, `flaky-test-prevention` 요약 불일치도 고쳤다. 테스트: 모든 규칙이 스키마 통과, 스키마 type 목록 = 엔진, 스킬 규칙 목록 = 머리말, README 목록 = 생성 결과. 완료 기준 확인: 임시 복사본에서 CONTRIBUTING의 예제 블록만 그대로 뽑아 규칙을 추가 → 검사기 통과, 리뷰가 위반 파일만 잡음.
- **GEN-28 완료(DEV-34, 2026-11-16).** 결정: 평가 실행기를 만들지 않고 Claude Code 내장 `claude plugin eval` 형식을 쓴다(플러그인 없는 비교·판정·보고서가 이미 있음). `evals/` 4건 — fe-spec-login(dt-spec)·be-spec-comments(dt-be-spec)·review-bootstrap(dt-review)·migrate-preview(dt-migrate). 예제 프로젝트는 case별 `scaffold.sh`, 실행 중 질문 불가는 `append_system_prompt`(고르는 질문은 권장안+가정 보고, 파일 고치기 전 승인 단계는 승인 안 됨). 채점은 결정적 채점기 위주(`file_exists`·`regex`·`tool_used`), 우리 검사기는 채점기로 못 돌려 결과 파일을 채점(공식 우회), llm 판정은 "에러 문구를 지어내지 않음" 1개. CI에는 넣지 않는다(실행마다 비용) — 큰 변경·릴리즈 전 손으로. 구조 테스트 `tests/evals.test.mjs`(머리말 허용 키·채점기 type·scaffold·과정 채점기, 실행 안 함). 처음 실행(각 1회) 결과 4건 모두 1.00, 비용 약 $4(재실행 포함). **평가가 찾은 결함 2개**: ① dt-migrate가 물을 수 없을 때 확인 없이 `--write` → 스킬에 "물을 수 없으면 쓰지 않는다" ② 리뷰 full 모드가 git 실패 시 0개 파일 검사로 "Ready to merge: Yes"(격리 환경에서 실제로 발생) → 폴더 훑기·untracked 포함·검사 파일 수·0개면 Unknown, 스킬 문서의 기본 범위 설명도 코드와 맞춤.
