# Checklist: New Project (NestJS bootstrap)

사용자 요청 예: "NestJS 백엔드 프로젝트 만들어줘"

신규 프로젝트는 worktree 격리 없이 현재 디렉토리(또는 지정 경로)에 부트스트랩한다.

## 1. 스택 확인 (AskUserQuestion)
- DB(기본 PostgreSQL), 캐시/큐(Redis/BullMQ 사용 여부), 인증 전략(JWT/session/none), 패키지 매니저(npm/pnpm) 확인.
- **Docker 프리플라이트**: dev DB(compose)와 통합/e2e(Testcontainers)가 **모두 Docker 데몬**을 요구한다. 부트스트랩 전에 `docker info`로 **설치 + 데몬 실행**을 확인하고, 안 되면 설치/기동(예: Docker Desktop 실행)을 안내한 뒤 **중단**한다 — 이후 `docker compose up`·통합테스트가 raw 에러로 죽는 것을 막는다. (Docker 없이 진행을 원하면 dev DB는 외부 Postgres `DATABASE_URL`로 대체하고 통합/e2e는 스킵으로 둔다.)
  - 데몬뿐 아니라 **`docker compose version`(v2 서브커맨드)** 도 확인한다 — 일부 설치(예: brew standalone `docker-compose`)는 데몬은 떠 있어도 `docker compose`가 없어 `unknown command`로 죽는다. 없으면 cli-plugins 심링크(`ln -sfn $(brew --prefix)/bin/docker-compose ~/.docker/cli-plugins/docker-compose`)를 안내.
  - **Docker Desktop이 아닌 런타임(colima/podman)**: `docker context ls`로 활성 엔드포인트를 확인하고 Testcontainers용 `DOCKER_HOST`(예: `unix://$HOME/.colima/default/docker.sock`)를 안내한다 — 비어 있으면 통합/e2e가 데몬을 못 찾는다. (→ `dt-backend-testing` testcontainers-lifecycle)

## 2. NestJS + Prisma 스캐폴드
```bash
npx @nestjs/cli new <project> --skip-git --package-manager npm
cd <project>
npm i @prisma/client@^6 class-validator class-transformer
npm i -D prisma@^6 @testcontainers/postgresql supertest @types/supertest
npx prisma init --datasource-provider postgresql

# 인증 JWT 선택 시 (캐논: Passport + JWT)
npm i @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm i -D @types/passport-jwt @types/bcrypt
```
> **Prisma는 `@^6`로 핀한다.** 미고정 시 fresh 설치가 Prisma 7을 끌어오는데, 7은 generator가 `prisma-client`(구 `prisma-client-js` 아님)·클라이언트 출력이 `../generated/prisma`·datasource url이 `prisma.config.ts`로 분리라, 캐논의 `import { PrismaClient } from '@prisma/client'`가 파손되어 `tsc`가 죽는다(`has no exported member 'PrismaClient'`). 의도적으로 Prisma 7을 채택하려면 generator provider·임포트 경로·config를 함께 갱신할 것.

## 3. 공통 인프라 작성
- `src/prisma/prisma.service.ts` + `src/prisma/prisma.module.ts` (PrismaClient 래핑, 유일한 Prisma 진입점)
- `src/cache/cache.module.ts` + `src/cache/cache.service.ts` + `src/cache/cache-keys.ts` (Redis 사용 시)
- `src/common/filters/all-exception.filter.ts` (전역 ExceptionFilter)
- `src/main.ts`에 전역 `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` + 전역 필터 등록. **FE 연동 시 `app.enableCors({ origin: true, credentials: true })`** 추가 — 없으면 브라우저가 교차출처(다른 포트의 FE dev 서버) 요청을 차단한다(운영에선 origin 화이트리스트로 좁힘).
- (인증 JWT 시) `ConfigModule.forRoot({ isGlobal: true })` + `src/common/auth/` 캐논 골격: `JwtModule.registerAsync`(secret을 `ConfigService`에서 주입, 하드코딩 금지) + `JwtStrategy`(passport-jwt) + `AuthGuard('jwt')` 기반 가드. plain 커스텀 가드 만들지 말 것. 발급(register/login/refresh)은 `templates-backend/auth-recipe.md`로 별도 리소스 생성. (→ `dt-backend-architecture` 인증 절)
  - *타입 주의*: env 문자열 TTL을 `signOptions.expiresIn`에 넣으면 `string`↛`StringValue`로 `tsc`가 막는다 — `useFactory` 반환을 `as JwtModuleOptions`, `signAsync`의 옵션을 `as JwtSignOptions`로 캐스팅한다.
- **로컬 dev DB (Postgres)**: 프로젝트 루트에 `docker-compose.yml`을 **직접 작성**(Postgres 16 + healthcheck + named volume). 보일러플레이트 복사 안 함.
  - *Docker를 기본으로 두는 이유*: 통합/e2e(Testcontainers)가 어차피 Docker를 요구하므로 dev DB도 같은 것으로 통일해 **의존성을 하나로** 유지(+ 버전 고정·1초 리셋·온보딩 단순화). native Postgres를 쓰고 싶으면 `DATABASE_URL`만 그쪽으로 돌리면 된다. `.env`에 compose와 **일치하는** 값을 기록한다 — `prisma init`이 만든 플레이스홀더 `DATABASE_URL`을 이 값으로 교체:
  - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT`
  - `DATABASE_URL="postgresql://<USER>:<PASSWORD>@localhost:<PORT>/<DB>?schema=public"`
  - 이 compose는 **dev/migration 전용**. 통합/e2e 테스트 DB는 Testcontainers가 별도 임시 컨테이너로 띄우므로 무관하다.
  - **원격 DB로 전환**: `DATABASE_URL`만 교체하면 된다(코드/스키마는 전부 이 env 한 곳을 본다). 단 매니지드 DB는 보통 `?sslmode=require`를 붙이고, 공유·운영 DB에는 `prisma migrate dev` 대신 `prisma migrate deploy`를 쓴다(dev 리셋 금지). 테스트는 그대로 Testcontainers를 쓴다.

## 4. 설정 파일
- `.dt-backend.json`을 프로젝트 루트에 **직접 작성** (paths/coverage/enabledSkills 등 — 보일러플레이트 복사 안 함)
- `jest.config.js`: `coverageReporters: ['text','json-summary']`, `collectCoverageFrom: ['src/**/*.{service,repository}.ts']`
- `test/jest-e2e.json`: Testcontainers의 ESM 의존성(`archiver`→`is-stream` 등)을 트랜스폼하도록 **`"transformIgnorePatterns": []`** 추가 — 없으면 통합/e2e가 `SyntaxError: Cannot use import statement outside a module`로 즉사한다(nest 기본 e2e 설정은 이를 다루지 않음). (→ `dt-backend-testing` testcontainers-lifecycle)
- `CLAUDE.md`: 컨벤션 요약 (레이어/룰 진입점)
- `package.json` scripts에 dev DB 편의 명령: `"db:up": "docker compose up -d db"`, `"db:down": "docker compose down"`, `"db:reset": "docker compose down -v && docker compose up -d db"`

## 5. 검증
```bash
docker info >/dev/null 2>&1 || { echo "Docker 데몬이 꺼져 있음 — Docker Desktop 실행 후 재시도"; exit 1; }
docker compose up -d db        # 로컬 dev DB 기동 (healthcheck OK까지 대기)
npx tsc --noEmit && npx prisma validate
```
> 초기 마이그레이션은 첫 모듈 scaffold(`new-module` Phase 2의 `prisma migrate dev`)에서 생성된다 — 그때 이 dev DB가 떠 있어야 한다.

### 실행 모드 선택 (정책 원칙 1)
병렬 dispatch 전, 작업 단위 의존성을 보고 `orchestration-policy.md` 원칙 1의 AskUserQuestion으로 병렬/순차를 1회 확인한다(기본 병렬). 순차 선택 시 원칙 2대로 단위를 직렬 dispatch한다.

통과하면 첫 모듈은 `checklist/new-module.md`로 추가(병렬 dispatch·리뷰 격리는 그 흐름을 따른다).
