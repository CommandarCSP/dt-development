# Checklist: New Domain

사용자 요청 예: "comments 도메인 추가해줘 (post 1개에 댓글 N개)"

다음을 순서대로 수행하라. 각 phase 끝에서 commit 후 다음 phase 진행.

> **실행 주체**: dispatched 모드면 `fe-builder`가 이 절차를 자기 컨텍스트에서 순차 수행, inline degrade면 조율자가 직접(원칙 4) — 둘 다 동일 절차. **레이어 구현 룰의 단일 출처는 `Skill("dt-frontend-architecture")`·`Skill("dt-frontend-testing")`**(레이어별 prompt 없음). **리뷰는 항상 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend`로 dispatch**(격리, verdict만 — 원칙 3; inline 시 review.mjs 직접). `NEEDS_REPAIR`면 `repairTargets`+`.dt-impl`로 fe-builder 재dispatch(1회, 메인 직접수정 금지).

## Phase 0: 작업 준비

1. **task-id 생성**: 사용자 요청에서 추론. 예: `2026-05-22-comments`. (YYYY-MM-DD-<short-name>)
2. **테마 동기화 확인(테마 충실도)**: `docs/project-context.md ## 디자인 토큰`이 dt-spec [3.5] 머지로 갱신됐을 수 있으니, View 구현 전 `@theme`를 최신 토큰으로 재동기화한다:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/materialize-tokens.mjs" --project .
   ```
   마커 블록 안만 재생성(사용자 편집 보존), "변경 없음"이면 그대로 진행.
3. **Phase 0 commit**: 빈 commit으로 rollback 기준점.
   ```bash
   git commit --allow-empty -m "dt-frontend: start <task-id>"
   ```

## Phase 1: Contract 정의

Write 도구로 3개 파일 작성.

1. **`src/types/<domain>.ts`** — Model(ViewModel) 정의만. (DTO는 Phase 2에서 `src/services/<domain>/types.ts`에 — dto-vs-viewmodel/fetcher-separation 룰)
2. **`src/store/queries/keys.ts`** — 중앙 queryKey 레지스트리에 도메인 키 추가(없으면 생성). 평탄 구조. per-domain `keys.ts` 금지.
3. **`src/contracts/<domain>.contract.ts`** — Phase 2/3/4가 따를 인터페이스. 레퍼런스: `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/examples/contract.ts`. 각 인터페이스는 Phase 2(Query/View)·Phase 3(ViewModel)·Phase 4(Domain Props)에 대응.
4. **owners** — 충돌 방지용 파일 소유권 매핑(레퍼런스: `examples/owners.json`). dispatched 단일 fe-builder면 한 일꾼이 전 레이어 소유라 충돌 없음; 페이지 간 병렬일 때만 페이지별 경로로 분리. `.dt-frontend/owners-<task-id>.json` 또는 메모리.

### Phase 1 게이트
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
  --vitest false --review false
```
tsc 통과 확인. 실패면 contract/types 수정 후 재실행.

### Phase 1 commit
```bash
git add src/types src/store/queries src/contracts
git commit -m "dt-frontend Phase 1: <domain> contract"
```

## Phase 2: 구현 (Store Query + View + UI Store)

세 레이어를 `dt-frontend-architecture` 룰대로 구현한다(레이어별 prompt 없음 — 룰이 단일 출처). **dispatched면 fe-builder가 순차로, inline이면 조율자가 직접.** (서로 다른 페이지의 fe-builder는 상위에서 병렬; 한 도메인 내부는 순차.)

- **Store Query**: `src/services/<domain>/{<domain>Fetcher.ts, types.ts(DTO)}` 생성 + Query Hook은 fetcher 함수만 `queryFn`에 전달(`apiClient`/`axios` 직접 import는 services 외부 금지). queryKey는 중앙 `src/store/queries/keys.ts`만. MSW handler를 `src/mocks/handlers.ts`에 추가. 시드 데이터는 핸들러에 인라인하지 말고 별도 모듈(예: `src/mocks/seed-data.ts`)로 분리 정의 — 추후 live 도입 시 BE 시드가 같은 모듈을 공유 소비(시드 SOT). 테스트: query hook unit + mutation 통합(쿼리 mock 금지).
- **View**: `src/components/view/<DomainItem>.tsx` — hook/store import 금지, props ONLY(data+callbacks), useState(데이터)·useEffect 금지. 스타일은 **프로젝트 설정(`.dt-frontend.json` styling) 따름**(scss module이면 `*.module.scss` 동반·inline style 금지 / tailwind면 클래스). View unit 테스트(router/store wrapper 없이).
- **UI Store** (도메인이 client 상태 필요할 때만): `src/store/stores/<domain>UiStore.ts` — 서버데이터 저장 금지. unit 테스트.

### Phase 2 게이트
1. **tsc/vitest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --review false --paths "src/store/queries/<domain>,src/components/view/<DomainItem>.tsx"
   ```
2. **리뷰** — `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend, mode:partial, worktreePath:$(pwd), baseRef:Phase 0 SHA, paths:<변경>`로 dispatch. 메인은 verdict만 수신.

게이트 실패 시: tsc/vitest 실패 → 해당 레이어 수정. review `NEEDS_REPAIR` → `repairTargets`로 fe-builder 재dispatch. **1회 repair에도 실패하면 사용자 보고·중단(자동 진행 금지).**

### Phase 2 commit
```bash
git add . && git commit -m "dt-frontend Phase 2: <domain> layers"
```

## Phase 3: Business Hook

contract의 `UseXxxViewModel` 인터페이스대로 구현. **순수 로직 추출 필수(`business-logic-purity`)**: DTO→Model 변환·정렬·필터·파생값은 `<domain>Business.ts`로 빼고 ViewModel은 import해 조립만. 산출 2종 + 테스트 2종:
- `<domain>Business.ts` + `__tests__/<domain>Business.unit.test.ts`(순수 함수 단위 — 룰이 sibling 강제)
- `use<Domain>ViewModel.ts` + integration test(MSW+queryWrapper, 쿼리 mock 금지)
- 순수 로직이 전혀 없을 때만 Business.ts 생략.

### Phase 3 게이트
1. **tsc/vitest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --review false --paths "src/business/hooks/<domain>"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:frontend, mode:partial`)로 dispatch. verdict만. `NEEDS_REPAIR`면 fe-builder 재dispatch.

### Phase 3 commit
```bash
git add src/business/hooks && git commit -m "dt-frontend Phase 3: <domain> business hook"
```

## Phase 4: Domain Component + Integration test
contract의 `XxxProps` + hook 사용 조립. integration test 작성(hook을 mock하지 말 것 — review가 검사).

### Phase 4 게이트
1. **tsc/vitest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project $WORKTREE \
     --review false --paths "src/components/domain/<DomainName>.tsx,src/components/domain/__tests__/<DomainName>.integration.test.tsx"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:frontend, mode:partial`)로 dispatch. `NEEDS_REPAIR`면 fe-builder 재dispatch.

### Phase 4 commit
```bash
git add src/components/domain && git commit -m "dt-frontend Phase 4: <domain> domain component"
```

## Phase 5: Page + Router
Page 컴포넌트 작성. 기존 Page에 컴포넌트 삽입(예: PostDetail에 CommentList). 라우터 등록.

> E2E는 여기서 자동 생성하지 않는다. 구현 완료 후 `/dt-e2e`(수용 e2e 레이어)로 사람이 시나리오를 확정·검증한다. 개발단 신뢰는 Phase 4의 page integration 테스트가 담당한다.

### 라우트 등록 규칙 (필수)
1. **홈/진입점 페이지는 반드시 `/`(index)로 등록.** 첫 화면(메인 피드·대시보드·홈 성격)이면 `/feed`·`/home`이 아니라 `/`에 매핑. `/`가 비어 404 나는 상황 금지.
2. **라우터에 `/` 라우트가 정확히 1개.** 멀티 라우트여도 진입점 1개를 `/`로. `/`로 매핑할 진입점이 아직 없으면 redirect/index 라우트를 둠 — 빈 루트 금지.
3. **테스트의 `initialEntries`/`MemoryRouter` 경로를 실제 등록 경로와 일치**(라우트 변경 시 E2E도 같이 갱신 — 드리프트 금지).

### Phase 5 게이트 (FULL review + coverage)
풀 리뷰도 격리한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:frontend, mode:full, worktreePath:$(pwd), baseRef:Phase 0 commit SHA(dt-frontend: start <task-id>)`로 dispatch. reviewer가 `review.mjs full --base <SHA>`로 coverage까지 판정하고 verdict만 반환.

### Phase 5 commit
```bash
git add . && git commit -m "dt-frontend Phase 5: <domain> page + router"
```

## Final: Review & repair loop
Final review verdict가 `PASS`(Critical 0건)이면 완료.
`NEEDS_REPAIR`이면:
1. verdict(`violations`/`repairTargets`)를 분석 → 어느 phase/레이어 소관인지 식별.
2. 해당 부분만 repair — `repairTargets`+`.dt-impl` 상태로 **fe-builder 재dispatch**(메인 직접수정 금지).
3. Final review 재실행(최대 1회 더).
4. 2회차에도 `NEEDS_REPAIR`이면 **사용자 보고·중단** — 사용자가 직접 수정 결정.

## 완료 처리
Phase 0-5 커밋 완료. 사용자에게 보고: "작업 완료. Phase 1~5 커밋이 현재 브랜치에 반영되었습니다."
