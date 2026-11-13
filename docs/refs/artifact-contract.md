# 산출물 계약 — 누가 쓰고 누가 읽는가

스킬을 한 흐름으로 이으려면(P3) 산출물마다 **쓰는 쪽이 하나**여야 한다. 두 스킬이 같은 파일을 쓰면 뒤에 돈 쪽이 앞의 결과를 지운다. 이 플러그인에서 실제로 일어난 일이다(`docs/project-context.md`, `docs/specs/interactions.md`). 그래서 여러 스킬이 함께 쓰는 파일은 **절 단위로** 쓰는 쪽을 나눈다.

- **쓰는 쪽**: 그 경로(또는 절)를 만들고 고치는 유일한 스킬·에이전트. 같은 단계의 스킬과 그 워커(예: `dt-spec-generate-spec`과 `spec-author`)는 하나로 본다.
- **읽는 쪽**: 입력으로 쓰는 쪽. 읽는 쪽은 고치지 않는다. 고칠 게 보이면 needsDecision이나 리뷰 finding으로 올린다.
- **고칠 때**: 재실행·공유 파일에서 지킬 규칙.

새 스킬·에이전트가 파일을 쓰게 되면 이 표에 먼저 넣는다. 구조 테스트가 두 가지를 검사한다. 하나, 표의 쓰는 쪽 문서가 그 경로(또는 절)를 실제로 적었는가. 둘, 에이전트의 "소유 경로" 절에 적힌 경로가 표에서 그 에이전트 몫인가.

## 스펙

| 경로 | 절 | 쓰는 쪽 | 읽는 쪽 | 고칠 때 |
|---|---|---|---|---|
| `docs/specs/definition.md` · `docs/specs/definition.<scope>.md` | — | `definition-author` | `spec-author` · `bespec-author` · `plan-author` · `dt-implement` · `dt-be-implement` · `auditor` | 스코프가 있으면 `definition.<scope>.md`. 재실행은 diff 후 확인, `확정` IF는 잠금. 스펙 단계의 상향 정합은 `docs/refs/upward-alignment.md` 절차로만 IF 상태를 바꾼다 |
| `.dt-devspec/<scope>/` | — | `definition-author` | — | 스크래치(재개용, git 무시) |
| `docs/specs/pages/<page>/{requirements,design,tasks,layout-skeleton}.md` | — | `spec-author` | `plan-author` · `fe-builder` · `dt-implement` · `dt-e2e` · `auditor` | 재실행은 diff 후 항목별 확인 |
| `docs/specs/assets/<page>/` | — | `spec-author` | `fe-builder` · `dt-implement` | Figma에서 수거한 실제 에셋 |
| `.dt-spec/<page>/` | — | `spec-author` | — | 스크래치 |
| `docs/specs/resources/<resource>/{requirements,design,tasks,api-contract}.md` | — | `bespec-author` | `plan-author` · `be-builder` · `dt-be-implement` · `dt-be-e2e` · `auditor` | 재실행은 diff 후 확인 |
| `.dt-spec/<resource>/` | — | `bespec-author` | — | 스크래치 |
| `docs/specs/interactions.md` | `## FE 크로스페이지` | `spec-author` | `plan-author` · `fe-builder` · `reviewer` · `dt-e2e` | 자기 절만 `scripts/interactionsSync.mjs merge --stack frontend` |
| `docs/specs/interactions.md` | `## BE 크로스리소스` | `bespec-author` | `plan-author` · `be-builder` · `reviewer` · `dt-be-e2e` | 자기 절만 `scripts/interactionsSync.mjs merge --stack backend` |
| `docs/specs/<pages\|resources>/<unit>/plan.md` | — | `plan-author` | `fe-builder` · `be-builder` · `dt-e2e` · `dt-be-e2e` | 재생성은 스펙이 바뀌었을 때만. 실행 중 체크박스는 빌더가 체크만 한다 |

## 프로젝트 맥락

| 경로 | 절 | 쓰는 쪽 | 읽는 쪽 | 고칠 때 |
|---|---|---|---|---|
| `docs/project-context.md` | `## FE 기술 스택` · `## FE 프로젝트 기술/라이브러리` | `dt-spec-collect-project-context` | `spec-author` · `plan-author` · `fe-builder` · `dt-implement` | `scripts/projectContextSync.mjs merge --stack frontend` |
| `docs/project-context.md` | `## 디자인 토큰` | `dt-spec-generate-spec` | `fe-builder` · `reviewer` · `dt-frontend-scaffold` | 그 절만 다시 쓴다(diff 후 확인) |
| `docs/project-context.md` | `## BE 기술 스택` · `## BE 프로젝트 기술/라이브러리` · `## 공유 규약` | `dt-bespec-collect-project-context` | `bespec-author` · `plan-author` · `be-builder` · `dt-be-implement` | `scripts/projectContextSync.mjs merge --stack backend` |
| `docs/project-context.md` | `## 개요` · `## 제약사항` · `## 도메인 용어` | `dt-spec-collect-project-context` · `dt-bespec-collect-project-context` | 모든 스펙 단계 | **없을 때만** 채운다. 사람이 고친 내용을 덮지 않는다 |

## 코드와 테스트

| 경로 | 절 | 쓰는 쪽 | 읽는 쪽 | 고칠 때 |
|---|---|---|---|---|
| `src/{services,store/queries,store/stores,business/hooks,components/view,components/domain,pages}/` · `__tests__/` · `src/mocks/handlers.ts` | — | `fe-builder` | `reviewer` · `auditor` | 수리는 조율자가 `repairTargets`로 재dispatch |
| `.dt-impl/<page>/` | — | `fe-builder` | — | 스크래치 |
| `e2e/<page>.spec.ts` · `e2e/journeys/` · `test/<resource>.e2e.test.ts` · `test/journeys/` | — | `e2e-author` | 사람(검증) | 승인된(`approved`) 시나리오만 저작 |
| `src/<module>/{*.repository.ts,dto/,entities/,mappers/,*.service.ts,*.controller.ts,*.module.ts}` | — | `be-builder` | `reviewer` · `auditor` | 수리는 조율자가 `repairTargets`로 재dispatch |
| `prisma/schema.prisma` · `migrations/` | — | `be-builder` | `dt-bespec-collect-project-context` · `auditor` | 여러 리소스가 공유 — 머지 구간은 순차(dt-fullstack) |
| `.dt-impl/<resource>/` | — | `be-builder` | — | 스크래치 |
| `docs/specs/pages/<page>/<page>.e2e-scenarios.md` | — | `e2e-author` | `auditor` | 원장. 조율자(`dt-e2e`·`dt-be-e2e`)는 사람 승인·검증 결과(`approved`·`verified`)만 기록한다 |
| `docs/specs/e2e/journeys.md` | — | `e2e-author` | `auditor` | 크로스페이지 여정 원장 |
| `docs/specs/resources/<resource>/<resource>.e2e-scenarios.md` | — | `e2e-author` | `auditor` | 원장. 조율자(`dt-e2e`·`dt-be-e2e`)는 사람 승인·검증 결과(`approved`·`verified`)만 기록한다 |
| `docs/specs/e2e/be-journeys.md` | — | `e2e-author` | `auditor` | 크로스리소스 여정 원장 |

## 기록·문서

| 경로 | 절 | 쓰는 쪽 | 읽는 쪽 | 고칠 때 |
|---|---|---|---|---|
| `docs/audits/` | — | `dt-audit` | 사용자 | 감사는 코드·스펙을 고치지 않는다 |
| `docs/decisions/` | — | `dt-decision` | 모든 조율자(원칙 9) · `stackPrecheck` | 승인 후에만 쓴다. 대체는 supersede |
| `docs/handbook/inventory.md` | — | `handbook-analyst` | `handbook-tracer` · `handbook-author` | — |
| `docs/handbook/traces/` | — | `handbook-tracer` | `handbook-author` | 시나리오당 한 파일 |
| `docs/handbook/handbook.md` | — | `handbook-author` | `dt-handbook` | 한글 리뷰는 조율자가 따로 |
| `docs/guide/inventory.md` | — | `guide-analyst` | `guide-author` | — |
| `docs/guide/guide.md` | — | `guide-author` | `dt-guide` | 한글 리뷰는 조율자가 따로 |

## 설정

| 경로 | 절 | 쓰는 쪽 | 읽는 쪽 | 고칠 때 |
|---|---|---|---|---|
| `.dt.json` | — | `dt-wrap` | 모든 조율자(원칙 8) · 훅 | `--init`으로 만들고, 그 뒤는 사람이 고친다 |
| `.dt-frontend.json` · `.dt-backend.json` | — | `docs/refs/stack-config-bootstrap.md` | 리뷰 엔진 · 스택 스킬 | 없을 때만 만든다. `overrides`는 근거 PD 필요(원칙 9) |
