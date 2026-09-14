---
name: dt-backend-testing
description: Use when writing or reviewing tests in a NestJS project that contains .dt-backend.json — explains the 3-tier backend test strategy (Jest unit / Supertest+Testcontainers integration / e2e API) with per-layer patterns and the rules consumed by dt-backend-review.
---

# dt-backend Testing Strategy (NestJS)

> **다른 스킬과의 관계**
> - 작성 시점 구조 룰: `dt-backend-architecture` (Atlas)
> - 작성 후 검증: `/dt-be-review` 또는 `dt-backend-review`
> - 본 skill = 테스트 전략 + 테스트 전용 룰 Atlas

## 3계층 전략

| 계층 | 대상 | 도구 | 위치/접미사 | 비중 |
|---|---|---|---|---|
| Unit | 단일 Service/Mapper/util (Repository는 mock) | Jest + `Test.createTestingModule` | `**/__tests__/*.unit.test.ts` | 60–70% |
| Integration | Controller+Service+Repository+**실 Postgres/Redis** | Jest + Supertest + Testcontainers | `**/__tests__/*.integration.test.ts` | 20–30% |
| E2E | 전체 AppModule, 실인프라, 인증 흐름 | Jest + Supertest + Testcontainers | `test/*.e2e.test.ts` | 5–10% |

**도구 선택**
- **Jest** — NestJS 기본(`@nestjs/testing` 생태계가 Jest 전제)
- **Supertest** — HTTP 레벨 검증 (라우팅·ValidationPipe·상태코드)
- **Testcontainers** — 실제 Postgres/Redis 기동 → "don't mock what you don't own"(Kent C. Dodds) 준수

**레이어 → 계층 매핑**: Util→Unit / Service→Unit(Repository mock) / Repository→Integration(실 DB) / Controller→Integration(Supertest) / Module·앱→E2E.

## 외부 자산 인용
- superpowers `test-driven-development` — RED→GREEN→Refactor (scaffold 에이전트가 테스트 우선)
- Kent C. Dodds — "Don't mock what you don't own" (`integration-no-db-mocking`의 근거)
- Testcontainers — 실제 의존성 기동 (`testcontainers-lifecycle`의 근거)
- Supertest / NestJS testing docs — HTTP 통합 테스트

## Atlas — 테스트 작성 시 알아야 할 룰

<!-- ATLAS:START — `node plugin/scripts/regen-atlas.mjs`로 자동 생성. 직접 수정하지 마세요. -->

### Testing
- **coverage-rules** _(critical)_ — 비즈니스 코드 80%+ (DTO/entity 제외), critical 영역(service/repository) 85% 권장, 어서션 품질 우선 [상세](patterns/coverage-rules.md)
- **integration-no-db-mocking** _(critical)_ — 통합 테스트에서 Prisma/Repository를 mock하면 통합 의미 소실 — 실제 DB(Testcontainers) 사용 [상세](patterns/integration-no-db-mocking.md)
- **controller-integration-supertest** _(important)_ — Controller 통합 테스트는 Supertest로 HTTP를 통해 라우팅·검증·상태코드를 검증 [상세](patterns/controller-integration-supertest.md)
- **e2e-full-app** _(important)_ — E2E는 전체 AppModule을 실인프라(Testcontainers Postgres/Redis)+인증과 함께 부팅해 검증 — 수용 레이어(dt-be-e2e) 소유 [상세](patterns/e2e-full-app.md)
- **flaky-test-prevention** _(important)_ — 고정 sleep(setTimeout) 금지, 컨테이너/앱 readiness를 await, 결정적 시드 데이터 사용 [상세](patterns/flaky-test-prevention.md)
- **repository-integration-real-db** _(important)_ — Repository 테스트는 실제 Postgres(Testcontainers)에서 쿼리·제약·트랜잭션을 검증 [상세](patterns/repository-integration-real-db.md)
- **service-unit-mocks-repository** _(important)_ — Service 단위 테스트는 Repository provider를 mock해 비즈니스 로직만 격리 검증 [상세](patterns/service-unit-mocks-repository.md)
- **testcontainers-lifecycle** _(important)_ — Testcontainers는 beforeAll/afterAll로 기동·정리, 테스트 간 데이터 격리(truncate/트랜잭션 롤백) [상세](patterns/testcontainers-lifecycle.md)
- **be-e2e-scenarios-required** _(minor)_ — 리소스 스펙(requirements.md)은 있는데 수용 e2e 원장(*.e2e-scenarios.md)이 없는 리소스를 존재 안전망으로 경고(머지 차단 아님) [상세](patterns/be-e2e-scenarios-required.md)
- **test-case-design-techniques** _(minor)_ — 경계값/동등분할/결정표/상태전이로 케이스 도출 — happy/error/edge를 명시적으로 분리 [상세](patterns/test-case-design-techniques.md)
- **test-writing-structure** _(minor)_ — AAA(Arrange/Act/Assert), 명확한 네이밍, 한 테스트=한 동작, 픽스처는 Builder로 [상세](patterns/test-writing-structure.md)

<!-- ATLAS:END -->

> 참고: Service/Controller의 sibling 테스트 **존재 강제**는 `dt-backend-architecture`의 `service-requires-unit-test` / `controller-requires-integration-test`가 담당한다.

## 활성화 조건
`.dt-backend.json`이 있고 `enabledSkills`에 `dt-backend-testing` 포함된 프로젝트에서만 의미가 있습니다.
