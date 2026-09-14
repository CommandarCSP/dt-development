import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSpecHeader, parseSpecHeader } from '../scripts/buildSpecHeader.mjs';

const tmpl = readFileSync(new URL('../templates/layout-skeleton.md.tmpl', import.meta.url), 'utf8');
const reqTmpl = readFileSync(new URL('../templates/requirements.md.tmpl', import.meta.url), 'utf8');

test('layout-skeleton.md.tmpl: 헤더 4줄이 requirements.md.tmpl과 동일 구조', () => {
  const head = (s) => s.split('\n').slice(0, 4).join('\n');
  assert.equal(head(tmpl), head(reqTmpl));
});

test('layout-skeleton.md.tmpl: [7-3] 통째 치환을 모사하면 parseSpecHeader가 파싱 가능', () => {
  // WHY: use new multi-source signature to maintain forward compatibility
  const header = buildSpecHeader({
    generatedAt: '2026-06-01T00:00:00.000Z',
    status: 'finalized',
    sources: [
      { type: 'figma', locator: '235:1412', role: 'design' },
      { type: 'figma', locator: '14:7347', role: 'wireframe' }
    ]
  });
  const replaced = [header, ...tmpl.split('\n').slice(4)].join('\n');
  const parsed = parseSpecHeader(replaced);
  // WHY: new signature uses sources array, but we can verify the locators are present
  assert.ok(parsed.sources.some(s => s.locator === '235:1412'));
  assert.ok(parsed.sources.some(s => s.locator === '14:7347'));
  assert.equal(parsed.status, 'finalized');
});

test('layout-skeleton.md.tmpl: 본문 슬롯 {{SKELETON_TSX}} 포함', () => {
  assert.ok(tmpl.includes('{{SKELETON_TSX}}'));
});
