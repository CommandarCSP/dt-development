import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { collectHotspots } from '../scripts/hotspots.mjs';

const LOG = ['', 'src/a.ts', 'src/b.ts', '', 'src/a.ts', '', 'src/a.ts', 'src/b.ts'].join('\n');

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'hs-'));
  for (const f of ['src/a.ts', 'src/b.ts']) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), 'x'.repeat(100), 'utf8');
  }
  return root;
}

test('커밋 수로 순위를 매기고 함께 바뀐 쌍을 센다', () => {
  const r = collectHotspots(repo(), { runGit: () => LOG });
  assert.equal(r.available, true);
  assert.equal(r.files[0].file, 'src/a.ts');
  assert.equal(r.files[0].commits, 3);
  assert.deepEqual(r.coChange[0], { pair: ['src/a.ts', 'src/b.ts'], count: 2 });
});

test('지워진 파일은 순위에서 뺀다', () => {
  const r = collectHotspots(repo(), { runGit: () => ['', 'src/a.ts', 'src/gone.ts'].join('\n') });
  assert.deepEqual(r.files.map((f) => f.file), ['src/a.ts']);
});

test('git 이 실패하면 비우고 이유를 남긴다', () => {
  const r = collectHotspots(repo(), { runGit: () => { throw new Error('not a git repository'); } });
  assert.equal(r.available, false);
  assert.match(r.reason, /git/);
  assert.deepEqual(r.files, []);
});

test('이력이 비면 얕은 클론일 수 있다고 남긴다', () => {
  const r = collectHotspots(repo(), { runGit: () => '' });
  assert.equal(r.available, false);
  assert.match(r.reason, /얕은/);
});
