---
name: dt-frontend-testing
description: Use when writing or reviewing tests in a project that contains .dt-frontend.json — describes the 3-tier test strategy (Unit / Integration / E2E), tool choices (Vitest + RTL + MSW + Playwright), per-layer test patterns, and rules consumed by dt-frontend-review.
---

# dt-frontend Testing Strategy

> **다른 스킬과의 관계**
> - 일반 코드 룰(레이어/스타일링/services/business)은 `dt-frontend-architecture`에 정리됨. 테스트 코드도 그 룰 적용 받음 — 함께 invoke 권장.
> - 작성 후 검증: `/dt-review` 또는 `dt-frontend-review` skill.
>
> 본 skill은 **테스트 전략 + 테스트 전용 룰**의 단일 atlas를 제공한다.

## 3계층 테스트

| 종류 | 대상 | 도구 | 위치 | **파일 suffix** | 비중 |
|---|---|---|---|---|---|
| Unit | 단일 hook/함수/컴포넌트 검증 | Vitest + RTL + MSW | 각 레이어 `__tests__/` | `*.unit.test.ts(x)` | 60-70% |
| Integration | 2개 이상의 hook/레이어 합성 검증 | Vitest + RTL + MSW | `components/domain/__tests__/`, `pages/__tests__/`, 그 외 합성 위치 | `*.integration.test.ts(x)` | 20-30% |
| E2E | 수용(acceptance) 사용자 시나리오 | Playwright | `e2e/` | `*.spec.ts` | 5-10% |

- 비중은 가이드라인. 비즈니스 리스크 높은 도메인은 통합/E2E 비중↑ OK.
- **파일 suffix로 종류 명시**: 파일명만 보고 unit/integration 구분 가능.
- CI/dev script 분리 실행: `pnpm test:unit` / `pnpm test:integration` / `pnpm test:e2e`.
- 판정 기준: **단일 SUT**(hook 하나, 함수 하나, view 하나) = unit. **2개 이상 협력**(query+mutation, hook+router, multi-query 합성 등) = integration. 헷갈리면 integration 쪽으로.
- E2E(수용): `/dt-implement` 이후 `dt-e2e` 스킬로 사람이 주도해 작성·검증하는 수용 레이어다. 스캐폴드가 개발단 e2e를 자동생성하지 않는다. 개발단 렌더·플로우 신뢰는 page integration 테스트(`page-integration-required`)가 담당한다.

## 레이어별 테스트 매핑

```
Utils         → Unit (순수 함수)
Store Query   → Unit (MSW)
UI Store      → Unit (상태 전이)
Business Hook → Unit (MSW + queryWrapper, 변환 로직)
View          → Unit (props 렌더링)
Domain        → Integration (실제 hook + MSW)
Page          → Integration (memoryRouter + MSW) + E2E (Playwright)
```

## 핵심 원칙

1. **Integration 테스트는 hook을 mock하지 마라** — 그 자체로 통합 검증이 무의미해짐
2. **View 테스트는 props만** — store/router import 금지
3. **MSW handler는 한 곳에** — `src/mocks/handlers.ts`
4. **queryKey 파라미터 분리 검증** — Store Query 테스트는 같은 hook에 다른 파라미터로 호출해 캐시 분리 확인
5. **TDD 권장** — `superpowers:test-driven-development` 참조
6. **AAA 구조 + 명확한 네이밍** — Arrange / Act / Assert. 한 테스트 = 한 동작. `should_X_when_Y` 또는 `<조건>일 때 <결과>`
7. **테스트 케이스 도출 기법** — 경계값/동등분할/결정테이블/상태전이/페어와이즈
8. **Test Double 의식적 선택** — Stub/Spy/Mock/Fake 차이 알고 쓰기
9. **Flaky 방지** — setTimeout/raw sleep 금지, waitFor + 적절한 timeout

## Coverage

비즈니스 코드 80%+ (View 제외). critical(business/store) 85% 권장. 자세히는 atlas의 `coverage-rules`.

## Atlas — 테스트 전용 룰

<!-- ATLAS:START — `node plugin/scripts/regen-atlas.mjs`로 자동 생성. 직접 수정하지 마세요. -->

### Testing
- **coverage-rules** _(critical)_ — 비즈니스 코드 80%+ (View 제외), critical 영역(business/store) 85% 권장, 어서션 품질 우선 [상세](patterns/coverage-rules.md)
- **integration-no-hook-mocking** _(critical)_ — 통합 테스트에서 hook을 mock하면 통합 의미 소실 — 절대 금지 [상세](patterns/integration-no-hook-mocking.md)
- **view-test-props-only** _(critical)_ — View 테스트는 props만 — store/router import 금지 (테스트 무의미해짐) [상세](patterns/view-test-props-only.md)
- **e2e-playwright** _(important)_ — 수용(acceptance) 사용자 시나리오, 외부는 MSW/origin 명시 route로 격리, page.waitForTimeout·와일드카드 route 금지 [상세](patterns/e2e-playwright.md)
- **flaky-test-prevention** _(important)_ — waitFor + 적절한 timeout, setTimeout/raw sleep 금지, cross-tree subscription 누락은 hook들을 한 트리에서 묶어 호출 [상세](patterns/flaky-test-prevention.md)
- **integration-domain** _(important)_ — Domain 컴포넌트 통합 테스트, 실제 hook + MSW, hook mock 금지 [상세](patterns/integration-domain.md)
- **integration-page** _(important)_ — Page 통합 테스트는 MemoryRouter + MSW, 실 사용자 진입 시나리오 검증 [상세](patterns/integration-page.md)
- **msw-handler-design** _(important)_ — MSW handler는 src/mocks/handlers.ts 단일 위치, 테스트별 server.use로 override [상세](patterns/msw-handler-design.md)
- **page-integration-required** _(important)_ — Page 컴포넌트마다 sibling integration test 필수 — 페이지 핵심 흐름은 cross-component까지 검증 [상세](patterns/page-integration-required.md)
- **test-anti-patterns** _(important)_ — hook mock / setTimeout / 구현 디테일 결합 / snapshot 남용 / 순서 의존 금지 [상세](patterns/test-anti-patterns.md)
- **unit-business-hook** _(important)_ — Business Hook 단위 테스트, MSW + queryWrapper, DTO→Model 변환과 상태 검증 [상세](patterns/unit-business-hook.md)
- **unit-store-query** _(important)_ — Store Query 단위 테스트, MSW로 응답 stub, queryKey 파라미터별 캐시 분리 확인 [상세](patterns/unit-store-query.md)
- **unit-view-component** _(important)_ — View 단위 테스트, props만으로 렌더링/콜백 검증, router/store wrapper 금지 [상세](patterns/unit-view-component.md)
- **e2e-scenarios-required** _(minor)_ — 스펙(requirements.md)은 있는데 수용 e2e 원장(*.e2e-scenarios.md)이 없는 페이지를 존재 안전망으로 경고(머지 차단 아님) [상세](patterns/e2e-scenarios-required.md)
- **test-case-design-techniques** _(minor)_ — 동등분할/경계값/결정테이블/상태전이/페어와이즈로 케이스 도출, 직관 의존 X [상세](patterns/test-case-design-techniques.md)
- **test-double-selection** _(minor)_ — MSW=Stub/Fake, vi.fn=Spy, fake-indexeddb=Fake — 더블 종류 의식하고 선택 [상세](patterns/test-double-selection.md)
- **test-writing-structure** _(minor)_ — AAA(Arrange/Act/Assert), 명확한 네이밍, 한 테스트=한 동작, fixture는 Builder로 [상세](patterns/test-writing-structure.md)
- **unit-ui-store** _(minor)_ — Zustand UI Store 단위 테스트, 초기값/setter/reset 상태 전이 검증 [상세](patterns/unit-ui-store.md)

<!-- ATLAS:END -->

## 활성화 조건

`.dt-frontend.json`이 있고 `enabledSkills`에 포함된 프로젝트에서만 트리거됩니다.

## 외부 참조

- `superpowers:test-driven-development`
- Testing Library: https://testing-library.com/docs/guiding-principles
- MSW: https://mswjs.io/docs
- Playwright: https://playwright.dev/docs/best-practices
