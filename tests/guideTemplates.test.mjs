import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseInventory } from '../scripts/guide/inventory.mjs';
import { parseGuideSource } from '../scripts/guide/gate.mjs';

const t = (n) => readFileSync(fileURLToPath(new URL(`../templates/${n}`, import.meta.url)), 'utf8');

test('inventory.md.tmpl: 자리표시자를 최소값으로 채우면 parseInventory ok', () => {
  const md = t('inventory.md.tmpl').replace('{{VERSION}}', '1.0.0').replace('{{ANALYZED_AT}}', '2026-09-12').replace(/\{\{TYPE\}\}/g, 'web').replace(/\{\{PRODUCT\}\}/g, 'Demo')
    .replace('{{STACK_YAML}}', '  router: react-router').replace('{{SCENARIOS_YAML}}', '  []').replace('{{SCREENS_YAML}}', '  - id: SCR-home\n    title: 홈\n    route: "/"\n    capture: { mode: auto }\n    publish: true\n    source: [code:a.tsx:1]').replace('{{PREP_YAML}}', '  audience: null').replace('{{HUMAN_TABLE}}', '| id | 제목 |\n|---|---|');
  const r = parseInventory(md);
  assert.equal(r.kind, 'ok', r.reason);
});
test('guide.md.tmpl: 채우면 parseGuideSource ok', () => {
  const md = t('guide.md.tmpl').replace(/\{\{VERSION\}\}/g, '1.0.0').replace('{{COVERS_YAML}}', '  - item: SCR-home\n    shot: shots/SCR-home.png').replace('{{CHANGELOG_COVERS_YAML}}', '').replace(/\{\{PRODUCT\}\}/g, 'Demo').replace('{{COVER_LINE}}', '버전 1.0.0').replace('{{SECTIONS}}', '## 1. 무엇을 하는 도구인가\n\n데모.');
  const r = parseGuideSource(md);
  assert.equal(r.kind, 'ok', r.reason);
  assert.equal(r.meta.covers.length, 1);
});
test('dt-guide.json.tmpl: 채우면 JSON', () => {
  const j = JSON.parse(t('dt-guide.json.tmpl').replace('{{PRODUCT}}', 'Demo').replace('{{PDF_NAME}}', 'Demo-User-Guide.pdf').replace('{{TYPE}}', 'web'));
  assert.equal(j.pdfName, 'Demo-User-Guide.pdf');
});
