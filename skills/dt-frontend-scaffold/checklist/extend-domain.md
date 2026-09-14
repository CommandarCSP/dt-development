# Checklist: Extend Existing Domain

사용자 요청 예: "PostCard에 좋아요 버튼 추가, 다른 화면에서도 동기화"

> **실행 주체**: dispatched 모드면 `fe-builder`가 이 절차를 자기 컨텍스트에서 수행, inline degrade면 조율자가 직접 수행(원칙 4) — 둘 다 동일 절차. 레이어 구현 룰의 단일 출처는 `Skill("dt-frontend-architecture")`·`Skill("dt-frontend-testing")`·`dt-frontend-coding-discipline`(수술적 변경). **리뷰는 항상 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend`로 dispatch**(격리, verdict만 수신 — 원칙 3; inline 시 review.mjs 직접).

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
1. **tsc/vitest** — `gate.mjs --project $WORKTREE --review false --paths <변경 파일>`
2. **리뷰** — `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend, mode:partial, worktreePath:$WORKTREE, baseRef:Phase 0 SHA, paths:<변경>`로 dispatch. verdict만 수신. `NEEDS_REPAIR`면 `repairTargets`로 fe-builder 재dispatch(1회, 메인 직접수정 금지).

## Phase 3: Business Hook 갱신
ViewModel 가공 로직 수정(예: optimistic update useMutation). 순수 로직은 `<domain>Business.ts`로 추출(business-logic-purity).

### Phase 3 게이트
1. **tsc/vitest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --review false --paths "src/business/hooks/<domain>"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:frontend, mode:partial`)로 dispatch. verdict만 수신. `NEEDS_REPAIR`면 fe-builder 재dispatch.

## Phase 4: Domain Component 조립 갱신
Hook 사용 위치의 props/콜백 수정.

### Phase 4 게이트
1. **tsc/vitest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --review false --paths "src/components/domain/<DomainName>.tsx,src/components/domain/__tests__"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:frontend, mode:partial`)로 dispatch. `NEEDS_REPAIR`면 fe-builder 재dispatch.

## Phase 5: Page + Router 갱신
영향받는 Page/라우터를 갱신한다.

> 수용 e2e 갱신은 여기서 하지 않는다. 변경 후 `/dt-e2e`로 관련 시나리오를 재검증한다.

### Phase 5 게이트 (FULL review + coverage)
풀 리뷰도 격리한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend, mode:full, worktreePath:$WORKTREE, baseRef:Phase 0 commit SHA`로 dispatch. reviewer가 `review.mjs full --base <SHA>`로 coverage까지 판정하고 verdict만 반환.

## Final Review
new-domain과 동일. Full review (Critical 0건이면 완료, NEEDS_REPAIR면 1회 repair 후 실패 시 사용자 보고).

## 차이점
- new-domain은 모든 phase가 신규 작성, extend-domain은 영향 레이어만 수정(skip 가능한 phase 많음).
- contract 파일이 이미 있으면 수정, 없으면 새로 만들지 결정(도메인 새 정의 아니면 skip).
