import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderCatalog, applyCatalog, brief, PLUGIN_ROOT } from '../scripts/readmeCatalog.mjs';

test('README 전체 목록이 명령·스킬·에이전트 머리말에서 만든 결과와 같다(다르면 node scripts/readmeCatalog.mjs --write)', () => {
  const readme = readFileSync(join(PLUGIN_ROOT, 'README.md'), 'utf8');
  const next = applyCatalog(readme, renderCatalog());
  assert.notEqual(next, null, 'README 에 catalog 표시가 없다');
  assert.equal(next, readme);
});

test('brief: 첫 문장만·발동 문구 제거·길이 제한·파이프 이스케이프', () => {
  assert.equal(brief('Use when reviewing code — long tail'), 'reviewing code');
  assert.equal(brief('a | b'), 'a \\| b');
  assert.ok(brief('x'.repeat(300)).length <= 110);
});
