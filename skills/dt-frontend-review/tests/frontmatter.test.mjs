import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

test('parses simple scalar fields', () => {
  const md = `---
ruleId: my-rule
severity: critical
---

body text`;
  const { data, body } = parseFrontmatter(md);
  assert.equal(data.ruleId, 'my-rule');
  assert.equal(data.severity, 'critical');
  assert.equal(body.trim(), 'body text');
});

test('parses array fields with inline syntax', () => {
  const md = `---
appliesTo: ["src/**/*.ts", "src/**/*.tsx"]
---
`;
  const { data } = parseFrontmatter(md);
  assert.deepEqual(data.appliesTo, ['src/**/*.ts', 'src/**/*.tsx']);
});

test('parses nested array of maps (detection)', () => {
  const md = `---
detection:
  - type: forbidden-import
    matches: ["axios", "**/apiClient"]
    rationale: "Domain은 API 직접 호출 금지"
  - type: forbidden-call
    matches: ["useQuery"]
---
`;
  const { data } = parseFrontmatter(md);
  assert.equal(data.detection.length, 2);
  assert.equal(data.detection[0].type, 'forbidden-import');
  assert.deepEqual(data.detection[0].matches, ['axios', '**/apiClient']);
  assert.equal(data.detection[1].type, 'forbidden-call');
});

test('returns null data when no frontmatter', () => {
  const md = 'just body';
  const { data, body } = parseFrontmatter(md);
  assert.equal(data, null);
  assert.equal(body, 'just body');
});

test('handles relatedRules as array', () => {
  const md = `---
relatedRules: [where-does-business-logic-go, dto-vs-viewmodel]
---
`;
  const { data } = parseFrontmatter(md);
  assert.deepEqual(data.relatedRules, ['where-does-business-logic-go', 'dto-vs-viewmodel']);
});

test('parses array with {a,b} glob alternation (no comma split inside braces)', () => {
  const md = `---
appliesTo: ["src/components/domain/**/*.{ts,tsx}"]
---
`;
  const { data } = parseFrontmatter(md);
  assert.deepEqual(data.appliesTo, ['src/components/domain/**/*.{ts,tsx}']);
});
