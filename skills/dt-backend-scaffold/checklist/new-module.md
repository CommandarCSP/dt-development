# Checklist: New Module (NestJS)

사용자 요청 예: "orders 모듈 추가해줘 (주문 생성/조회)"

다음을 순서대로 수행하라. 각 phase 끝에서 commit 후 다음 phase 진행.
gate 스크립트: `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/`.

> **실행 주체**: dispatched 모드면 `be-builder`가 이 절차를 자기 컨텍스트에서 순차 수행, inline degrade면 조율자가 직접(원칙 4) — 둘 다 동일 절차. **계층 구현 룰의 단일 출처는 `Skill("dt-backend-architecture")`·`Skill("dt-backend-testing")`**(계층별 prompt 없음). **리뷰는 항상 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend`로 dispatch**(격리, verdict만 — 원칙 3; inline 시 review.mjs `--stack backend` 직접). `NEEDS_REPAIR`면 `repairTargets`+`.dt-impl`로 be-builder 재dispatch(1회, 메인 직접수정 금지).

## Phase 0: 작업 준비
1. **task-id 생성**: 예 `2026-06-09-orders`. (YYYY-MM-DD-<module>)
2. **Phase 0 commit** (rollback 기준점):
   ```bash
   git commit --allow-empty -m "dt-backend: start <task-id>"
   ```

## Phase 1: Contract 정의 (데이터 계약)
Write 도구로 작성:
1. **`src/<module>/contracts/<module>.contract.ts`** — DTO 인터페이스 + 도메인 Model + `XxxRepository`/`XxxService` 인터페이스. 레퍼런스: `${CLAUDE_PLUGIN_ROOT}/skills/dt-backend-scaffold/examples/orders.contract.ts`
2. **`prisma/schema.delta.prisma`** — 이번 모듈의 `model`/`enum` 블록(결정론적 스키마 계약). 레퍼런스: `examples/schema.delta.prisma`
3. **`src/cache/cache-keys.ts`** — (캐시 사용 시) 도메인 캐시 키 팩토리.
4. **owners** — 충돌 방지용 경로 소유 매핑(레퍼런스 `examples/owners.json`). dispatched 단일 be-builder면 한 일꾼이 전 계층 소유; 리소스 간 병렬일 때만 모듈별 경로로 분리.

### Phase 1 게이트 (tsc + prisma validate)
`prisma/schema.delta.prisma` 블록을 `prisma/schema.prisma`에 병합 후:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
  --prisma true --prisma-args "validate" --test false --review false
```
tsc + `prisma validate` 통과 확인. 실패면 contract/schema 수정 후 재실행.

### Phase 1 commit
```bash
git add src prisma && git commit -m "dt-backend Phase 1: <module> contract"
```

## Phase 2: Repository + DTO
두 계층을 `dt-backend-architecture` 룰대로 구현한다(계층별 prompt 없음 — 룰이 단일 출처). **dispatched면 be-builder가, inline이면 조율자가 직접.** (서로 다른 리소스의 be-builder는 상위에서 병렬 — 단 `prisma/schema.prisma` 공유 머지 구간은 순차.)
- **Repository**: `<module>.repository.ts` — `@prisma/client`는 Repository에서만. schema 병합 + `prisma migrate dev`.
- **DTO**: `dto/**` — 요청 DTO는 class-validator 데코레이터 필수, Prisma/Entity import 금지, Mapper(순수) 포함.

### Phase 2 게이트
1. **tsc/prisma/jest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --prisma true --prisma-args "migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code" \
     --test-runner jest --stack backend --review false \
     --paths "src/<module>/<module>.repository.ts,src/<module>/dto"
   ```
   > prisma migrate diff가 환경상 어려우면 `--prisma-args "validate"`로 대체.
2. **리뷰** — `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend, mode:partial, worktreePath:$(pwd), baseRef:Phase 0 SHA, paths:<변경>`로 dispatch. 메인은 verdict만 수신.

게이트 실패 시: tsc/prisma/jest 실패 → 해당 계층 수정. review `NEEDS_REPAIR` → `repairTargets`로 be-builder 재dispatch. **1회 repair에도 실패하면 사용자 보고·중단.**

### Phase 2 commit
```bash
git add . && git commit -m "dt-backend Phase 2: <module> repository + dto"
```

## Phase 3: Service
contract의 `XxxService` 인터페이스대로 구현(`<module>.service.ts`). Repository mock 단위 테스트 동시 작성.

### Phase 3 게이트
1. **tsc/jest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --test-runner jest --stack backend --review false --paths "src/<module>/<module>.service.ts"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:backend, mode:partial`)로 dispatch. `NEEDS_REPAIR`면 be-builder 재dispatch(1회 후 실패 시 사용자 보고).

### Phase 3 commit
```bash
git add src && git commit -m "dt-backend Phase 3: <module> service"
```

## Phase 4: Controller + Integration test
`<module>.controller.ts` 구현(비즈로직 금지). Supertest + Testcontainers 통합 테스트(Prisma/Repository mock 금지).

### Phase 4 게이트
1. **tsc/jest** (리뷰 제외):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --test-runner jest --stack backend --review false \
     --paths "src/<module>/<module>.controller.ts,src/<module>/__tests__/<module>.controller.integration.test.ts"
   ```
2. **리뷰** — `agents/reviewer.md`(`stack:backend, mode:partial`)로 dispatch. `NEEDS_REPAIR`면 be-builder 재dispatch.

### Phase 4 commit
```bash
git add src && git commit -m "dt-backend Phase 4: <module> controller"
```

## Phase 5: Module 와이어링 + AppModule 등록
`src/<module>/<module>.module.ts`(controllers/providers/imports/exports), `src/app.module.ts`에 등록(가산적).

> E2E는 여기서 자동 생성하지 않는다. 구현 완료 후 `/dt-be-e2e`(수용 e2e 레이어)로 사람이 시나리오를 확정·검증한다. 개발단 신뢰는 Phase 4의 Controller integration(Supertest+실DB)이 담당한다.

### Phase 5 게이트 (FULL review + coverage)
풀 리뷰도 격리한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend, mode:full, worktreePath:$(pwd), baseRef:Phase 0 commit(dt-backend: start <task-id>)`로 dispatch. reviewer가 `review.mjs full --stack backend --base <SHA>`로 jest 커버리지 diff 80%까지 검증하고 verdict만 반환.

### Phase 5 commit
```bash
git add . && git commit -m "dt-backend Phase 5: <module> module"
```

## Final: Review & repair loop
Final review verdict가 `PASS`(Critical 0)면 완료. `NEEDS_REPAIR`면 `repairTargets`(repository|dto|service|controller|module) 기반으로 **be-builder 재dispatch**(메인 직접수정 금지) → 재리뷰(최대 1회). 2회차에도 Critical이면 **사용자 보고·중단**.

## 완료 처리
Phase 0-5 커밋 완료. 사용자에게 보고: "작업 완료. Phase 1~5 커밋이 현재 브랜치에 반영되었습니다."
