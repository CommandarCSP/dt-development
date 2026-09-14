// EXAMPLE: E2E Playwright. See dt-frontend-testing/patterns/e2e-playwright.md
import { test, expect } from '@playwright/test';

const API = 'https://jsonplaceholder.typicode.com';

test('게시판 진입 시 글 목록이 보인다', async ({ page }) => {
  await page.route(`${API}/posts*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ userId: 1, id: 1, title: '첫 글', body: '' }]),
    });
  });

  await page.goto('/posts');
  await expect(page.getByText('첫 글')).toBeVisible();
});
