# dt-e2e — 시나리오 기반 수용(acceptance) e2e 레이어 설계

> 상태: 설계(design) · 작성일 2026-07-13 · 스코프: 프론트엔드(FE) 전용

## 1. 목표

e2e를 "스캐폴드가 자동 생성하는 개발단 테스트"에서 **개발자가 수행하는 독립 역할**로 승격한다. `/dt-implement` 완료 이후, 페이지별 스펙과 크로스페이지 상호작용을 근거로 AI와 사용자가 함께 수용 시나리오를 도출·확정하고, AI가 Playwright e2e를 저작하면 사람이 실제 화면을 보며 검증하고 시나리오를 계속 확장하는 **반복 루프**를 제공한다.

핵심 원칙:
- **스펙 기반이 하드 요구.** 모든 시나리오는 기존 스펙(requirements의 기능 요구(FR)·tasks·interactions.md)에 근거가 있어야 하며, 근거를 명시한다.
- **사람이 검증한다.** AI는 시나리오를 제안하고 코드를 저작하지만, 통과/실패 확정은 사람이 headed 실행으로 한다.
- **레이어 통합.** Playwright e2e는 이 수용 레이어 하나로 통합한다. 스캐폴드의 개발단 e2e 자동 생성은 제거한다. 개발단 렌더·플로우 신뢰는 이미 강제되는 page integration 테스트가 담당한다.

## 2. 비목표 (YAGNI)

- **백엔드(BE) e2e 미포함.** BE e2e(`e2e-full-app`: 전체 AppModule + Testcontainers + 인증)는 기존 별도 레이어로 유지한다. dt-e2e는 브라우저 사용자 여정(FE)만 다룬다. `live` 모드에서 UI가 실 백엔드를 때리더라도 API 계약 전수 검증은 BE e2e 몫이다.
- **스크립트형 상태머신 엔진 미도입.** 시나리오 원장은 마크다운 문서로 가볍게 관리한다(리뷰 엔진 같은 스크립트 상태머신은 후속).
- **`e2e-required` 존재 강제 룰 미도입.** 이번 범위 밖(후속 검토).
- 시각 회귀(스냅샷)·성능 e2e 제외.

## 3. 아키텍처

- **신규 스킬** `dt-e2e` (`plugin/skills/dt-e2e/SKILL.md`) — 대화형 오케스트레이터. 스크립트 없이 문서·AskUserQuestion 기반.
- **신규 커맨드** `dt-e2e` (`plugin/commands/dt-e2e.md`) — `/dt-e2e [<page|scope>]`.
- **입력**: `docs/specs/pages/<page>/{requirements,tasks}.md` + `docs/specs/interactions.md`(있으면).
- **산출물**:
  - 페이지별 시나리오 원장 `docs/specs/pages/<page>/<page>.e2e-scenarios.md` — 파일명에 페이지명을 포함한다(모든 페이지가 같은 파일명이면 IDE 탭·검색에서 구분 불가 — sample-web 도그푸딩 피드백)
  - 크로스페이지 여정 원장 `docs/specs/e2e/journeys.md`
  - Playwright spec: `e2e/<page>.spec.ts`, `e2e/journeys/<journey>.spec.ts`
- **연동**: `dt-implement` 완료 보고에서 "이어서 `/dt-e2e` 진행할까요?" 넛지(자동 실행 아님, 사용자 승낙 시 시작).
- **선택 의존**: Playwright MCP(`@playwright/mcp`) — 있으면 저작·사전검증을 강화하고, 없으면 스펙 기반 저작으로 우아하게 강등(§8.1).

## 4. 시나리오 설계 방법론 (리서치 반영)

리서치 근거는 §9 참조. e2e는 "많이"가 아니라 "옳게" 만든다 — lean but comprehensive.

1. **기능 인벤토리 추출.** 페이지 스펙의 FR + interactions.md의 여정을 긁어 "서비스가 제공하는 기능 목록"을 만든다.
2. **리스크 우선순위 태깅.** 각 기능을 다음으로 분류한다.
   - `critical` — 인증, 핵심 액션, 데이터 변경(생성·수정·삭제), 수익/이탈 직결 경로
   - `important` — 주요 조회·탐색 흐름
   - `minor` — 사소한 표시·토글
3. **시나리오 도출(Given-When-Then).** 기능 → GWT 시나리오. **한 시나리오 = 한 행위.** critical은 해피패스 + 핵심 엣지(에러·권한·경계), important는 해피패스 + 대표 엣지, minor는 해피패스만. 케이스 선택은 기존 `test-case-design-techniques`(동등분할·경계값·상태전이)를 활용한다.
4. **커버리지 매트릭스.** 원장 상단에 [기능/FR ↔ 시나리오 ↔ 상태] 표를 둔다. **목표는 100%가 아니라 고우선(critical·important) 기능 80–90%.** 매트릭스가 "무엇이 아직 안 덮였나"를 가시화한다.

대부분의 시나리오는 **페이지별**이다(그 페이지 FR 기준). **크로스페이지 여정은 소수**로, 페이지 경계를 넘는 흐름(예: 로그인 → 피드 → 상세)만 interactions.md 기반으로 뽑는다.

## 5. 시나리오 원장 (데이터 모델)

페이지별·여정 원장 모두 동일 포맷을 쓴다.

**상단 — basedOnSpec 마커:** 원장 생성·갱신 시 근거 스펙 스냅샷을 기록한다 — `<!-- basedOnSpec: requirements.md @ <날짜> (<git short hash>) -->`. 스펙↔원장 드리프트 추적의 기준점.

**상단 — 커버리지 매트릭스:**

| 기능/FR | 우선순위 | 시나리오 | 상태 |
|---|---|---|---|
| FR-3 좋아요 토글 | critical | SC-2 | verified |
| FR-5 댓글 작성 | critical | SC-3 | automated |
| FR-8 공유 | minor | (미커버) | — |

**본문 — 시나리오 항목(각 항목의 필드):**
- `id` (예: SC-2)
- `title`
- `priority`: critical | important | minor
- `근거 스펙`: FR-n / IF-n / interaction (하드 요구 — 비우지 않는다)
- `Given` / `When` / `Then`
- `status`: 아래 생명주기

**상태 생명주기:**
```
proposed  → AI가 스펙에서 제안
approved  → 사용자가 확인/수정 승인
automated → Playwright spec 작성됨
verified  → 사람이 headed 실행으로 통과 확정
failed    → headed 검증 실패 (코드 또는 시나리오 수정 필요)
stale     → verified였더라도 근거 스펙이 변경되면 강등 (재승인·재검증 대상)
```

## 6. 반복 루프

```
1. 수집   스펙 + interactions.md 읽기 → 기능 인벤토리 + 리스크 태깅
2. 제안   GWT 시나리오 초안 제시                     (proposed)
3. 확인   AskUserQuestion으로 추가/수정/승인          (→ approved)
4. 저작   승인분을 Playwright spec으로 작성           (→ automated)
          (MCP 있으면 실앱 접근성 트리에서 정확한 로케이터 확보)
5. 검증   (MCP 있으면) AI가 먼저 MCP로 사전 자가점검 →
          사람이 headed 실행으로 최종 통과/실패 확정      (→ verified / failed)
6. 반복   failed는 수정 후 재검증, 새 시나리오는 proposed로 append
```

- 매 사이클 원장·매트릭스를 갱신한다.
- 미완(proposed/automated/failed) 시나리오부터 이어간다.
- **수집 단계에서 basedOnSpec 마커와 현재 requirements.md를 비교** — 다르면 영향 시나리오를 `stale`로 강등해 루프에 재투입하고, 근거 FR이 삭제됐으면 폐기 여부를 사용자에게 확인한다.
- 세션 재개 시 원장의 상태가 진행 지점이다.

## 7. 실행 대상 스위치 (MSW 기본 + 실연동)

Playwright **project 2개**로 스위치한다.
- `--project=msw` (기본) — MSW로 격리, 결정적. sample-web의 `VITE_USE_MOCKS=true` + `reuseExistingServer:false` 패턴 계승.
- `--project=live` — 실 백엔드 연동. 환경·시드 준비는 사용자 책임.

스크립트: `test:accept`(= `playwright test --project=msw`), headed 검증은 `test:accept --headed`. 신규 프로젝트는 스캐폴드 new-project에서 accept 설정을 함께 배선한다.

> **구현 주석:** 실제 배선은 env-scoped 스크립트 방식으로 구현한다 — `test:accept`(기본, MSW 모드)와 `test:accept:live`(`E2E_LIVE=1`로 `VITE_USE_MOCKS=false` 주입)를 단일 chromium project로 운영해 MSW/live 동작을 env 스위치로 전환한다. Playwright project 2개 대신 단일 project + env 분기이며, 동일한 MSW/live 스위치 동작을 실현한다.

### 7.1 데이터 수명주기 (상태 준비·청소 규약)

시나리오가 중간에 실패하면 백엔드 DB에 잔여(쓰레기) 데이터가 쌓이고, 특정 UI 상황을 만들기 위해 매번 UI를 반복 조작하게 되는 문제를 규약으로 막는다. 근거: Playwright fixture teardown은 테스트가 실패·타임아웃돼도 실행된다(공식 문서), 테스트 데이터는 고유 식별자로 격리하고 API로 준비한다(업계 표준).

**공통 원칙 — Arrange는 API·시드로, Act/Assert만 UI로.**
- 전제 상태(예: "댓글 5개 있는 상태")를 UI 반복 조작으로 만들지 않는다. 시드(MSW) 또는 API 호출(live)로 만들고, UI는 검증 대상 행위 1개만 수행한다.
- 진입은 딥링크(`goto('/feed/1')`)로. 홈에서 클릭해 들어가는 네비게이션 자체가 검증 대상일 때만 UI 경유.
- 인증이 있으면 storageState를 setup 1회로 만들어 재사용한다(매 테스트 로그인 UI 금지).

**MSW 모드(기본) — 격리는 구조로 보장.**
- 각 테스트 = 새 브라우저 컨텍스트 = 새 mock 저장소(sample-web의 IndexedDB 시드 패턴). 테스트 간 오염이 구조적으로 없다.
- 전제 상태가 필요하면 **시드를 확장**한다(시나리오 전제 데이터를 시드에 포함). UI로 만들지 않는다.
- MSW 핸들러는 mutation을 지원해야 흐름 검증이 된다(조회 stub만으로는 좋아요/댓글 흐름 검증 불가).

**live 모드 — 3겹 방어.**
1. **자기 데이터 자기 청소(1차):** 시나리오가 만든 데이터는 해당 fixture의 teardown(`await use()` 이후)이 지운다. teardown은 실패·타임아웃에도 실행되므로 멱등(idempotent)하게 작성한다.
2. **run-id 네임스페이스(2차):** 생성 데이터에 실행별 고유 접두사(예: `e2e-<runId>-`)를 태깅한다. teardown이 누락돼도 잔여물을 식별해 일괄 청소할 수 있고, 병렬 실행 충돌도 방지한다.
3. **live 게이트(기반 전제):** live 실행 전 사용자에게 1회 확인한다 — 대상이 (a) 격리 DB(전용 e2e 환경·Testcontainers·ephemeral) 또는 (b) 테스트 전용 리셋 훅(E2E 환경에서만 노출)을 갖췄는가. **프로덕션·공유 DB에 live e2e를 돌리지 않는다(하드 룰).** 확인 없이는 live로 진행하지 않는다.

**원장 연동:** 시나리오 원장 항목에 `데이터 훅` 필드를 추가한다 — 그 시나리오의 상태 준비·청소 방식(msw: 시드 확장 여부 / live: arrange API + teardown 대상)을 명시한다. 저작 단계에서 이 필드가 비어 있으면 채우고 나서 spec을 쓴다.

## 8. Playwright 저작 규약 (기존 e2e-playwright 확장·강화)

리서치 기반 규약을 규칙으로 승격한다.
- **역할 기반 로케이터** `getByRole`/`getByLabel` 우선 — 마크업 리팩터에 강하고 사용자 관점.
- **테스트 격리** — 독립 컨텍스트, 시나리오 간 상태 오염 금지.
- **auto-wait** — `expect(locator).toBeVisible()` 사용, `page.waitForTimeout` 금지.
- **네트워크 stub** — API origin 명시(`https://api.example.com/...`), 와일드카드(`**/...`) 금지(SPA HTML 가로채기 방지).
- **사용자 가시 행위 검증** — CSS 클래스·구현 디테일 아닌 화면에 보이는 결과 검증.

앞서 지적한 리뷰 갭(규약이 문서에만 존재)을 해소하기 위해, `e2e-playwright` 패턴에 **forbidden-pattern 자동 검출**을 추가한다.
- `page\.waitForTimeout` 사용 검출 (중요)
- `page\.route\(['"]\*\*` 와일드카드 route 검출 (중요)

### 8.1 Playwright MCP 활용 (opt-in + 폴백)

Playwright MCP(`@playwright/mcp`)가 연결돼 있으면 두 지점에서 활용한다. 없으면 스펙 기반 저작으로 강등하며, 나머지 흐름은 동일하다(플러그인 관례: Atlassian/Figma MCP 게이팅과 동일한 opt-in 방식).

1. **저작 정확도(4단계).** AI가 스펙만으로 로케이터를 추측하는 대신, 실행 중인 앱을 MCP로 구동해 **접근성 트리 스냅샷에서 실제 역할 기반 로케이터·스텝을 확보**해 Playwright spec을 저작한다. 셀렉터 환각(hallucination)을 제거한다.
2. **AI 사전 자가점검(5단계).** 사람에게 넘기기 **전에** AI가 MCP로 시나리오를 한 번 실행해 명백히 깨진 spec을 걸러낸다(사전점검 결과를 원장에 메모). **이는 사람의 최종 수용을 대체하지 않는다** — 상태를 `verified`로 올리는 것은 사람의 headed 검증뿐이다. AI 사전점검은 `automated` 단계의 품질 보증일 뿐이다.

전제: 앱이 떠 있어야 한다(msw 모드면 mock으로 기동). MCP는 기본 `msw` project 기준으로 구동한다.

## 9. 리서치 근거

- 리스크 기반 우선순위·고우선 80–90% 목표: Bunnyshell(2026 E2E best practices), Home Office test-pyramid.
- 유저 여정 매핑·크리티컬 패스 우선: Maestro 2025 guide, bugbug E2E coverage.
- 해피패스 외 에러·엣지 선별 포함: DeviQA E2E cases.
- Given-When-Then·한 시나리오=한 행위·협업 검토(Three Amigos): Thoughtworks BDD, SAFe BDD.
- Playwright 규약(role 로케이터·격리·auto-wait·사용자 가시 행위): playwright.dev/best-practices.
- "많이가 아니라 옳게"(lean but comprehensive): TestRail testing pyramid.

## 10. 플러그인 변경점

| 대상 | 변경 |
|---|---|
| `plugin/skills/dt-e2e/` (신규) | SKILL.md — 오케스트레이터(방법론 §4, 원장 §5, 루프 §6, 스위치 §7) |
| `plugin/commands/dt-e2e.md` (신규) | `/dt-e2e [<page\|scope>]` 커맨드 |
| `dt-frontend-scaffold` | Phase 5 "Page + Router + E2E" → **"Page + Router"** (e2e 자동생성 제거). new-project에 accept(Playwright project msw/live) 배선 |
| `dt-frontend-testing` | e2e 계층을 "수용 e2e(사람 주도)"로 재정의. `e2e-playwright`에 forbidden-pattern 자동검출 추가 |
| `dt-frontend-review` | 위 forbidden-pattern 반영 → `regen-atlas.mjs` 재생성 |
| `dt-implement` | 완료 보고에 "이어서 `/dt-e2e` 진행할까요?" 넛지(자동 실행 아님) |
| Confluence 문서 | 관련 스킬 문서 갱신(후속 dt-wrap/문서 최신화) |

## 11. 성공 기준

- `/dt-e2e`가 스펙에서 기능 인벤토리를 뽑아 리스크 태깅된 GWT 시나리오를 제안한다.
- 시나리오 원장(페이지별 + 여정)이 근거 스펙·상태·커버리지 매트릭스와 함께 생성·갱신된다.
- 승인된 시나리오가 규약(역할 로케이터·origin 명시·no waitForTimeout)을 지키는 Playwright spec으로 저작된다.
- `--project=msw`/`--project=live` 스위치가 동작한다.
- 사람이 headed로 검증해 상태가 verified/failed로 갱신되고, 실패·신규는 루프로 이어진다.
- 스캐폴드 Phase 5에서 e2e 자동생성이 제거되고, `e2e-playwright` forbidden-pattern이 리뷰에서 자동 검출된다.
- Playwright MCP가 있으면 실앱 접근성 트리에서 로케이터를 확보해 저작하고 사람 검증 전 사전 자가점검을 수행한다. 없으면 스펙 기반 저작으로 강등하되 나머지 흐름은 동일하다.
