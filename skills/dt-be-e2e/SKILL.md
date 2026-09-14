---
name: dt-be-e2e
description: Use after /dt-be-implement to author and verify scenario-based acceptance e2e (Jest+Supertest+Testcontainers) for implemented backend resources. Derives risk-tagged Given-When-Then scenarios strictly from resource specs (api-contract.md endpoints/status codes + requirements EARS), authors full-AppModule HTTP tests, and a human verifies by reviewing ledger↔test diff plus green run. Scenarios tracked in a status ledger. Triggers on "/dt-be-e2e", "BE 수용 테스트", "API e2e 시나리오".
---

# dt-be-e2e — 시나리오 기반 BE 수용 e2e

> 산출: 시나리오 원장(`docs/specs/resources/<resource>/<resource>.e2e-scenarios.md`, 크로스리소스는 `docs/specs/e2e/be-journeys.md`) + Jest e2e(`test/<resource>.e2e.test.ts`, 여정은 `test/journeys/<journey>.e2e.test.ts`).
> 설계: `docs/superpowers/specs/2026-07-15-dt-be-e2e-design.md` (방법론 어휘는 dt-e2e와 공유)

## 불변 원칙
1. 스펙 기반이 하드 요구 — 모든 시나리오는 `METHOD /path` + IF-n(있으면 REQ 병기) 근거를 명시한다.
2. 사람이 검증한다 — verified 승격은 사람의 원장↔테스트 diff 리뷰 승인 + 그린 로그 확인만(A안). AI는 제안·저작·headless 사전점검까지.
3. 자동 실행 아님 — /dt-be-implement 완료 넛지에 사용자가 승낙해야 시작.

## 스펙 부재 사다리 (불변원칙 1의 예외 경로 — 레거시 진입)
스펙 기반이 하드 요구지만, 스펙이 없거나 얇을 때 3단으로 재결속한다(침묵 진행 금지).
1. **부분 부재** — 최소 앵커 `api-contract.md`만 있으면 진행. 부족분(requirements EARS 등 보조 문서)은 **도그푸딩 발견으로 기록 + 백필 권고**(원장 상단 메모).
2. **전무** — 코드에서 역추출(컨트롤러·DTO·가드 → api-contract 초안: 엔드포인트·상태코드·스키마·인증) → **사용자 확인 게이트**(현행 동작 중 "의도 vs 버그" 판별 — 버그를 계약으로 박제 방지) → 확정된 초안을 앵커로 정상 루프. 역추출 스펙의 basedOnDefinition 마커는 dt-devspec 「마커 규격」 신규격으로 심는다.
3. **역추출도 과한 경우** — 원장 항목의 근거 스펙 칸에 `실측(스펙 부재, <날짜>)` 명시. 부재를 침묵하지 않고 재결속 표지를 남긴다.

## BE e2e의 정의 (시작점·검증축)
BE e2e는 특정 함수 호출이 아니라 **전체 앱을 부팅하고 HTTP 문(門)으로 요청을 쏘는 것**이다(`e2e-full-app` 준수 — 전체 AppModule + 전역 파이프/가드 + Testcontainers 실인프라 + 인증 흐름). Unit(Service 직접 호출)·Integration(모듈 부분 부팅)이 못 잡는 전역 배선(ValidationPipe 등록 누락, 가드 미적용)을 잡는 유일한 계층이다.

**Then 저작 규약 — 검증축 4개:**
1. **상태코드** — 계약대로 201/400/401/403 등이 나오는가.
2. **응답 계약** — body가 api-contract.md 스키마·값대로인가.
3. **DB 부수효과** — 실제 Postgres에 저장/차감/삭제됐는가(Prisma 직접 조회 — 응답만 믿지 않음). 거부 시나리오에선 "부수효과 없음"도 검증.
4. **후속 관찰** — 다음 API 호출에서 그 상태가 관찰되는가.

critical 시나리오는 해피패스 + **부정 경로(401/403/400 — 계약의 절반이 거부 조건)** 를 포함한다. 크로스리소스 여정 예: `register → login → 보호된 엔드포인트 접근`.

테스트명에 시나리오 id를 병기한다(예: `it('AUTH-S3: ...')`) — verified A안의 원장↔테스트 diff 리뷰 추적이 이것으로 성립한다(도그푸딩 실증).

**예시 — 댓글 작성(POST /posts/:id/comments) 4축:**
```ts
it('본인 토큰으로 댓글을 작성한다 (POST /posts/:id/comments)', async () => {
  // 축1 상태코드 + 축2 응답 계약
  const res = await request(app.getHttpServer())
    .post(`/posts/${postId}/comments`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ body: '좋은 글' })
    .expect(201);
  expect(res.body).toMatchObject({ id: expect.any(Number), body: '좋은 글', authorId: userId });

  // 축3 DB 부수효과 — 응답이 아니라 실 Postgres를 Prisma로 직접 조회
  const row = await prisma.comment.findUnique({ where: { id: res.body.id } });
  expect(row).toMatchObject({ body: '좋은 글', postId, authorId: userId });

  // 축4 후속 관찰 — 목록 API에서 관찰되는가
  const list = await request(app.getHttpServer())
    .get(`/posts/${postId}/comments`).expect(200);
  expect(list.body.map((c) => c.id)).toContain(res.body.id);
});
```

## 시나리오 도출 지침
1. **커버리지 단위 = 문서화된 상태코드.** "문서화했으면 테스트하라" — api-contract.md가 명시한 엔드포인트×상태코드(201·400·401·403·404·409 각각)가 매트릭스의 행이다. 목표: 문서화된 엔드포인트 100% 해피패스 + 고우선 부정 경로(인증·권한·검증) 커버(FE의 "고우선 FR 80–90%"에 대응).
2. **입력 검증 부정 표준 세트** — 입력을 받는 엔드포인트마다: 필수 필드 누락→400(필드 수준 에러), 잘못된 타입→400, 경계값(빈 문자열·최대 길이·0·음수), 예상 밖 필드(계약대로 무시 또는 거부). 케이스 선택은 `test-case-design-techniques`(동등분할·경계값·결정표)를 payload에 적용.
3. **권한 매트릭스** — 보호 자원은 최소 3행: 무토큰→401, 타인 토큰→403(+부수효과 없음), 본인→성공.
4. **한 시나리오 = 한 계약.** 한 테스트에 무관한 비즈니스 규칙을 다발로 검증하지 않는다(assert 과광범위 = 실패 시 원인 불명).
5. **관찰 가능한 결과만 assert** — 응답·DB 부수효과·후속 API 관찰(검증축 4개)까지만. private 구현(내부 함수 호출 여부·캐시 내부)은 assert 금지.

**리스크 태깅(BE 기준):** critical = 인증·데이터 변경(생성/수정/삭제)·권한 경계 / important = 조회·목록·필터 계약 / minor = 부가 표시 필드.

## 저작 안티패턴 (금지)
- 실 DB 회피(Repository·Prisma mock) — `integration-no-db-mocking` 위반, e2e 의미 소멸.
- 공유 가변 상태(테스트 간 데이터 의존·순서 의존) — 테스트별 리셋(데이터 수명주기)으로 차단.
- 고정 sleep·타이밍 가정 — readiness await(`testcontainers-lifecycle`)·응답 기반 대기만.
- 응답만 믿기 — 변경 계열(POST/PATCH/DELETE)은 DB 부수효과 확인 필수(검증축 3).

## 시나리오 원장 포맷
- 상단: 상태코드 커버리지 매트릭스 표(엔드포인트×상태코드 ↔ 시나리오 ↔ status).
- 근거 소스: `docs/specs/resources/<resource>/`의 **api-contract.md**(엔드포인트 계약 — 상태코드·스키마·인증, `<!-- from: IF-n -->` 역참조)를 계약 앵커로, requirements.md(EARS)를 보조로. 근거 표기 = `METHOD /path` + `IF-n`(있으면 REQ 병기, 발명 금지).
- 상단 마커: `<!-- basedOnSpec: api-contract.md @ <날짜> (<git short hash>) content:<계약부 해시8> -->` — **기준 파일 = api-contract.md**. 계약 드리프트가 stale 트리거. `content:<해시8>` = `scripts/specContentHash.mjs#specContentHash(api-contract.md)` — **HTML 주석 제거·공백 정규화 후 본문 sha256 앞 8자**(양 e2e 스킬 공용 헬퍼). git hash는 주석-only 변경(basedOnDefinition 역참조 emit 등)에도 바뀌어 오탐을 내므로 **content 해시가 실계약 드리프트의 기준**이고 git hash는 보조 표기다.
- 항목 필드: id, title, priority, 근거 스펙(`METHOD /path`/IF-n/REQ), Given/When/Then, 데이터 훅, status. (dt-e2e와 동일 필드)
- 상태: `proposed → approved → automated → verified | failed`, 추가로 `stale` — verified였더라도 근거 계약이 변경되면 stale로 강등(재승인·재검증 대상).
- **한글 서술 규율**: Given/When/Then·title의 한글 문장은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md` 묶음 B·C를 따른다(기계에 사람 행위 금지·번역투·낯선 말 금지). `METHOD /path`·IF-n·시나리오 id·상태코드는 예외. 원장을 저장하기 **전에** `node "${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs" <원장> --docType spec`을 돌려 findings를 스스로 고치고(남길 항목은 `<!-- ko-lint: keep <id> — 사유 -->`), 0건을 확인한다. 반복 루프 2(제안)·7(반복)에서 원장을 갱신할 때마다 같다.

## 반복 루프
```
1. 수집   api-contract(+requirements) → 엔드포인트 인벤토리 + 리스크 태깅
          (basedOnSpec 마커 비교 — content 해시 우선: 마커 content:<해시8> vs specContentHash(현재 api-contract.md).
           같으면 주석/포맷만 → stale 아님(오탐 제거); content: 없는 구 마커면 git hash 폴백(하위호환).
           다르면 영향 시나리오 stale 강등, 근거 삭제 시나리오는 폐기 확인. 재검증 후 content: 해시 갱신)
2. 제안   GWT 초안을 원장 파일에 proposed로 먼저 기록, 파일 경로 안내(채팅 요약만으로 승인받지 않음)
3. 확인   사용자가 원장을 보고 추가/수정/승인 → approved
4. 저작   Jest+Supertest 테스트 작성(test/<resource>.e2e.test.ts) → automated
5. 사전점검 headless 실행(jest e2e) 그린 확인 (Playwright MCP 해당 없음 — BE는 러너만)
6. 검증   [A안] AI가 원장 시나리오 ↔ 테스트 diff 요약을 제시 →
          사람이 assert가 계약을 제대로 무는지(검증축 4개) 리뷰 승인 + 그린 로그 확인 → verified
7. 반복   failed 수정·재검증, 신규는 proposed append
```
verified의 BE 정의: FE의 "headed로 화면을 본다"에 해당하는 실질은 **"검증이 올바른가를 사람이 본다"** — 저작된 assert의 품질(계약 4축을 제대로 물었는지) 리뷰가 사람 게이트다. AI 사전점검(그린)은 automated 품질보증일 뿐 verified를 대체하지 않는다.

## 데이터 수명주기 (BE 판)
- **격리는 Testcontainers가 구조로 보장** — 런마다 새 컨테이너(FE의 msw/live 스위치 개념 없음, 항상 실인프라). live 게이트 불필요(격리가 기본값).
- **테스트별 리셋**: truncate + 재시드. Jest에서는 **beforeEach 신뢰 가능** — Playwright의 워커 재활용 함정(auto fixture 필요)과 다름을 명시(혼동 방지).
- **시드 SOT(완전 B)**: 풀스택 프로젝트에서 BE e2e 시드 스크립트는 **FE `src/mocks/seed-data.ts` 모듈을 공유 소비**하도록 저작한다(손 복제 금지). FE 없는 BE 단독 프로젝트는 자체 seed 모듈이 SOT.
- 자동 재시도 없음(결정적 실행) — flaky 방지는 `testcontainers-lifecycle` 준수(readiness await, 고정 sleep 금지).

## 관련 스킬
- dt-be-implement(선행, 완료 넛지) · dt-bespec(스펙 출처) · dt-backend-testing(e2e-full-app 규약) · dt-e2e(FE 쌍 — 방법론 공유).

## 비범위
- FE e2e(dt-e2e), CI 자동화, 성능·부하 테스트, 계약 테스트(CDC).
