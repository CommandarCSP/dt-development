---
name: dt-frontend-scaffold
description: Use when the user requests creating a new React project following dt-frontend architecture, adding a new domain (e.g. "comments 도메인 추가"), or extending an existing domain (e.g. "좋아요 기능 추가"). Orchestrates a 5-phase multi-agent workflow with phase-level mini-reviews and a final full review. Requires Plan 1 patterns and Plan 2 review runtime to be installed.
---

# dt-frontend Scaffold

사용자 요청을 받아 5-phase 멀티 에이전트로 코드를 생성하는 하네스.

> **다른 스킬과의 관계**
> - 본 skill은 룰을 *소비*하는 오케스트레이터 — 룰 본문은 `dt-frontend-architecture`(구조) / `dt-frontend-testing`(테스트)에 있음. dispatch하는 서브에이전트가 이를 따름.
> - 특히 **extend-domain**(기존 코드 수정)은 `dt-frontend-coding-discipline`의 수술적 변경(요청 범위 밖 코드 미수정)을 함께 적용.
> - 실행 모드(병렬/순차)·리뷰 격리는 **공용 정책** `../../docs/orchestration-policy.md`를 따른다(SSOT).

## 의도 분기

사용자 요청을 다음 중 하나로 분류:

1. **신규 프로젝트** ("React 프로젝트 만들어줘", "프로젝트 부트스트랩")
   → `checklist/new-project.md` 따름

2. **새 도메인 추가** ("comments 도메인 추가", "X 기능 추가")
   → `checklist/new-domain.md` 따름 (주 흐름)

3. **기존 도메인 확장** ("PostCard에 좋아요 추가", "기존 X에 Y 추가")
   → `checklist/extend-domain.md` 따름

분기가 모호하면 사용자에게 명확화 질문.

## 실행 모드 (컨텍스트 경제 — 격리 빌더 + reviewer)

이 스킬은 **얇은 조율자**다. 한 페이지/도메인의 5레이어 구현은 일회성 워커 `fe-builder`(agents/)가 자기 컨텍스트에서 끝내고 포인터+요약만 돌려주게 한다. 모드는 `../../docs/orchestration-policy.md` 원칙 1·3·4를 따른다.

- **dispatched (기본 — 서브에이전트 가용 시):** 조율자가 `task-id`·variant·대상을 정해 `Task`로 `fe-builder`를 dispatch → 빌더가 아래 5-phase를 자기 컨텍스트에서 수행(레이어 게이트마다 `reviewer` dispatch로 verdict 수신, repair는 빌더 재dispatch 1회). 조율자는 `{ status, layersDone, reviewVerdict, needsDecision }`만 받는다. 사람 결정은 needsDecision→AskUserQuestion→재dispatch. **페이지 간 병렬**: 서로 다른 페이지의 fe-builder는 병렬 dispatch(다른 경로라 충돌 없음); 한 페이지 안은 순차.
- **inline degrade (원칙 4 — 서브에이전트 미지원 시):** 조율자가 아래 checklist 5-phase를 **직접** 수행(현행 동작 — Phase 2 병렬은 단일 컨텍스트 순차로). 워커를 안 거칠 뿐 **같은 절차·같은 산출**.

> 두 모드는 **아래 checklist 동일 절차**를 따른다(분기 없음). 차이는 격리 여부뿐. 리뷰는 두 모드 다 `reviewer` 격리(원칙 3). `fe-builder`=`${CLAUDE_PLUGIN_ROOT}/agents/fe-builder.md`, `reviewer`=`${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`.

## 5-Phase Workflow (new-domain 기준)

```
Phase 0: task-id 생성 + Phase 0 commit (rollback 기준점)
Phase 1: types + queryKey + contract.ts + owners → tsc 게이트
Phase 2: 병렬 dispatch (store-query, view, ui-store agents) → tsc + vitest + partial review 게이트
Phase 3: business hook + unit test → 게이트
Phase 4: domain component + integration test → 게이트
Phase 5: page + router → full review + diff coverage
Final: Critical 잔존 시 1회 repair, 그래도 실패면 사용자 보고
```

각 phase 끝마다 commit. 실패 시 사용자가 직접 수정 결정.

## 사용 도구

- `scripts/gate.mjs`: tsc + vitest + dt-frontend-review partial 게이트
- `${CLAUDE_PLUGIN_ROOT}/agents/fe-builder.md`: 5레이어 구현 워커(Task dispatch). 레이어 룰은 `dt-frontend-architecture`/`-testing`(레이어별 prompt 없음 — 통합됨).
- `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`: 격리 리뷰 워커(`stack:frontend`, verdict만 반환)
- `dt-frontend-review`(Plan 2): partial mode (phase mini-review), full mode (final review)

## 활성화 조건

- 현재 작업 디렉토리에 `.dt-frontend.json` 존재 (extend/new-domain의 경우)
- OR 사용자가 명시적으로 `/dt-scaffold` 호출
- OR 사용자 요청에 "dt-frontend 아키텍처로" 같은 명시적 언급

## 슬래시 명령

`/dt-scaffold <variant> [args]`

variant: `new-project | new-domain | extend-domain` (생략 시 의도 추론)

## 의존성

- Plan 1: architecture/testing patterns (신규 프로젝트는 공식 CLI 스캐폴드 — 보일러플레이트 템플릿 미사용)
- Plan 2: dt-frontend-review (partial + full mode)
- Node 18+
- 사용자 프로젝트에 `pnpm`, `npx tsc`, `npx vitest` 가용

## 한계 (Plan 3 v1)

- Contract validator는 tsc에 의존 (ts-morph 기반 export-name 검증은 Plan 3+로 연기)
- repair loop는 1회만 (실패 시 사용자 개입 필요)
- new-project 분기에서 사용자 입력 부족 시 prompt로 보완
