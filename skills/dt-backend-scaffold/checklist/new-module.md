# Checklist: New Module (NestJS)

사용자 요청 예: "orders 모듈 추가해줘 (주문 생성/조회)"

다음을 순서대로 수행하라. 각 phase 끝에서 commit 후 다음 phase 진행.
gate 스크립트: `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/`. ORM 검사는 `--orm-check schema|migrations`가 `stack.orm`(prisma·typeorm)에 맞춰 고른다. `--orm-check` 없이 `--stack backend`만 주면 prisma일 때 `prisma validate`만 돈다(옛 `--prisma`·`--prisma-args`도 받는다). Drizzle은 ORM 검사가 없다 — 계층은 같고, 스키마·마이그레이션은 기존 형제 모듈의 방식을 따른다.

> **실행 주체**: dispatched 모드면 Phase 0~5의 작성·게이트·커밋은 `be-builder`가 하고, **Phase 5 풀 리뷰와 Final 수리 루프는 조율자가** 한다 — 서브에이전트는 다른 서브에이전트를 부를 수 없다(원칙 3). inline degrade면 조율자가 전부 직접 한다(원칙 4). 절차는 같다. **계층 구현 룰의 단일 출처는 `Skill("dt-backend-architecture")`·`Skill("dt-backend-testing")`**(계층별 prompt 없음). Phase 1~4 게이트는 `gate.mjs`(tsc·테스트·규칙 검사)이고, 걸린 것은 그 자리에서 고친다. 격리 리뷰는 조율자가 `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend`으로 dispatch해 verdict만 받는다(inline 시 review.mjs `--stack backend` 직접). `NEEDS_REPAIR`면 조율자가 `repairTargets`+`.dt-impl`로 be-builder를 재dispatch한다(1회, 메인 직접수정 금지).

## Phase 0: 작업 준비
1. **task-id 생성**: 예 `2026-06-09-orders`. (YYYY-MM-DD-<module>)
2. **Phase 0 commit** (rollback 기준점):
   ```bash
   git commit --allow-empty -m "dt-backend: start <task-id>"
   ```

## Phase 1: Contract 정의 (데이터 계약)
ORM은 `node "${CLAUDE_PLUGIN_ROOT}/scripts/stackAdapters.mjs" --project . --json`의 `orm`이다. Phase 1·2만 ORM에 따라 다르고, Phase 3~5는 같다. 스펙의 데이터 모델(`api-contract.md`의 Prisma 스케치)은 모델 표기일 뿐이다 — TypeORM이면 같은 모델을 엔티티로 옮긴다.

Write 도구로 작성:
1. **`src/<module>/contracts/<module>.contract.ts`** — DTO 인터페이스 + 도메인 Model + `XxxRepository`/`XxxService` 인터페이스. ORM import 없음. 레퍼런스: `${CLAUDE_PLUGIN_ROOT}/skills/dt-backend-scaffold/examples/orders.contract.ts`
2. **스키마 계약** — 이번 모듈의 모델(결정론적 스키마 계약):
   - **prisma**: `prisma/schema.delta.prisma`의 `model`/`enum` 블록. 레퍼런스: `examples/schema.delta.prisma`
   - **typeorm**: `src/<module>/entities/<module>.entity.ts`. 레퍼런스: `examples/order.entity.ts`(같은 orders 모델)
3. **`src/cache/cache-keys.ts`** — (캐시 사용 시) 도메인 캐시 키 팩토리.
4. **owners** — 충돌 방지용 경로 소유 매핑(레퍼런스 `examples/owners.json`). dispatched 단일 be-builder면 한 일꾼이 전 계층 소유; 리소스 간 병렬일 때만 모듈별 경로로 분리.

### Phase 1 게이트 (tsc + ORM 스키마 검사)
prisma면 `prisma/schema.delta.prisma` 블록을 `prisma/schema.prisma`에 병합한 뒤 돌린다:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
  --stack backend --orm-check schema --test false --review false
```
`--orm-check schema`는 ORM별 검사를 고른다(`scripts/stackAdapters.mjs`의 `ORM_GATE_CHECKS`): prisma → `prisma validate`, typeorm → 따로 없음(엔티티는 tsc가 본다). 실패면 contract/스키마를 고치고 다시 돌린다.

### Phase 1 commit
```bash
git add -A && git commit -m "dt-backend Phase 1: <module> contract"
```

## Phase 2: Repository + DTO
두 계층을 `dt-backend-architecture` 룰대로 구현한다(계층별 prompt 없음 — 룰이 단일 출처). **dispatched면 be-builder가, inline이면 조율자가 직접.** (서로 다른 리소스의 be-builder는 상위에서 병렬 — 단 공유 스키마·마이그레이션 구간은 순차.)
- **Repository**: `<module>.repository.ts` — ORM은 Repository에서만(`repository-only-orm`).
  - **prisma**: `PrismaService` 주입. schema 병합 + `prisma migrate dev --name <변경>`.
  - **typeorm**: `@InjectRepository(XxxEntity) private readonly repo: Repository<XxxEntity>`. 모듈 `imports`에 `TypeOrmModule.forFeature([XxxEntity])`(Phase 5에서 와이어링해도 된다). 마이그레이션은 `migration:generate -- src/database/migrations/<변경>`으로 만들고 `migration:run`으로 dev DB에 적용한다(프리셋이 넣은 package.json 스크립트 — `commands`가 아니라 프로젝트 스크립트를 패키지 관리자로 부른다).
  - 엔티티·ORM 행 → 도메인 Model 변환은 Repository 안에서 한다. 위 계층은 contract의 Model만 본다.
- **DTO**: `dto/**` — 요청 DTO는 class-validator 데코레이터 필수, ORM·Entity import 금지, Mapper(순수) 포함.
- **여러 쓰기를 한 트랜잭션으로**(interactions·plan의 `[X]`): 트랜잭션은 Repository 메서드 안에 둔다 — 서비스는 ORM을 가져오지 않는다. prisma → `this.prisma.$transaction(async (tx) => …)`, typeorm → `this.dataSource.transaction(async (manager) => …)`(`DataSource` 주입).

### Phase 2 게이트
1. **게이트** — tsc·ORM 마이그레이션 검사·jest·규칙 검사(review.mjs partial). dev DB(`docker compose up -d db`)가 떠 있어야 한다:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --orm-check migrations --test-runner jest --stack backend \
     --paths "src/<module>/<module>.repository.ts,src/<module>/dto"
   ```
   `--orm-check migrations`는 모델을 바꾸고 마이그레이션을 빠뜨렸는지 dev DB와 비교한다: prisma → `prisma migrate diff --from-schema-datasource … --exit-code`, typeorm → `migration:generate --check`(파일은 만들지 않는다). dev DB를 띄울 수 없으면 `--orm-check schema`로 돌리고 반환 `summary`에 "마이그레이션 검사 못 함"을 적는다.
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

게이트 실패 시: 해당 계층을 고치고 다시 돌린다. 3회 안에 통과하지 못하면 남은 실패를 담아 `status: draft`로 반환한다 — 조율자가 사용자에게 보고한다.

### Phase 2 commit
```bash
git add . && git commit -m "dt-backend Phase 2: <module> repository + dto"
```

## Phase 3: Service
contract의 `XxxService` 인터페이스대로 구현(`<module>.service.ts`). Repository mock 단위 테스트 동시 작성.

### Phase 3 게이트
1. **게이트** — tsc·jest·규칙 검사(review.mjs partial):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --test-runner jest --stack backend --paths "src/<module>/<module>.service.ts"
   ```
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

### Phase 3 commit
```bash
git add src && git commit -m "dt-backend Phase 3: <module> service"
```

## Phase 4: Controller + Integration test
`<module>.controller.ts` 구현(비즈로직 금지). Supertest + Testcontainers 통합 테스트(ORM·Repository mock 금지). 컨테이너 DB에는 마이그레이션을 적용한다 — prisma `migrate deploy`, typeorm `TypeOrmModule.forRoot({ …, migrations, migrationsRun: true })`(`testcontainers-lifecycle`).

### Phase 4 게이트
1. **게이트** — tsc·jest·규칙 검사(review.mjs partial):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/gate.mjs" --project . \
     --test-runner jest --stack backend \
     --paths "src/<module>/<module>.controller.ts,src/<module>/__tests__/<module>.controller.integration.test.ts"
   ```
2. 걸린 항목은 이 Phase 안에서 고치고 게이트를 다시 돌린다. 격리 리뷰는 Phase 5 뒤에 조율자가 한다.

### Phase 4 commit
```bash
git add src && git commit -m "dt-backend Phase 4: <module> controller"
```

## Phase 5: Module 와이어링 + AppModule 등록
`src/<module>/<module>.module.ts`(controllers/providers/imports/exports), `src/app.module.ts`에 등록(가산적).

> E2E는 여기서 자동 생성하지 않는다. 구현 완료 후 `/dt-be-e2e`(수용 e2e 레이어)로 사람이 시나리오를 확정·검증한다. 개발단 신뢰는 Phase 4의 Controller integration(Supertest+실DB)이 담당한다.

### Phase 5 게이트 (빌더) → FULL review + coverage (조율자)
빌더는 Phase 5도 `gate.mjs`로 검사·커밋한 뒤 봉투를 반환한다. 이어서 **조율자가** 풀 리뷰를 격리 dispatch한다(원칙 3): `${CLAUDE_PLUGIN_ROOT}/agents/reviewer.md`를 `stack:backend, mode:full, worktreePath:$(pwd), baseRef:Phase 0 commit(dt-backend: start <task-id>), interactions:docs/specs/interactions.md(있으면)`로 dispatch. reviewer가 `review.mjs full --stack backend --base <SHA>`로 jest 커버리지 diff 80%까지 검증하고 verdict만 반환.

### Phase 5 commit
```bash
git add . && git commit -m "dt-backend Phase 5: <module> module"
```

## Final: Review & repair loop (조율자)
Final review verdict가 `PASS`(Critical 0건)이면 완료.
`NEEDS_REPAIR`이면 조율자가:
1. `findings`를 `source`로 나눈다. `source: spec | plan`인 항목은 코드로 못 고친다 — be-builder를 부르지 않고 사용자에게 보고해 스펙·플랜 단계로 되돌릴지 묻는다.
2. `source: code` 항목은 `repairTargets`(repository|dto|service|controller|module)+`.dt-impl` 상태로 **be-builder를 재dispatch**한다(메인 직접수정 금지). 빌더는 그 항목만 고치고 게이트·커밋 후 반환한다.
3. 조율자가 reviewer(`mode:full`)를 다시 dispatch한다(수리는 최대 1회).
4. 2회차에도 `NEEDS_REPAIR`이면 **사용자 보고·중단** — 사용자가 직접 수정 결정.

## 완료 처리
Phase 0-5 커밋 완료. 사용자에게 보고: "작업 완료. Phase 1~5 커밋이 현재 브랜치에 반영되었습니다."
