---
ruleId: e2e-playwright
summary: "수용(acceptance) 사용자 시나리오, 외부는 MSW/origin 명시 route로 격리, page.waitForTimeout·와일드카드 route 금지"
severity: important
appliesTo: ["e2e/**/*.spec.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "E2E spec은 페이지 진입 → 핵심 사용자 인터랙션 → 결과 검증 흐름을 포함. 네트워크는 page.route 또는 e2e/fixtures/msw로 stub."
  - type: forbidden-pattern
    pattern: "page\.waitForTimeout"
    rationale: "고정 대기는 flaky. auto-wait(expect toBeVisible) 또는 page.waitForResponse 사용."
  - type: forbidden-pattern
    pattern: "page\.route\([\x22\x27\x60]\*\*"
    rationale: "와일드카드 route는 SPA 진입 HTML까지 가로챔. API origin을 명시적으로 매칭."
relatedRules: []
---

# Playwright E2E 패턴

```ts
import { test, expect } from '@playwright/test';

const API = 'https://jsonplaceholder.typicode.com';

test('게시판 진입 후 글 클릭 → 상세', async ({ page }) => {
  await page.route(`${API}/posts/1`, async (route) => {
    await route.fulfill({ json: { id: 1, userId: 1, title: '글', body: '내용' } });
  });
  await page.route(`${API}/posts*`, async (route) => {
    await route.fulfill({ json: [{ id: 1, userId: 1, title: '글', body: '' }] });
  });

  await page.goto('/posts');
  await expect(page.getByText('글')).toBeVisible();

  await page.getByText('글').click();
  await expect(page).toHaveURL(/\/posts\/1/);
  await expect(page.getByText('내용')).toBeVisible();
});
```

> **중요**: `page.route` 패턴은 SPA 진입 URL(예: `localhost:5173/posts`)까지 가로챌 수 있습니다. 와일드카드(`**/posts*`)는 피하고 API origin을 명시적으로 매칭하세요 (`https://api.example.com/posts*`). 와일드카드를 쓰면 페이지 자체가 JSON 응답으로 대체돼 React가 렌더되지 않습니다.

## 관련 규칙
- 이 룰은 수용 e2e 레이어(`dt-e2e` 스킬)가 저작하는 spec에 적용된다. 개발단 e2e 자동생성은 없다.
