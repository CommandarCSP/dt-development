# 외부 자산 인용

이 스킬은 다음 외부 자산의 원칙을 차용합니다.

## superpowers
- `superpowers:test-driven-development` — Red-Green-Refactor 흐름. scaffold 에이전트들이 테스트 먼저 작성하는 패턴.

## Testing Library
- https://testing-library.com/docs/guiding-principles — "behavior 테스트, implementation detail 회피". `view-test-props-only`, `integration-no-hook-mocking`의 근거.

## MSW (Mock Service Worker)
- https://mswjs.io/docs — Node 환경 server lifecycle, browser worker, handler 작성. `msw-handler-design`의 근거.

## Playwright
- https://playwright.dev/docs/best-practices — page.route, fixtures, parallel execution. `e2e-playwright`의 근거.

## Kent C. Dodds
- "Don't mock what you don't own" — integration 테스트가 hook을 mock하지 않는 원칙의 출처.
