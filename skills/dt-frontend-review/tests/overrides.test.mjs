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
