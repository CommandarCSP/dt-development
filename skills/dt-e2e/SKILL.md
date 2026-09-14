---
name: dt-e2e
description: Use after /dt-implement to author and verify scenario-based acceptance e2e (Playwright) for implemented pages. Derives risk-tagged Given-When-Then scenarios strictly from page specs (requirements FR/tasks) and interactions.md, authors Playwright specs, and a human verifies results headed. Scenarios tracked in a status ledger. Triggers on "/dt-e2e", "수용 테스트", "e2e 시나리오". Optional Playwright MCP for authoring accuracy and AI pre-flight.
---

# dt-e2e — 시나리오 기반 수용 e2e

> 산출: 시나리오 원장(`docs/specs/pages/<page>/<page>.e2e-scenarios.md` — 파일명에 페이지명 포함(IDE 탭·검색 구분), 크로스페이지는 `docs/specs/e2e/journeys.md`) + Playwright spec(`e2e/<page>.spec.ts`, `e2e/journeys/<journey>.spec.ts`).
> 설계: `docs/superpowers/specs/2026-07-13-dt-e2e-acceptance-design.md`

## 불변 원칙
1. 스펙 기반이 하드 요구 — 모든 시나리오는 FR-n/IF-n/interaction 근거를 명시한다.
2. 사람이 검증한다 — verified 승격은 사람의 headed 검증만. AI는 제안·저작·사전점검까지.
3. 자동 실행 아님 — /dt-implement 완료 넛지에 사용자가 승낙해야 시작.

## 입력
- `docs/specs/pages/<page>/{requirements,tasks}.md` + `docs/specs/interactions.md`(있으면).

## 스펙 부재 사다리 (불변원칙 1의 예외 경로 — 레거시 진입)
스펙 기반이 하드 요구지만, 스펙이 없거나 얇을 때 3단으로 재결속한다(침묵 진행 금지).
1. **부분 부재** — 최소 앵커 `requirements.md`만 있으면 진행. 부족분(tasks·interactions 등 보조 문서)은 **도그푸딩 발견으로 기록 + 백필 권고**(원장 상단 메모).
2. **전무** — 코드에서 역추출(라우팅·화면·컴포넌트 → requirements 초안) → **사용자 확인 게이트**(현행 동작 중 "의도 vs 버그" 판별 — 버그를 스펙으로 박제 방지) → 확정된 초안을 앵커로 정상 루프. 역추출 스펙의 basedOnDefinition 마커는 dt-devspec 「마커 규격」 신규격으로 심는다.
3. **역추출도 과한 경우** — 원장 항목의 근거 스펙 칸에 `실측(스펙 부재, <날짜>)` 명시. 부재를 침묵하지 않고 재결속 표지를 남긴다.

## 시나리오 설계 방법론
1. 기능 인벤토리 추출(FR + 여정).
2. 리스크 태깅(critical/important/minor — 기준은 설계 §4).
3. Given-When-Then 시나리오(한 시나리오=한 행위). critical=해피패스+핵심 엣지, important=해피패스+대표 엣지, minor=해피패스. 케이스 선택은 dt-frontend-testing의 test-case-design-techniques 활용.
4. 커버리지 매트릭스(기능/FR↔시나리오↔상태). 목표는 고우선 80–90%.

## 시나리오 원장 포맷
- 상단: 커버리지 매트릭스 표.
- 상단 마커: 원장 생성·갱신 시 근거 스펙 스냅샷을 자동 기록 — `<!-- basedOnSpec: requirements.md @ <날짜> (<git short hash>) content:<계약부 해시8> -->`. 스펙 드리프트 추적의 기준점. `content:<해시8>` = `scripts/specContentHash.mjs#specContentHash(requirements.md)` — **HTML 주석 제거·공백 정규화 후 본문 sha256 앞 8자**(양 e2e 스킬 공용 헬퍼). git hash는 주석-only 변경(역참조 emit 등)에도 바뀌어 오탐을 내므로 **content 해시가 실드리프트의 기준**이고 git hash는 보조 표기다.
- 항목 필드: id, title, priority, 근거 스펙(FR-n/IF-n/interaction), Given/When/Then, 데이터 훅, status.
- 데이터 훅: 상태 준비·청소 방식 — msw면 시드 확장 여부, live면 arrange API + teardown 대상. 저작 전 비어 있으면 채운다.
- 상태: proposed → approved → automated → verified | failed. 추가로 `stale` — verified였더라도 근거 스펙이 변경되면 stale로 강등(재승인·재검증 대상).
- **한글 서술 규율**: Given/When/Then·title의 한글 문장은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md` 묶음 B·C를 따른다(기계에 사람 행위 금지·번역투·낯선 말 금지). FR-n·IF-n·시나리오 id·셀렉터는 예외. 원장을 저장하기 **전에** `node "${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs" <원장> --docType spec`을 돌려 findings를 스스로 고치고(남길 항목은 `<!-- ko-lint: keep <id> — 사유 -->`), 0건을 확인한다. 반복 루프에서 원장을 갱신할 때마다 같다.

## 반복 루프
1. 수집(스펙+interactions → 인벤토리+태깅). 원장의 basedOnSpec 마커와 현재 requirements.md를 비교해 stale 판정 — **content 해시 우선**: 마커에 `content:<해시8>`가 있으면 `specContentHash(현재 requirements.md)`와 비교(같으면 주석/포맷만 바뀐 것 → **stale 아님**, 오탐 제거). `content:`가 없는 구 마커면 **git hash 폴백**(하위호환). 해시가 다르면 FR diff를 읽어 영향 시나리오를 stale로 표시하고 루프(제안→승인→저작→검증)에 재투입. 근거 FR이 삭제된 시나리오는 폐기 여부를 사용자에게 확인. **stale 해소·재검증 후 마커의 `content:` 해시(+날짜·git hash)를 현재 값으로 갱신**.
2. 제안(GWT 초안을 **원장 파일에 proposed로 먼저 기록**하고 파일 경로를 안내 — 채팅 요약만으로 승인받지 않는다)
3. 확인(사용자가 원장 파일을 보고 추가/수정/승인 → approved)
4. 저작(Playwright spec → automated). MCP 있으면 실앱 접근성 트리에서 정확한 로케이터 확보.
5. 검증(AI 사전점검(MCP 실행 **또는 headless 러너** — 실무는 headless `test:accept`가 주력) → 사람 headed 최종 확정 → verified/failed)
6. 반복(failed 수정·재검증, 신규는 proposed append)

## 실행 대상 스위치
- 기본 MSW 격리(`pnpm test:accept`), 실연동은 `pnpm test:accept:live`(E2E_LIVE=1). headed는 `--headed`.

## 데이터 수명주기 (상태 준비·청소 — 설계 §7.1)
**공통: Arrange는 API·시드로, Act/Assert만 UI로.**
- 전제 상태를 UI 반복 조작으로 만들지 않는다. 진입은 딥링크(`goto('/feed/1')`). 인증은 storageState 1회 재사용.

**MSW 모드(기본):** 각 테스트 = 새 컨텍스트 = 새 mock 저장소라 격리는 구조로 보장된다. 전제 상태가 필요하면 **시드를 확장**한다(UI로 만들지 않음). MSW 핸들러는 mutation을 지원해야 흐름 검증이 된다.
- 상태 오버라이드(에러·빈 응답 유발)는 `page.route`가 아니라 앱의 DEV 전용 훅(예: `window.__msw` + `window.__queryClient`)으로 — MSW 서비스워커가 페이지 안에서 응답해 route 인터셉트가 조용히 안 먹는다(실측). 오버라이드 후 리로드 금지(워커 재시작으로 런타임 핸들러 초기화) — 쿼리 재조회로 반영.

**live 모드(3겹 방어):**
1. 자기 데이터 자기 청소 — fixture teardown(`await use()` 이후; 실패·타임아웃에도 실행)이 시나리오 생성 데이터를 지운다. 멱등하게 작성.
2. run-id 네임스페이스 — 생성 데이터에 `e2e-<runId>-` 접두사 태깅 → 잔여물 식별·일괄 청소, 병렬 충돌 방지.
3. **live 게이트** — 실행 전 사용자에게 1회 확인: 대상이 격리 DB(전용 e2e 환경·Testcontainers) 또는 테스트 전용 리셋 훅을 갖췄는가. **프로덕션·공유 DB 금지(하드 룰).** 확인 없이 live 진행 안 함.

**live 준비·리셋 배선(실측):**
- 실행 전 준비(DB 리셋·인증 토큰)는 globalSetup이 아니라 **webServer 사전 스크립트**로 — Playwright는 webServer를 globalSetup보다 먼저 시작한다(실측).
- 테스트별 DB 리셋은 beforeEach가 아니라 **auto fixture**로 — 테스트 실패 시 워커 재활용 경계에서 beforeEach가 누락된다(실측).
- MSW 훅 의존 시나리오는 live에서 `msw-only` skip — live엔 워커가 뜨지 않는다.

**시드 SOT:** live를 도입하는 프로젝트는 BE 시드가 MSW 시드 데이터 원본을 공유 소비한다(손 복제 금지 — 복제는 msw 그린/live 빨강 드리프트를 만든다). 시드 데이터가 핸들러에 인라인돼 있으면 먼저 모듈로 분리.

## Playwright 저작 규약
- 역할 기반 로케이터(getByRole/getByLabel), 테스트 격리, auto-wait(waitForTimeout 금지), API origin 명시(와일드카드 route 금지), 사용자 가시 행위 검증. (dt-frontend-testing `e2e-playwright` 룰이 자동 검출)
- 에러 상태 검증은 시맨틱(role=alert 등) 우선 — 문구 assert는 스펙에 `[전용 문구]`가 명시된 경우만.
- 테스트명에 시나리오 id를 병기한다(예: `test('SC-4: ...')`) — 원장↔spec 추적용.

## Playwright MCP (opt-in + 폴백)
- 루프 시작 전 연결을 확인한다. 미연결이면 `claude mcp add playwright -- npx @playwright/mcp@latest` 후 `/mcp` 확인을 안내하고(권장 — 저작 정확도·사전점검 향상), 거절 시 아래 폴백으로 진행한다.
- 있으면: 저작 정확도(실앱 접근성 트리에서 로케이터) + 사람 검증 전 AI 사전 자가점검.
- 없으면: 스펙 기반 저작으로 강등. 나머지 흐름 동일. verified는 언제나 사람만.

## 관련 스킬
- dt-implement(선행, 완료 넛지) · dt-spec(스펙 출처) · dt-frontend-testing(e2e-playwright 규약).

## 비범위
- BE e2e(e2e-full-app), e2e 존재 강제 룰, 시각 회귀·성능 e2e.
