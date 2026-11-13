import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOverrideKeys } from '../scripts/lib/overrides.mjs';

test('loadOverrideKeys returns declared keys', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ov-'));
  await writeFile(join(dir, '.dt-frontend.json'), JSON.stringify({ overrides: { styling: 'mui' } }));
  const keys = await loadOverrideKeys(dir, '.dt-frontend.json');
  assert.ok(keys.has('styling'));
  await rm(dir, { recursive: true, force: true });
});

test('loadOverrideKeys empty when no config / no overrides', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ov-'));
  const empty = await loadOverrideKeys(dir, '.dt-frontend.json'); // no file
  assert.equal(empty.size, 0);
  await writeFile(join(dir, '.dt-frontend.json'), JSON.stringify({ paths: ['src/'] }));
  const noOv = await loadOverrideKeys(dir, '.dt-frontend.json');
  assert.equal(noOv.size, 0);
  await rm(dir, { recursive: true, force: true });
});

import { decisionRefOf, loadOverrides, overrideDecisionFindings } from '../scripts/lib/overrides.mjs';
import { mkdir } from 'node:fs/promises';

const PD = (id, status = 'accepted', extra = '') => `---\nid: ${id}\ntitle: t\nstatus: ${status}\nscope: s\ndate: 2026-11-13\n${extra}---\n## 맥락\n## 결정\n## 이유\n## 버린 대안\n## 출처\n`;

test('decisionRefOf: "PD-NNN" 문자열이나 { decisionRef } 만 근거로 본다', () => {
  assert.equal(decisionRefOf('PD-002'), 'PD-002');
  assert.equal(decisionRefOf({ value: 'mui', decisionRef: 'PD-003' }), 'PD-003');
  assert.equal(decisionRefOf('mui'), null);
  assert.equal(decisionRefOf(true), null);
});

test('overrideDecisionFindings: 근거 없음·없는 PD·대체된 PD 는 critical, 만료는 important, 유효하면 없음', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ov-'));
  await mkdir(join(dir, 'docs/decisions'), { recursive: true });
  await writeFile(join(dir, 'docs/decisions/PD-001-ok.md'), PD('PD-001'));
  await writeFile(join(dir, 'docs/decisions/PD-002-old.md'), PD('PD-002', 'superseded', 'supersededBy: PD-001\n'));
  await writeFile(join(dir, 'docs/decisions/PD-003-exp.md'), PD('PD-003', 'accepted', 'expires: 2000-01-01\n'));
  await writeFile(join(dir, '.dt-frontend.json'), JSON.stringify({ overrides: {
    styling: { value: 'mui', decisionRef: 'PD-001' }, a: 'mui', b: 'PD-009', c: 'PD-002', d: 'PD-003',
  } }));
  assert.equal((await loadOverrides(dir)).length, 5);
  const f = await overrideDecisionFindings(dir, '.dt-frontend.json');
  const by = Object.fromEntries(f.map((x) => [x.message.split(':')[0], x.severity]));
  assert.deepEqual(by, { 'overrides.a': 'critical', 'overrides.b': 'critical', 'overrides.c': 'critical', 'overrides.d': 'important' });
  assert.ok(f.every((x) => x.ruleId === 'override-decision-ref' && x.file === '.dt-frontend.json'));
  await rm(dir, { recursive: true, force: true });
});

test('overrideDecisionFindings: overrides 가 없으면 아무것도 없다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ov-'));
  assert.deepEqual(await overrideDecisionFindings(dir), []);
  await rm(dir, { recursive: true, force: true });
});
