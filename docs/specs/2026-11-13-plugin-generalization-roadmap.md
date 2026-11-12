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
| (에픽 없음) | GEN-18 DEV-23 (버그) |

## 진행 순서

```
M0 기반  ─ GEN-01 → GEN-02 → GEN-03
M1 스택  ─ GEN-04, GEN-05 → GEN-06 → GEN-07, GEN-08     (GEN-03 이후)
M2 프로세스 ─ GEN-09 → GEN-10 → GEN-11, GEN-12, GEN-13  (GEN-03 이후)
M3 소스  ─ GEN-14                                       (GEN-03 이후)
M4 언어  ─ GEN-15 → GEN-16 → GEN-17
버그     ─ GEN-18 (언제든)
```

---

## M0. 기반

### GEN-01 사내 식별자·실데이터 제거와 스캐너 상시화
- 문제: 플러그인 안에 사내 식별자 590건. 테스트 픽스처(`tests/guideGate|guideBuild|guideCapture.test.mjs`)에 실제 직원 이메일·홈 경로·사내 호스트, `dt-worklog-sync` 테스트에 고객사 코드명, 예시 곳곳에 사내 티켓 키·제품명·릴리즈 접두어·사내 Confluence URL.
- 할 일:
  - 픽스처를 중립 값(`jane.doe@example.com`, `/Users/alice`, `ACME`, `PROJ-1`)으로 교체.
  - 스킬 본문·patterns·references의 예시 티켓 키·팀명(정산팀/CS팀)·제품명을 중립 예시로 교체.
  - `tools/scan-public-export.mjs`를 `plugin` 테스트(또는 pre-push)에 편입해 재유입 차단.
- 완료 기준: `node tools/scan-public-export.mjs plugin`이 `docs/plans`·`docs/specs`(GEN-02 대상) 밖에서 0건.

### GEN-02 런타임 문서와 개발 이력 문서 분리
- 문제: 스킬이 배포되지 않는 내부 설계 문서(`docs/superpowers/specs/...`, `docs/specs/2026-*`)를 런타임에 참조. `docs/plans`의 원 프로젝트 마이그레이션 문서 등 과거 이력이 플러그인과 같이 배포됨.
- 할 일:
  - 런타임에 필요한 내용은 `skills/*/references` 또는 `docs/refs`로 옮기고, 스킬 본문의 내부 설계 문서 링크 제거.
  - 과거 plans/specs는 플러그인 밖(저장소 루트 `docs/history/` 등)으로 이동하거나 배포 제외.
- 완료 기준: `skills/`·`agents/`·`commands/`에서 `docs/plans`·`docs/specs/20`·`docs/superpowers` 참조 0건.

### GEN-03 공통 설정 스키마와 로더
- 문제: 팀·프로젝트별로 달라야 할 값이 본문에 하드코딩. `.dt-frontend.json`은 `coverage`·`overrides`만 실제로 읽힘.
- 할 일:
  - `.dt-pipeline.json` 확장: `locale`, `tracker`(none|jira|github|linear), `wiki`(none|confluence|notion|markdown), `uxSources`, `gitFlow`, `models`(planner/builder/verifier 티어).
  - 공용 로더 `scripts/lib/config.mjs`(기본값 병합·검증·`.local.json` 오버레이).
  - `detectStackConfig.mjs`가 감지 결과로 초기값을 채움. 스키마 문서 `docs/refs/config-schema.md`.
- 완료 기준: 설정 없이 실행하면 현재 동작과 동일(회귀 테스트), 각 키가 문서화.

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
- `commands/dt-be-scaffold.md`: 없는 `prompts/<agent>.md` 참조, 쓰지 않는 worktree 언급.
- `dt-be-e2e`: 없는 설계 문서 참조.
- 완료 기준: 항목별 수정 + 해당 테스트/문서 확인.
