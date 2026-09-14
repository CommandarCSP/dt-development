import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllRules } from '../scripts/lib/rule-loader.mjs';
import { detectForbiddenPattern } from '../scripts/lib/detection/forbidden-pattern.mjs';

const PLUGIN_ROOT = new URL('../../..', import.meta.url).pathname;

async function e2eForbiddenPatterns() {
  const rules = await loadAllRules(PLUGIN_ROOT);
  const rule = rules.find((r) => r.ruleId === 'e2e-playwright');
  assert.ok(rule, 'e2e-playwright rule should be discovered');
  return rule.detection.filter((d) => d.type === 'forbidden-pattern');
}

test('e2e-playwright declares 2 forbidden-pattern detections', async () => {
  const fps = await e2eForbiddenPatterns();
  assert.equal(fps.length, 2, `expected 2 forbidden-pattern detections, got ${fps.length}`);
});

test('e2e-playwright flags waitForTimeout and wildcard route in a bad spec', async () => {
  const fps = await e2eForbiddenPatterns();
  const badSpec = [
    "import { test, expect } from '@playwright/test';",
    "test('x', async ({ page }) => {",
    "  await page.route('**/posts*', (r) => r.fulfill({ json: [] }));",
    "  await page.goto('/posts');",
    "  await page.waitForTimeout(1000);",
    "});",
  ].join('\n');
  const matched = fps.flatMap((d) => detectForbiddenPattern(badSpec, d)).map((f) => f.matched);
  assert.ok(matched.some((m) => /waitForTimeout/.test(m)), 'should flag waitForTimeout');
  assert.ok(matched.some((m) => /page\.route\(['"]\*\*/.test(m)), 'should flag wildcard route');
});

test('e2e-playwright forbidden-patterns do not flag a compliant spec', async () => {
  const fps = await e2eForbiddenPatterns();
  const goodSpec = [
    "const API = 'https://api.example.com';",
    "await page.route(`${API}/posts*`, (r) => r.fulfill({ json: [] }));",
    "await expect(page.getByText('글')).toBeVisible();",
  ].join('\n');
  const findings = fps.flatMap((d) => detectForbiddenPattern(goodSpec, d));
  assert.equal(findings.length, 0, `compliant spec should be clean, got ${JSON.stringify(findings)}`);
});
