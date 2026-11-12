# dt-be-e2e — BE 수용 e2e 저작 기능 설계

> 상태: 설계(design) · 작성일 2026-07-15
> 선행: dt-e2e(FE 수용 레이어), 운영 보강(basedOnSpec·stale·시드 SOT 어휘)

## 1. 목표

dt-e2e(FE 수용 e2e 저작)의 백엔드 쌍. BE 스펙(dt-bespec 산출물)에서 수용 시나리오를 도출→사용자 승인→테스트 저작(Jest+Supertest+Testcontainers)→사람 검증하는 저작 루프를 제공한다. FE와 동일한 방법론·상태 어휘를 공유하되, 검증 대상(브라우저 여정 → API 계약·DB 부수효과)에 맞게 재정의한다.

핵심 결정(사용자 1:1 협의):
- **별도 스킬 `dt-be-e2e`** + 커맨드 `/dt-be-e2e [<resource|scope>]` — 플러그인 FE/BE 쌍 관례(dt-spec/dt-bespec 등). 방법론은 dt-e2e 설계 SOT 참조로 공유.
- **레이어 통합**: dt-backend-scaffold new-module **Phase 5의 e2e 자동생성 제거**(module 등록까지로 축소). 개발단 신뢰는 이미 강제인 Controller integration(Supertest+실DB)이 담당 — e2e는 dt-be-e2e가 저작하는 사람 주도 수용 레이어 하나로. (FE와 동일 논리)
- **verified = A안(검증의 검증)** — §5.
- **시드 SOT 완전 B 포함** — §6.
- **범위는 스킬 구현까지** — sample-api 도그푸딩은 별도 회차.

## 2. BE e2e의 정의 (시작점과 검증축)

BE e2e는 특정 함수 호출이 아니라 **전체 앱을 부팅하고 HTTP 문(門)으로 요청을 쏘는 것**이다(`e2e-full-app` 패턴 준수 — 전체 AppModule + 전역 파이프/가드 + Testcontainers 실인프라 + 인증 흐름). Unit(Service 직접 호출)·Integration(모듈 부분 부팅)이 못 잡는 전역 배선(ValidationPipe 등록 누락, 가드 미적용)을 잡는 유일한 계층이다.

**Then 저작 규약 — 검증축 4개 + 부정 경로:**
1. **상태코드** — 계약대로 201/400/401/403 등이 나오는가
2. **응답 계약** — body가 api-contract.md 스키마·값대로인가
3. **DB 부수효과** — 실제 Postgres에 저장/차감/삭제됐는가(Prisma 직접 조회 — 응답만 믿지 않음). 거부 시나리오에선 "부수효과 없음"도 검증
4. **후속 관찰** — 다음 API 호출에서 그 상태가 관찰되는가

critical 시나리오는 해피패스 + **부정 경로(401/403/400 — 계약의 절반이 거부 조건)** 를 포함한다. 크로스리소스 여정 예: `register → login → 보호된 엔드포인트 접근`.

### 2.1 시나리오 도출 지침 (리서치 반영 — "좋은 BE 수용 시나리오")

1. **커버리지 단위 = 문서화된 상태코드.** "문서화했으면 테스트하라" — api-contract.md가 명시한 엔드포인트×상태코드(201·400·401·403·404·409 각각)가 매트릭스의 행이다. 목표: 문서화된 엔드포인트 100% 해피패스 + 고우선 부정 경로(인증·권한·검증) 커버 — FE의 "고우선 FR 80–90%"에 대응하는 BE 기준.
2. **입력 검증 부정 표준 세트** — 입력을 받는 엔드포인트마다: 필수 필드 누락→400(필드 수준 에러), 잘못된 타입→400, 경계값(빈 문자열·최대 길이·0·음수), 예상 밖 필드(계약대로 무시 또는 거부). 케이스 선택은 기존 `test-case-design-techniques`(동등분할·경계값·결정표)를 payload에 적용.
3. **권한 매트릭스** — 보호 자원은 최소 3행: 무토큰→401, 타인 토큰→403(+부수효과 없음), 본인→성공. (sample-web 도그푸딩에서 FE FR-22와 동형)
4. **한 시나리오 = 한 계약.** 한 테스트에 무관한 비즈니스 규칙을 다발로 검증하지 않는다(assert 과광범위 = 실패 시 원인 불명).
5. **관찰 가능한 결과만 assert** — 응답·DB 부수효과·후속 API 관찰(§2 4축)까지만. private 구현(내부 함수 호출 여부·캐시 내부)은 assert 금지.

### 2.2 저작 안티패턴 (금지)

- 실 DB 회피(Repository·Prisma mock) — `integration-no-db-mocking` 위반, e2e 의미 소멸
- 공유 가변 상태(테스트 간 데이터 의존·순서 의존) — 테스트별 리셋(§5)으로 차단
- 고정 sleep·타이밍 가정 — readiness await(`testcontainers-lifecycle`)·응답 기반 대기만
- 응답만 믿기 — 변경 계열(POST/PATCH/DELETE)은 DB 부수효과 확인 필수(§2 축 3)

## 3. 시나리오 소스·원장

- **근거 소스**: `docs/specs/resources/<resource>/`의 **api-contract.md**(엔드포인트 계약 — 상태코드·스키마·인증, `<!-- from: IF-n -->` 역참조)를 계약 앵커로, requirements.md(EARS)를 보조로. 근거 표기 = `METHOD /path` + `IF-n`(있으면 REQ 병기) — FE의 FR-n 하드요구와 동일 원칙(발명 금지).
- **원장**: `docs/specs/resources/<resource>/<resource>.e2e-scenarios.md`(파일명에 리소스명 포함 규약 준용). 크로스리소스 여정은 `docs/specs/e2e/be-journeys.md`.
- **원장 필드·상태**: dt-e2e와 동일 — id·title·priority·근거 스펙·GWT·데이터 훅·status(`proposed→approved→automated→verified|failed`, `stale` 포함).
- **basedOnSpec 마커 기준 파일 = api-contract.md** — 계약 드리프트가 stale 트리거. 재실행 시 마커 비교→영향 시나리오 stale 강등→재승인 루프(dt-e2e §드리프트와 동일 절차).
- **리스크 태깅 BE 기준**: critical = 인증·데이터 변경(생성/수정/삭제)·권한 경계, important = 조회·목록·필터 계약, minor = 부가 표시 필드.

## 4. 반복 루프

```
1. 수집   api-contract(+requirements) → 엔드포인트 인벤토리 + 리스크 태깅
          (basedOnSpec 마커 비교 — 다르면 영향 시나리오 stale)
2. 제안   GWT 초안을 원장 파일에 proposed로 기록, 파일 경로 안내
3. 확인   사용자가 원장을 보고 승인 → approved
4. 저작   Jest+Supertest 테스트 작성(test/*.e2e.test.ts) → automated
5. 사전점검 headless 실행(jest e2e) 그린 확인 (Playwright MCP 해당 없음 — BE는 러너만)
6. 검증   [A안] AI가 원장 시나리오 ↔ 테스트 diff 요약을 제시 →
          사람이 assert가 계약을 제대로 무는지 리뷰 승인 + 그린 로그 확인 → verified
7. 반복   failed 수정·재검증, 신규는 proposed append
```

verified의 BE 정의: FE의 "headed로 화면을 본다"에 해당하는 실질은 **"검증이 올바른가를 사람이 본다"** — 저작된 assert의 품질(계약 4축을 제대로 물었는지) 리뷰가 사람 게이트다. AI 사전점검(그린)은 automated 품질보증일 뿐 verified를 대체하지 않는다.

## 5. 데이터 수명주기 (BE 판)

- **격리는 Testcontainers가 구조로 보장** — 런마다 새 컨테이너(FE의 msw/live 스위치 개념 없음, 항상 실인프라). live 게이트 불필요(격리가 기본값).
- **테스트별 리셋**: truncate + 재시드. Jest에서는 **beforeEach 신뢰 가능** — Playwright의 워커 재활용 함정(auto fixture 필요)과 다름을 명시해 혼동 방지.
- **시드 SOT 완전 B**: 풀스택 프로젝트에서 BE e2e 시드 스크립트는 **FE `src/mocks/seed-data.ts` 모듈을 공유 소비**하도록 저작한다(손 복제 금지 — 시드 SOT 규약의 배선 완성). FE 없는 BE 단독 프로젝트는 자체 seed 모듈을 SOT로.
- 자동 재시도 없음(결정적 실행) — flaky 방지는 testcontainers-lifecycle 패턴 준수(readiness await, 고정 sleep 금지).

## 6. 주변 정합 (플러그인 변경점)

| 대상 | 변경 |
|---|---|
| `dt-be-e2e` (신규) | SKILL.md(§2~5 규약) + `plugin/commands/dt-be-e2e.md` |
| `dt-backend-scaffold` | new-module Phase 5 e2e 자동생성 제거("module 등록"으로 축소, 커밋 템플릿 정합). extend-module도 동일 확인 |
| `dt-backend-testing` | `e2e-full-app` 본문에 "수용 레이어(dt-be-e2e) 소유" 재정의 + 파일 관례 `test/*.e2e.test.ts` 통일 명시(nest 기본 `.e2e-spec.ts` 드리프트 정리). 신규 `be-e2e-scenarios-required`(minor) — 리소스 스펙은 있는데 원장 없으면 경고 |
| `dt-backend-review` | 위 존재 룰 배선 — FE의 `requires-acceptance-ledger` 검출 모듈을 **경로 파라미터화 재사용**(pages→resources) + 테스트 + atlas |
| `dt-be-implement` | 완료 보고에 "이어서 `/dt-be-e2e` 진행할까요?" 넛지(자동 실행 아님) |

## 6.5 리서치 근거

- 문서화된 상태코드 전수 테스트("if you document it, test it")·엔드포인트 100%+부정 경로 목표: Speakeasy(REST API testing), Total Shift Left(2026 best practices).
- 입력 검증 부정 표준 세트(누락·타입·경계값·예상 밖 필드): Bright Security, Total Shift Left.
- 안티패턴(assert 과광범위·과도한 mock·공유 가변 상태·타이밍 가정·private 내부 assert): thunders.ai(E2E test architecture), Testim(Supertest).
- 계약(OpenAPI) 기준 검증·AAA·teardown per test: AccelQ(contract testing), dev.to(Jest+Supertest).

## 7. 비범위

- sample-api 도그푸딩(별도 회차 — 이 설계 완료 후 계획), CI 자동화, 성능·부하 테스트, FE dt-e2e 변경, 계약 테스트(consumer-driven contract) 도입.

## 8. 성공 기준

- `/dt-be-e2e`가 api-contract에서 엔드포인트 인벤토리를 뽑아 리스크 태깅된 GWT 시나리오를 원장(proposed)으로 제안한다.
- 승인분이 검증축 4개+부정 경로 규약을 지키는 Jest+Supertest+Testcontainers 테스트로 저작된다.
- 사람 검증(A안: 원장↔테스트 diff 리뷰 + 그린 로그)으로만 verified 승격.
- BE 스캐폴드 Phase 5에서 e2e 자동생성이 제거되고, `be-e2e-scenarios-required`가 리뷰에서 동작(리뷰 스위트 그린).
- 시드 SOT: 풀스택 프로젝트에서 FE seed-data 공유 소비가 규약·저작 지침으로 명시된다.
