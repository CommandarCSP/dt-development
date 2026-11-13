# Checklist: Extend Existing Domain

사용자 요청 예: "PostCard에 좋아요 버튼 추가, 다른 화면에서도 동기화"

> **실행 주체**: dispatched 모드면 Phase 0~5의 작성·게이트·커밋은 `fe-builder`가 하고, **Phase 5 풀 리뷰와 Final 수리 루프는 조율자가** 한다 — 서브에이전트는 다른 서브에이전트를 부를 수 없다(원칙 3). inline degrade면 조율자가 전부 직접 한다(원칙 4). 절차는 같다. 레이어 구현 룰의 단일 출처는 `Skill("dt-frontend-architecture")`·`Skill("dt-frontend-testing")`·`dt-frontend-coding-discipline`(수술적 변경). Phase 1~4 게이트는 `gate.mjs`(tsc·테스트·규칙 검사)이고, 걸린 것은 그 자리에서 고친다. 격리 리뷰는 조율자가 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend`으로 dispatch해 verdict만 받는다(inline 시 review.mjs 직접). `NEEDS_REPAIR`면 조율자가 `repairTargets`+`.dt-impl`로 fe-builder를 재dispatch한다(1회, 메인 직접수정 금지).

## 분석 단계

1. **영향받는 레이어 식별**:
   - 새 endpoint? → Store Query 변경/추가 (services fetcher + 중앙 queryKey)
   - DTO/Model 필드 추가? → types + Business Hook 변환 함수 갱신
   - View prop 추가? → View Component 수정
   - Domain Component 조립 변경? → Domain 수정
   - 새 페이지/E2E? → Phase 5에 해당

2. **요구사항 정리**: 변경할 파일 목록 + 각 파일이 어느 레이어/룰에 해당하는지.

## Phase 0: 작업 준비
`new-domain.md`의 Phase 0과 동일 (task-id 생성 + **테마 동기화**(`materialize-tokens.mjs`) + Phase 0 commit). 디자인 토큰이 바뀐 확장이면 `@theme` 재동기화가 특히 중요.

## Phase 1: Contract 업데이트 (해당될 때만)
기존 contract.ts에 인터페이스 추가/수정(예: "좋아요 추가" → `togglePostLike` mutation 시그니처). 새 도메인 아니면 contract 새로 안 만들 수도 있음. 게이트: tsc 통과.

## Phase 2: 영향 레이어 구현
영향받는 레이어를 `dt-frontend-architecture` 룰대로 구현한다(레이어별 prompt 없음 — 룰이 단일 출처):
- 새 mutation/endpoint = Store Query 변경 → 먼저 `src/services/<domain>/<domain>Fetcher.ts`에 fetcher 추가, Query Hook은 그 함수만 사용. queryKey 추가/수정은 `src/store/queries/keys.ts`에서만. `apiClient`/`axios` 직접 import는 services 외부 금지.
- View prop 추가 = View Component 수정(hook/store import 금지, 스타일은 프로젝트 설정 `.dt-frontend.json` 따름).
- **dispatched**: fe-builder가 영향 레이어를 순차 구현. **inline**: 조율자가 직접. (페이지 간 병렬은 상위 조율 — 한 도메인 내부는 순차.)

게이트:
1. **게이트** — `gate.mjs --project $WORKTREE --paths <변경 파일>`(tsc·vitest·규칙 검사)
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

## Phase 3: Business Hook 갱신
ViewModel 가공 로직 수정(예: optimistic update useMutation). 순수 로직은 `<domain>Business.ts`로 추출(business-logic-purity).

### Phase 3 게이트
1. **게이트** — tsc·vitest·규칙 검사(review.mjs partial):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --paths "src/business/hooks/<domain>"
   ```
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

## Phase 4: Domain Component 조립 갱신
Hook 사용 위치의 props/콜백 수정.

### Phase 4 게이트
1. **게이트** — tsc·vitest·규칙 검사(review.mjs partial):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --paths "src/components/domain/<DomainName>.tsx,src/components/domain/__tests__"
   ```
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

## Phase 5: Page + Router 갱신
영향받는 Page/라우터를 갱신한다.

> 수용 e2e 갱신은 여기서 하지 않는다. 변경 후 `/dt-e2e`로 관련 시나리오를 재검증한다.

### Phase 5 게이트 (빌더) → FULL review + coverage (조율자)
빌더는 Phase 5도 `gate.mjs`로 검사·커밋한 뒤 봉투를 반환한다. 이어서 **조율자가** 풀 리뷰를 격리 dispatch한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend, mode:full, worktreePath:$WORKTREE, baseRef:Phase 0 commit SHA, interactions:docs/specs/interactions.md(있으면)`로 dispatch. reviewer가 `review.mjs full --base <SHA>`로 coverage까지 판정하고 verdict만 반환.

## Final Review
new-domain의 "Final: Review & repair loop (조율자)"와 같다 — `source: spec|plan`은 사용자 보고, `source: code`는 fe-builder 재dispatch 1회 후 재리뷰, 그래도 실패면 사용자 보고·중단.

## 차이점
- new-domain은 모든 phase가 신규 작성, extend-domain은 영향 레이어만 수정(skip 가능한 phase 많음).
- contract 파일이 이미 있으면 수정, 없으면 새로 만들지 결정(도메인 새 정의 아니면 skip).
