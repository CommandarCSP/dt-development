---
name: dt-backend-scaffold
description: Use when the user requests creating a new NestJS project following dt-backend architecture, adding a new module/resource (e.g. "orders 모듈 추가"), or extending an existing module (e.g. "주문 취소 엔드포인트 추가"). Orchestrates a 5-phase multi-agent workflow with phase-level mini-reviews and a final full review. Requires dt-backend-architecture rules and the shared review engine.
---

# dt-backend Scaffold

사용자 요청을 받아 5-phase 멀티 에이전트로 NestJS 코드를 생성하는 하네스.

> **다른 스킬과의 관계**
> - 본 skill은 룰을 *소비*하는 오케스트레이터 — 룰 본문은 `dt-backend-architecture`(구조) / `dt-backend-testing`(테스트)에 있음. dispatch하는 서브에이전트가 이를 따름.
> - **extend-module**(기존 코드 수정)은 `dt-backend-coding-discipline`의 수술적 변경을 함께 적용.
> - gate 스크립트는 FE와 **공유**: `skills/dt-frontend-scaffold/scripts/`.
> - 실행 모드(병렬/순차)·리뷰 격리는 **공용 정책** `../../docs/orchestration-policy.md`를 따른다(SSOT).

## 의도 분기

1. **신규 프로젝트** ("NestJS 프로젝트 만들어줘") → `checklist/new-project.md`
2. **새 모듈 추가** ("orders 모듈 추가", "X 리소스 추가") → `checklist/new-module.md` (주 흐름)
3. **기존 모듈 확장** ("orders에 취소 추가") → `checklist/extend-module.md`

분기가 모호하면 사용자에게 명확화 질문.

## 실행 모드 (컨텍스트 경제 — 격리 빌더 + reviewer)

이 스킬은 **얇은 조율자**다. 한 리소스/모듈의 계층 구현은 일회성 워커 `be-builder`(agents/)가 자기 컨텍스트에서 끝내고 포인터+요약만 돌려주게 한다. 모드는 `../../docs/orchestration-policy.md` 원칙 1·3·4를 따른다(FE `dt-frontend-scaffold`와 대칭).

- **dispatched (기본):** 조율자가 `task-id`·variant·대상을 정해 `Task`로 `be-builder` dispatch → 빌더가 아래 5-phase 수행(게이트마다 `reviewer` dispatch `stack:backend`, repair는 빌더 재dispatch 1회) → 조율자는 `{ status, layersDone, reviewVerdict, needsDecision }`만 수신. 리소스 간 병렬, 리소스 내 순차.
- **inline degrade (원칙 4):** 조율자가 아래 checklist 5-phase를 직접 수행(현행). 워커를 안 거칠 뿐 같은 절차·같은 산출.

> 두 모드는 아래 checklist 동일 절차를 따른다(분기 없음). 리뷰는 두 모드 다 `reviewer` 격리. `be-builder`=`${CLAUDE_PLUGIN_ROOT}/agents/be-builder.md`, `reviewer`=`${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`.

## 5-Phase Workflow (new-module 기준)

```
Phase 0: task-id 생성 + Phase 0 commit (rollback 기준점)
Phase 1: contract.ts + schema.delta.prisma + cache-keys + owners → tsc + prisma validate 게이트
Phase 2: repository + dto 계층 (be-builder) → tsc + prisma + jest + partial review 게이트
Phase 3: service + unit test → tsc + jest + partial review 게이트
Phase 4: controller + integration test(Supertest+Testcontainers) → 게이트
Phase 5: module 와이어링 + AppModule 등록 → full review + diff coverage(jest 80%)  # E2E 자동생성 없음 — 수용 e2e는 /dt-be-e2e 소유
Final: Critical 잔존 시 1회 repair, 그래도 실패면 사용자 보고
```

각 phase 끝마다 commit. 실패 시 사용자가 직접 수정 결정.

## Phase 2 계층 (be-builder가 한 컨텍스트에서; 리소스 간 병렬 시 경로 분리)
- **Repository 계층**: `*.repository.ts`, `prisma/schema.prisma`, `migrations/**` (유일하게 `@prisma/client` 허용)
- **DTO 계층**: `dto/**`, `entities/**`, `mappers/**` (class-validator DTO, Prisma import 금지)

controller/service는 두 계층에 의존하므로 Phase 3/4에서 순차 진행. **리소스 간 병렬 시 `prisma/schema.prisma` 공유 머지 구간은 순차화**.

## 사용 도구
- `skills/dt-frontend-scaffold/scripts/gate.mjs` (`--prisma true`, `--test-runner jest`, `--stack backend`)
- `${CLAUDE_PLUGIN_ROOT}/agents/be-builder.md`: 계층 구현 워커(Task dispatch). 계층 룰은 `dt-backend-architecture`/`-testing`(계층별 prompt 없음 — 통합됨).
- `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`: 격리 리뷰 워커(`stack:backend`, verdict만 반환)
- `dt-backend-review`: partial(phase mini-review) + full(final review) — 공유 엔진을 `--stack backend`로 호출

## 활성화 조건
- 현재 디렉토리에 `.dt-backend.json` 존재, OR 사용자가 명시적으로 `/dt-be-scaffold` 호출, OR "NestJS 아키텍처로" 명시

## 슬래시 명령
`/dt-be-scaffold <variant> [args]` — variant: `new-project | new-module | extend-module` (생략 시 추론)

## 의존성
- `dt-backend-architecture`/`dt-backend-testing` patterns (신규 프로젝트는 nest CLI 스캐폴드 + 설정 파일 직접 작성 — 보일러플레이트 미사용)
- 공유 review 엔진 (partial + full, `--stack backend`)
- Node 18+ / 사용자 프로젝트에 `npx tsc`, `npx prisma`, `npx jest` 가용

## 한계 (v1)
- Contract validator는 tsc + `prisma validate`에 의존 (export-name AST 검증은 추후)
- repair loop는 1회만
- controller-no-business-logic / module-registration은 review의 ast-rule 수동 검토 stub
