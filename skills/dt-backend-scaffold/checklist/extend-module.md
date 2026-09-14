# Checklist: Extend Module (기존 NestJS 모듈 확장)

사용자 요청 예: "orders에 취소(cancel) 엔드포인트 추가"

기존 모듈에 엔드포인트/필드를 추가한다. **수술적 변경**(`dt-backend-coding-discipline`) — 요청 범위 밖 코드 미수정.

> **실행 주체**: dispatched 모드면 `be-builder`가 수행, inline degrade면 조율자가 직접(원칙 4) — 둘 다 동일 절차. 계층 룰 단일 출처는 `Skill("dt-backend-architecture")`·`Skill("dt-backend-testing")`. **리뷰는 항상 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend`로 dispatch**(격리, verdict만 — 원칙 3). `NEEDS_REPAIR`면 `repairTargets`로 be-builder 재dispatch(1회, 메인 직접수정 금지).

## Phase 0: 작업 준비 + 영향 분석
1. task-id 생성 + 빈 commit (`git commit --allow-empty -m "dt-backend: start <task-id>"`).
2. 변경 대상 식별: 어떤 계약(contract/DTO/schema)·어떤 계층(controller/service/repository)이 바뀌는지 명시.

## Phase 1: 계약 델타
- contract 인터페이스에 새 메서드/필드 추가, 필요 시 `prisma/schema.delta.prisma`에 컬럼/모델 추가.
- 게이트: `gate.mjs --prisma true --prisma-args "validate" --test false --review false`. commit.

## Phase 2~4: 변경 계층만 구현
바뀌는 계층만 `dt-backend-architecture` 룰대로 구현한다(계층별 prompt 없음). 예: cancel은 repository(update) + service(상태전이 검증) + controller(POST /orders/:id/cancel) + 테스트. controller/service처럼 하위 계층 의존 단위는 순차(원칙 2).
- 각 계층 변경 후 tsc/jest partial 게이트를 `--review false`로 돌린 뒤, **리뷰는 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend, mode:partial, worktreePath:$(pwd), baseRef:Phase 0 SHA, paths:<변경>`로 dispatch**. 메인은 verdict만 수신. `NEEDS_REPAIR`면 `repairTargets`로 be-builder 재dispatch. commit per phase.
- 상태전이/경계 케이스는 단위 + 통합 테스트 모두 추가.

## Phase 5: 통합 검증 (FULL review)
풀 리뷰도 격리한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend, mode:full, worktreePath:$WORKTREE, baseRef:dt-backend: start <task-id>(Phase 0 commit)`로 dispatch. reviewer가 `review.mjs full --stack backend --base <SHA>`로 diff coverage까지 검증하고 verdict만 반환.
verdict가 `PASS`(Critical 0 + coverage 충족)면 완료. `NEEDS_REPAIR`면 `repairTargets`로 be-builder 재dispatch 후 1회 재검증, 그래도 실패면 사용자 보고·중단.

## 주의 (수술적 변경)
- 인접 무관 코드/포맷 변경 금지. 무관 dead code 발견 시 언급만.
- 기존 패턴(에러 처리·DTO 네이밍) 따름. 새 패턴 발명 금지.
