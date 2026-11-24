# 변경 기록

이 플러그인의 바뀐 점을 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전의 뜻은 [호환 정책](docs/refs/compat-policy.md)이 정한다.

- 바꿀 때마다 맨 위 **미출시** 절에 적는다. 버전을 올릴 때 `node scripts/release.mjs <patch|minor|major>`가 이 절을 그 버전 절로 바꾼다.
- **산출물 형식 변경** 절은 사용자 프로젝트에 이미 있는 파일(스펙·project-context·설정 등)에 영향이 있을 때 쓴다. 옮기는 방법(`/dt-migrate`)이나 "옮길 필요 없음"을 함께 적는다.

## [미출시]

### 추가
- `CONTRIBUTING.md` — 폴더 구분·이름·언어·머리말 형식, 리뷰 규칙 하나 추가 따라 하기, 올리기 전 점검 (GEN-27)
- 리뷰 규칙 머리말 스키마 `docs/refs/rule-frontmatter.schema.json`과 검사기 `scripts/validateRules.mjs` — 필수 필드·severity·검출 type과 type별 필수 인자·relatedRules (GEN-27)
- README 전체 목록 자동 생성 `scripts/readmeCatalog.mjs` (GEN-27)
- 스킬 동작 평가 `evals/` — `claude plugin eval` 형식 4건(dt-spec·dt-be-spec·dt-review·dt-migrate), 예제 프로젝트를 만들어 실제로 돌리고 결정적 채점기로 본다. CI에는 넣지 않고 손으로 돌린다(`evals/README.md`) (GEN-28)
- 스택 명령 고르기 `scripts/stackCommands.mjs` — 패키지 관리자(pnpm·npm·yarn)·테스트 도구(vitest·jest)를 스택 설정 `packageManager`·`testRunner` → package.json → lockfile 순으로 고르고, 설치·테스트·커버리지·수용 e2e·개발 서버 명령을 낸다(`commands.*`로 직접 적기). 리뷰 커버리지(GEN-08)·스캐폴드 게이트·e2e·가이드 스킬이 이것을 쓴다. 설정이 없고 지금 조합이면 명령은 그대로다 (GEN-08·GEN-04)
- 폴더 구조 바꿔 끼우기 — 규칙은 표준 경로(`src/…`·`e2e/…`)로 두고, 리뷰 엔진이 스택 설정 `paths.src`·`paths.e2e`·`layout`으로 프로젝트 경로로 바꾼다. 지금까지는 `src/`가 아닌 프로젝트에서 검사 파일이 0개가 되어 "Ready to merge: Yes"를 냈다 (GEN-04)
- 스택 설정 `apiPrefix` — 스펙의 API 주소에서 도메인을 뽑을 때 `/api` 말고 `/v1`·접두어 없음(`GET /posts`)·여러 접두어를 받는다. `/api/v1/…`의 버전 조각은 건너뛴다 (GEN-04)
- 스택 설정 키 전체의 원본 `docs/refs/stack-config.md` (GEN-04)
- 테스트 파일 이름·자리 바꿔 끼우기 — 스택 설정 `testing.location`(`__tests__`·`colocated`)·`testing.suffix.{unit,integration,e2e,any}`·`paths.test`로 리뷰 엔진이 테스트 규칙의 경로와 "테스트가 있어야 한다" 규칙이 찾는 이름을 바꾼다. NestJS 관례(`posts.service.spec.ts`·`test/app.e2e-spec.ts`) 예시는 `docs/refs/stack-config.md` §3. 설정이 없으면 그대로다 (GEN-06)
- 선택 참고 문서 `docs/refs/docker-runtime-hints.md` — colima·rancher-desktop·podman 소켓, Ryuk 끄기. 규칙·체크리스트·`be-builder`에 흩어져 있던 값을 모았다 (GEN-06)

### 고침
- 테스트를 `__tests__` 밖에 두거나 `*.spec.ts`로 짓는 프로젝트에서 테스트 파일 규칙(mock·대기 금지·전체 앱 부팅 등)이 하나도 걸리지 않던 것 — 위 `testing` 설정으로 (GEN-06)
- FE 테스트 규칙 `integration-no-hook-mocking`·`unit-business-hook`이 `vi.mock`만 보고 jest의 `jest.mock`을 놓치던 것 (GEN-04)
- `fe-builder`가 없는 설정 키 `frontend.*`를 따르라고 하던 것 — 기존 코드 패턴·`paths.src`·`layout`·`stackCommands`로 (GEN-04)
- 리뷰 full 모드가 git을 못 쓰면 0개 파일을 검사하고 "Ready to merge: Yes"를 내던 것 — git 실패 시 폴더를 훑고, 새 파일(untracked)도 보고, 검사 파일 수를 적고, 0개면 `Unknown`. 스킬 문서의 기본 범위 설명("커밋 안 된 변경")도 코드와 맞춰 "프로젝트 전체"로 (GEN-28 평가에서 발견)
- `/dt-migrate`가 물을 수 없는 실행에서 확인 없이 `--write`로 쓰던 것 — 미리보기로 끝낸다 (GEN-28 평가에서 발견)
- 결정 로그 규칙의 검출 8개가 정규식 없이 아무것도 검사하지 않던 것 — 허용 레이어 밖 항목·이유 없는 항목은 정규식으로 잡고, 날짜 순서·제목 갱신은 `manual`로 (GEN-27)
- BE 규칙 2개가 FE 규칙을 `relatedRules`로 가리키던 것, `flaky-test-prevention` 요약이 스킬 목록과 달랐던 것 (GEN-27)

### 변경
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
