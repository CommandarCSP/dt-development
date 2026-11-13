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
| DEV-2 [M1] | GEN-04 DEV-9 · GEN-05 DEV-10 · GEN-06 DEV-11 · GEN-07 DEV-12 · GEN-08 DEV-13 |
| DEV-3 [M2] | GEN-09 DEV-14 · GEN-10 DEV-15 · GEN-11 DEV-16 · GEN-12 DEV-17 · GEN-13 DEV-18 |
| DEV-4 [M3] | GEN-14 DEV-19 |
| DEV-5 [M4] | GEN-15 DEV-20 · GEN-16 DEV-21 · GEN-17 DEV-22 |
| (에픽 없음) | GEN-18 DEV-23 (버그 — GEN-24가 흡수) |
| DEV-24 [M5] | GEN-19 DEV-25 · GEN-20 DEV-26 · GEN-21 DEV-27 · GEN-22 DEV-28 · GEN-23 DEV-29 · GEN-24 DEV-30 · GEN-25 DEV-31 · GEN-26 DEV-32 · GEN-27 DEV-33 · GEN-28 DEV-34 |
| DEV-35 [M6] | GEN-29 DEV-36 · GEN-30 DEV-37 · GEN-31 DEV-38 · GEN-32 DEV-39 · GEN-33 DEV-40 · GEN-34 DEV-41 · GEN-35 DEV-42 · GEN-36 DEV-43 · GEN-37 DEV-44 · GEN-38 DEV-45 · GEN-39 DEV-46 |

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
8 유지보수 ─ GEN-25 버전 → GEN-26 중복·진입점(GEN-08 함께) → GEN-27 기여 가이드 → GEN-28 evals
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

### GEN-05 BE 스택 어댑터(ORM·DB·캐시·큐·인증)
- 문제: 룰이 `@prisma/client`·`ioredis`·`new Queue(`를 문자 그대로 매칭 → 다른 ORM 프로젝트는 보호 없음. Passport+JWT를 "정석"으로 고정.
- 할 일: `.dt-backend.json`에 `stack.{orm,db,cache,queue,auth}`. 패턴 `matches`를 프리셋(prisma/typeorm/drizzle)에서 주입, 기능이 `none`이면 룰 skip. 룰 이름을 계층 기준(`repository-only-orm`)으로. `dt-bespec-collect-project-context` 감지표 확장 + 하위 스킬이 그 값을 읽게.
- 완료 기준: TypeORM 픽스처에서 계층 위반 룰이 동작.

### GEN-06 BE 테스트 전략 설정화
- 문제: 파일명 규칙(`*.unit.test.ts`), Testcontainers Postgres, colima 소켓 경로, 커버리지 80/85% 고정.
- 할 일: `testing.{runner,unitGlob,integrationGlob,container}`, `coverage.newCodeThreshold`. DB별 컨테이너 선택. OS별 Docker 힌트는 선택 참고 문서로 분리.
- 완료 기준: `*.spec.ts` 규칙 프로젝트에서 `requires-sibling-test` 정상 동작.

### GEN-07 스캐폴드 스택 프리셋
- 문제: FE는 Vite+Tailwind v4+shadcn+MSW, 포트 5173 고정. 토큰 출력이 Tailwind `@theme` 전용. BE는 npm·Prisma·Postgres16 compose·JWT 패키지 고정, 게이트에 `--prisma true` 리터럴.
- 할 일: `presets/fe/*`, `presets/be/*` 스니펫(설치·init·compose·env). 기본 프리셋 = 현재 조합. 토큰 emitter 어댑터(tailwind|css-vars|scss). 게이트 플래그를 설정에서 전달.
- 완료 기준: 기본 프리셋으로 현재와 같은 결과, 대체 프리셋 1개 이상 동작.

### GEN-08 리뷰 엔진 공용화
- 문제: BE 리뷰가 `skills/dt-frontend-review/scripts/review.mjs`를 직접 호출. 커버리지 러너가 jest/vitest로 고정.
- 할 일: 엔진을 `scripts/review/`로 이동, FE·BE가 스택 파라미터로 공유. `coverage.runner` 설정.
- 완료 기준: FE·BE 리뷰가 같은 엔진 경로로 동작, 기존 테스트 통과.

## M2. 회사 프로세스

### GEN-09 이슈 트래커 어댑터와 worklog 일반화
- 문제: `dt-worklog-sync`가 사내 Jira 가이드라인(Sub-task 1~3일, "수행" Epic, 파트별 Story 상태, Bug Deployed/Verified 댓글, "산출물" 커스텀 필드 필수, GitLab URL 규칙)을 범용 규칙처럼 강제.
- 할 일:
  - 핵심 흐름만 남김: 작업 수집 → 요약 → 부모 매칭 → dry-run → 기록 → 상태 전이.
  - 조직 규칙을 프리셋으로: `references/presets/<name>.md` + 설정(`issueTypes`, `hierarchy`, `transitions`, `outputField`(선택), `epicPolicy`, `sizeRule`).
  - git 호스트별 커밋/PR URL 규칙(GitHub/GitLab/Bitbucket) 자동 감지.
  - 트래커 어댑터 인터페이스(jira 우선, github/linear는 스텁).
- 완료 기준: 프리셋 없이 "기본 Jira"(Story/Task/Sub-task, 기본 전이)로 동작. 기존 회사 규칙은 프리셋으로 재현.

### GEN-10 위키 어댑터와 문서 스킬 일반화
- 문제: `dt-confluence-doc`이 Atlassian 전용, 문서 4종 고정, 예시 URL이 사내 사이트.
- 할 일: `wiki` 어댑터(confluence|notion|markdown 로컬). 문서 종류를 템플릿 디렉터리 기반으로 확장 가능하게. 역링크 포맷은 트래커 어댑터와 공유.
- 완료 기준: `wiki: markdown`으로 로컬 `docs/`에 문서 생성 가능.

### GEN-11 dt-wrap·Stop 훅과 트래커 분리
- 문제: 마무리 순서가 커밋→Confluence→Jira로 고정. Stop 훅이 `.dt-worklog.local.json`의 `lastSyncSha`로 미정리 커밋을 셈 → 트래커를 안 쓰면 알림이 꺼지지 않음.
- 할 일: 마무리 단계를 설정(`wrap.steps`)으로 구성, 꺼진 어댑터 단계는 생략. 훅 기준을 파이프라인 상태(`.dt-pipeline.local.json`의 `lastWrapSha`)로 이동.
- 완료 기준: `tracker: none`, `wiki: none`에서 훅·루틴 정상 동작.

### GEN-12 git-flow 설정화
- 문제: `main` + rebase + `--no-ff` 팀 정책을 "표준 절차"로 고정.
- 할 일: `gitFlow.{baseBranch, mergeStrategy(no-ff|squash|rebase|pr), branchPrefix, pushPolicy}`. 기본값 = 현재 정책. PR 기반 팀을 위한 `pr` 모드(머지는 호스트에 위임).
- 완료 기준: `develop` 베이스·squash 설정으로 start/finish 동작.

### GEN-13 기타 스킬의 트래커·위키 참조 정리
- 대상: `dt-explain`(티켓 읽기 Atlassian 고정, 사내 티켓 키 예시), `dt-audit`(후속 조치를 Jira로), `dt-handbook`(`sources.atlassian`만, `atlassian.net`만 위키 링크로 판정).
- 할 일: GEN-09·10 어댑터를 통해 읽기. `allowed-tools`의 벤더 도구 이름을 어댑터 설정에 맞춤.
- 완료 기준: 세 스킬이 `tracker: none`에서도 동작.

## M3. 입력 소스

### GEN-14 UX 소스 어댑터와 API 규칙 프리셋
- 문제: `dt-devspec`이 "이 팀의 Figma" 배치(왼쪽 UI·오른쪽 주석 패널, x좌표 판별)를 전제. Figma·Notion·Atlassian MCP 도구 이름을 본문·`allowed-tools`에 하드코딩. `/api/v1`·복수형 kebab 등 REST 규칙을 보편 규칙으로 제시. 실제 사고 이력 문구 포함.
- 할 일: `uxSources` 어댑터(figma|pdf|md|url) + 도구 이름 설정화 + WebFetch 대체 경로. 주석 패널 휴리스틱은 `figma.annotationLayout` opt-in. API 규칙을 `conventions.preset`(rest-v1|custom)으로.
- 완료 기준: Figma 없이 PDF/Markdown만으로 정의서 생성. 사고 이력 문구 제거.

## M4. 언어

### GEN-15 locale 기반 구조(파싱·템플릿·라벨)
- 문제: `project-context.md`를 한글 제목으로 파싱, `[제안]` 라벨 카운트, 템플릿 제목·상태 라벨(확정/협의중) 한글 고정.
- 할 일: 섹션 앵커(`<!-- section:overview -->`) 기반 파싱으로 전환(한글 제목은 하위 호환으로 계속 인식). 템플릿 `*.ko.tmpl`/`*.en.tmpl`. 상태 라벨을 locale 키로.
- 완료 기준: `locale: en`으로 스펙 생성→스캐폴드 파이프라인 통과.

### GEN-16 글쓰기 리뷰의 locale화
- 문제: 한국어 문장 검사가 spec-author·plan-author·e2e·worklog·confluence·explain에서 무조건 실행. docType이 벤더 이름(jira/confluence) 기준.
- 할 일: `locale=ko`일 때만 실행. docType을 독자 기준(internal-terse|internal-prose|external-user|dev-handbook)으로 개명(구 이름은 별칭 유지). `writingReviewers[locale]` 레지스트리.
- 완료 기준: `locale: en`에서 ko 검사 미실행, `ko`에서 기존과 동일.

### GEN-17 가이드·핸드북 산출물 일반화
- 문제: `dt-guide` 게이트가 `[A-Z]+-\d+`를 전부 사내 티켓으로 차단(`ES-2015`·`PEP-8` 오탐). `language` 설정이 있으나 미사용. 버전은 `package.json`만, PDF A4·강조색·Pretendard 고정. 핸드북 진입점 감지가 JS/Node 전용.
- 할 일: `forbiddenMarkers`·`ticketKeyPattern` opt-in, `versionSource`(package.json|Cargo.toml|file|git-tag), `theme.{accent,logo,font}`, `pdf.pageSize`, 진입점 패턴 확장 지점.
- 완료 기준: 기본 설정에서 일반 약어 오탐 0, `language`가 게이트·폰트·개요에 반영.

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

### GEN-23 게이트 엄격화
- 문제: 도구가 없으면 스캐폴드 게이트가 건너뛰고 통과(`gate.mjs:94`). `detectDrift`가 필수가 아니다. 리뷰 규칙 73개 중 24개가 실제 검사를 안 한다(검출 비어 있음 12, 미구현 ast-rule 12).
- 할 일: 건너뜀=실패(명시 옵션으로만 허용), `detectDrift` 필수 게이트, 심각도 높은 미구현 규칙부터 구현.
- 완료 기준: 도구 없는 환경에서 게이트가 통과하지 않고, 지정 규칙이 위반을 잡는다.

### GEN-24 지침 충돌·재실행 정리 (GEN-18 흡수)
- 문제: draft 스펙 구현 허용 여부와 질문 방식(묶어서 vs 하나씩)이 스킬마다 다르다. dt-fullstack 단계 번호가 어긋난다. 스캐폴드 버전이 고정되지 않았다. "plan이 최신이면 생략"의 기준이 없다. 정의서는 문구만 바뀌어도 버전이 오른다. 모호한 표현이 있다.
- 할 일: draft·질문 정책을 하나로(정책 문서), 단계 이름화, 버전 고정, 내용 해시 기반 재생성·버전 판단, 모호한 표현의 조건화, GEN-18 결함 수정.
- 완료 기준: 같은 입력으로 두 번 돌려도 버전·계획이 불필요하게 바뀌지 않는다.

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
