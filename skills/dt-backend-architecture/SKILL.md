---
name: dt-backend-architecture
description: Use when writing or reviewing NestJS/TypeScript code in a project that contains .dt-backend.json — explains the layered backend architecture (Controller → Service → Repository → Prisma, with DTO/Entity/Cache/Module), where each kind of logic belongs, and lists the rules consumed by dt-backend-review.
---

# dt-backend Layered Architecture (NestJS)

> **다른 스킬과의 관계**
> - 본 skill = **기계적 구조 룰** (어느 레이어/어떤 import — review가 자동 검출). 판단 규율(과한 추상화·수술적 변경 등)은 `dt-backend-coding-discipline`에 별도 정리됨 — 코드 작성 시 함께 invoke 권장
> - 테스트 작성 시: `dt-backend-testing` 도 함께 invoke (테스트 룰/전략은 거기 정리됨)
> - 신규 모듈 생성 시: `dt-backend-scaffold` invoke
> - 작성 후 검증: `/dt-be-review` 또는 `dt-backend-review` skill
>
> 본 skill은 **architecture/testing 룰의 단일 atlas**를 제공한다. 이 SKILL.md만 로드되어도 작성 시점에 필요한 모든 룰을 1줄 요약으로 인지할 수 있다.
>
> **레이어 계약:** 본 전역 컨벤션은 **상위 SDD 스펙/project-context 없이도 단독 적용**된다(상위는 선택적, hard-depend 금지). 상위가 있으면 `project-context.md`의 `## 프로젝트 기술/라이브러리`로 라이브러리를 **가산**(전역보다 우선)할 수 있다. 전역 choice 룰을 거스르는 예외는 사용자 합의 후에만(웨이브 B). 상세 `../../docs/skill-sdd-layering.md`.

## 레이어 개요

```
Controller → Service → Repository → Prisma
                ↘ Cache service (Redis) / Queue (BullMQ)
DTO (경계 계약)  ·  Entity/Model (내부 도메인)  ·  Module (DI 와이어링)
```

| 레이어 | 위치 | 책임 | 금지 |
|---|---|---|---|
| Controller | `src/**/*.controller.ts` | 라우트 진입, DTO 검증, Service 위임, 응답 DTO 매핑, HTTP 상태 | Prisma 직접, 비즈니스 로직, Redis 직접, 수동 응답 빌드 |
| Service | `src/**/*.service.ts` | 비즈니스 로직, 유스케이스 오케스트레이션, 트랜잭션, 도메인 예외 | HTTP 컨텍스트(`@Req`/`@Res`), Prisma 직접(Repository 경유) |
| Repository | `src/**/*.repository.ts` | **유일한 `PrismaClient` 호출자**, 쿼리 캡슐화, 도메인 Model 반환 | HTTP/DTO 관심사, 비즈니스 판단, `HttpException` |
| DTO | `src/**/dto/*.dto.ts` | 요청/응답 형태 + `class-validator` + swagger 주석 | 비즈니스 로직, Prisma/Entity import |
| Entity/Model | `src/**/entities/*.entity.ts` | Service↔Repository 도메인 타입 | validator 데코레이터, HTTP |
| Cache | `src/cache/**` | 유일한 Redis 접근, cache-key 팩토리 | 비즈니스 로직, Prisma |
| Queue | `src/queue/**`, `*.processor.ts` | BullMQ producer/consumer | DB 직접 쓰기(Repository 경유), HTTP |
| Module | `src/**/*.module.ts` | DI 와이어링(controllers/providers/imports/exports) | 로직, 수동 `new` |
| Common | `src/common/**` | 전역 `ExceptionFilter`, `ValidationPipe`, 인터셉터 | 컨트롤러별 ad-hoc try/catch |

## 의사결정 트리

"이 로직 어디에 둘까?"

| 로직 | 위치 |
|---|---|
| DB 쿼리(find/create/update/delete) | Repository |
| 트랜잭션·유스케이스 오케스트레이션 | Service |
| DTO → 도메인 Model 변환 | Mapper (Service 경유) |
| 요청 검증 규칙(필수/형식/범위) | 요청 DTO + 전역 ValidationPipe |
| 캐시 조회/저장 | Cache service (Redis) |
| 비동기 잡(이메일/리포트) | Queue (BullMQ) producer |
| 에러 → HTTP 상태 매핑 | 도메인 예외 throw → 전역 ExceptionFilter |
| 응답 형태(외부 계약) | 응답 DTO |
| 라우팅/상태코드 | Controller |

## 도구/규약

- **Prisma + PostgreSQL** — `schema.prisma`가 데이터 계약. `@prisma/client`는 Repository에만.
- **Redis (+ BullMQ)** — cache service / queue 모듈 한 곳으로 접근 격리.
- **class-validator + 전역 ValidationPipe**(`whitelist: true, forbidNonWhitelisted: true`) — 검증은 경계에서만.
- **패키지 매니저/테스트** — `dt-backend-testing` 참조 (Jest + Supertest + Testcontainers).

## 인증 (Passport + JWT) — 캐논

인증은 **Passport + JWT로 통일**한다(발급·검증 동일 패러다임). plain 커스텀 가드를 새로 만들지 않는다.

| 관심사 | 위치 | 캐논 |
|---|---|---|
| 토큰 검증 | `src/common/auth/` (Common) | `JwtStrategy`(passport-jwt) + `AuthGuard('jwt')` |
| refresh 검증 | `src/common/auth/` (Common) | `RefreshTokenStrategy` + `AuthGuard('jwt-refresh')` |
| 토큰 발급/로그인 | `src/auth/` 리소스 (Service) | `bcrypt.compare` → `JwtService.sign`. 발급 리소스 스펙은 `templates-backend/auth-recipe.md` |
| 시크릿 | `src/app.module.ts` | `ConfigModule` → `JwtModule.registerAsync`(secret from `ConfigService`). 하드코딩 금지 |
| 비밀번호 | `prisma/schema.prisma` | `User.passwordHash`(bcrypt), 응답 비노출 |

- 가드/전략은 Common 레이어 — `service-no-http-context` 준수(HTTP 컨텍스트는 가드까지). **인가(소유권/역할) 판단은 service 책임**이며 인증(authN)과 구분한다.
- 발급 리소스(`auth`)는 일반 리소스와 동일한 5-layer로 생성된다 — 엔진은 특수 취급하지 않는다.
- 원천(OpenAPI security scheme 등)이 다른 인증 방식을 명시하면 그것을 우선한다(소스-퍼스트). 본 캐논은 원천이 침묵할 때의 하우스 스타일이다.

## Atlas — 작성 시점에 알아야 할 모든 룰

각 룰은 1줄 요약 + 등급. 자세한 incorrect/correct는 `[상세]` 링크의 patterns 파일.

<!-- ATLAS:START — `node plugin/scripts/regen-atlas.mjs`로 자동 생성. 직접 수정하지 마세요. -->

### Architecture
- **controller-no-direct-prisma** _(critical)_ — Controller는 PrismaClient/prisma 직접 호출 금지, Service→Repository 경유 [상세](patterns/controller-no-direct-prisma.md)
- **dto-no-prisma-import** _(critical)_ — DTO는 Prisma/Entity import 금지 — 순수 wire 계약(class-validator)만 [상세](patterns/dto-no-prisma-import.md)
- **redis-through-cache-service** _(critical)_ — Redis 클라이언트(ioredis/redis/cache-manager) import는 src/cache/** 한정 — 외부는 cache service 경유 [상세](patterns/redis-through-cache-service.md)
- **repository-only-prisma** _(critical)_ — @prisma/client import는 Repository와 PrismaModule에서만 — 그 외 레이어 금지 [상세](patterns/repository-only-prisma.md)
- **service-no-direct-prisma** _(critical)_ — Service는 PrismaClient 직접 호출 금지, Repository 경유 (지속성 분리) [상세](patterns/service-no-direct-prisma.md)
- **service-no-http-context** _(critical)_ — Service는 HTTP 컨텍스트(@Req/@Res/express Request·Response) 접근 금지 — transport 무관 [상세](patterns/service-no-http-context.md)
- **centralized-cache-keys** _(important)_ — 캐시 키 팩토리는 cache-keys.ts 단일 위치 — 다른 파일에서 별도 CacheKeys export 금지 [상세](patterns/centralized-cache-keys.md)
- **centralized-error-handling** _(important)_ — Controller에서 수동 HTTP 응답(res.status/res.send) 빌드 금지 — 전역 ExceptionFilter 사용 [상세](patterns/centralized-error-handling.md)
- **controller-no-business-logic** _(important)_ — Controller는 검증·위임만 — 분기/계산/트랜잭션 등 비즈니스 로직 금지 (Service로) [상세](patterns/controller-no-business-logic.md)
- **controller-requires-integration-test** _(important)_ — 모든 Controller는 형제 통합 테스트(*.integration.test.ts) 필수 (Supertest+실DB) [상세](patterns/controller-requires-integration-test.md)
- **dto-vs-entity** _(important)_ — Controller는 응답으로 DTO만 노출 — raw Entity/Prisma 모델 반환 금지 [상세](patterns/dto-vs-entity.md)
- **module-registration** _(important)_ — 새 Controller/Provider는 형제 *.module.ts에 등록 — DI 와이어링 누락 금지 [상세](patterns/module-registration.md)
- **queue-through-bull-module** _(important)_ — Service는 bullmq/bull 직접 import 금지 — 주입된 큐 producer 경유 [상세](patterns/queue-through-bull-module.md)
- **service-requires-unit-test** _(important)_ — 모든 Service는 형제 단위 테스트(*.unit.test.ts) 필수 [상세](patterns/service-requires-unit-test.md)
- **validation-at-boundary** _(important)_ — 요청 DTO는 class-validator 데코레이터로 경계에서 검증 — 검증은 Controller 경계에서만 [상세](patterns/validation-at-boundary.md)

<!-- ATLAS:END -->

## 주석 규칙

**기본: 주석 없음.** 이름이 잘 지어진 코드는 설명이 필요 없다. WHY가 코드만으론 안 보일 때만 쓰고, WHAT(단계 설명/함수명 반복/태스크 참조)은 절대 쓰지 않는다. (FE `dt-frontend-architecture`와 동일 원칙.)

## 활성화 조건

이 스킬은 `.dt-backend.json`이 있고 `enabledSkills`에 포함된 프로젝트에서만 의미가 있습니다.
