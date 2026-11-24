---
ruleId: testcontainers-lifecycle
summary: "Testcontainers는 beforeAll/afterAll로 기동·정리, 테스트 간 데이터 격리(truncate/트랜잭션 롤백)"
severity: important
appliesTo: ["src/**/__tests__/**/*.integration.test.ts", "test/**/*.e2e.test.ts"]
detection:
  - type: pattern-pair
    when: "GenericContainer|PostgreSqlContainer|RedisContainer|@testcontainers"
    requireAll: ["\bbeforeAll\s*\(", "\bafterAll\s*\(", "\.stop\s*\("]
    rationale: "컨테이너는 beforeAll 에서 띄우고 afterAll 에서 stop 한다 — 테스트마다 띄우거나 정리를 빠뜨리지 않는다"
relatedRules: [repository-integration-real-db, flaky-test-prevention]
---

# Testcontainers 수명주기와 격리

## 왜 중요한가
컨테이너를 테스트마다 띄우면 느리고, 데이터를 정리하지 않으면 테스트 간 간섭으로 flaky해진다. 컨테이너는 `beforeAll`에서 한 번 띄우고 `afterAll`에서 정리하며, 테스트 사이에는 truncate 또는 트랜잭션 롤백으로 상태를 초기화한다.

## ✅ Correct

예시는 기본값 PostgreSQL + Prisma다. DB가 다르면 모듈만 바꾼다 — `node "${CLAUDE_PLUGIN_ROOT}/scripts/stackAdapters.mjs" --json`의 `container`(예: `@testcontainers/mysql`의 `MySqlContainer`). 이 규칙은 모든 `@testcontainers` 모듈에 걸린다.

```ts
let container: StartedPostgreSqlContainer;
beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  process.env.DATABASE_URL = container.getConnectionUri();
  // prisma migrate deploy → AppModule 부팅
}, 60_000);
afterAll(async () => { await container.stop(); });
afterEach(async () => { await truncateAll(prisma); });
```

## 실행 환경 설정 (그대로는 안 도는 두 함정)

부트스트랩 직후 Testcontainers e2e가 **fresh 환경에서 raw 에러로 죽는** 두 지점 — new-project가 미리 깔아야 한다.

1. **Jest가 Testcontainers의 ESM 의존성을 트랜스폼하도록**: `testcontainers`는 `archiver`(→ `is-stream` 등) ESM 체인을 끌어와 ts-jest 기본 설정에서 `SyntaxError: Cannot use import statement outside a module`로 깨진다. `test/jest-e2e.json`에 `transformIgnorePatterns`를 둔다:
   ```jsonc
   // 가장 단순·확실 (전체 트랜스폼, 첫 run만 느림)
   "transformIgnorePatterns": []
   // 또는 allowlist (성능 우선): "/node_modules/(?!(testcontainers|@testcontainers|archiver|archiver-utils|zip-stream|compress-commons|crc32-stream|tar-stream|bare-events|streamx|b4a|fast-fifo|text-decoder|is-stream)/)"
   ```

2. **Docker Desktop이 아닌 런타임(colima·podman·rancher-desktop)**: 데몬을 못 찾거나 DB 컨테이너가 대기 시간 초과로 죽으면 소켓(`DOCKER_HOST`)과 Ryuk을 먼저 본다. 런타임별 값은 선택 참고 문서 `docs/refs/docker-runtime-hints.md`에 있다. CI(Docker Desktop·기본 도커)에선 필요 없다.

## 관련 규칙
- [[repository-integration-real-db]]
- [[flaky-test-prevention]]
