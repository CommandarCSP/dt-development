import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPipelineConfig,
  loadLastSyncSha,
  currentBranch,
  headSha,
  unsyncedCommitCount,
  readSnooze,
  writeSnooze,
} from '../scripts/lib/pipeline-state.mjs';

function run(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dt-hooks-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  spawnSync('git', ['init', '--bare', '--quiet', origin]);
  spawnSync('git', ['init', '--quiet', '-b', 'main', work]);
  run(work, ['config', 'user.email', 'h@test']);
  run(work, ['config', 'user.name', 'h']);
  writeFileSync(join(work, 'README.md'), 'init\n');
  run(work, ['add', '.']);
  run(work, ['commit', '--quiet', '-m', 'init']);
  run(work, ['remote', 'add', 'origin', origin]);
  run(work, ['push', '--quiet', '-u', 'origin', 'main']);
  return { root, work };
}

function commit(work, name) {
  writeFileSync(join(work, name), name + '\n');
  run(work, ['add', name]);
  run(work, ['commit', '--quiet', '-m', name]);
}

test('loadPipelineConfig returns null when absent, object when present', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(loadPipelineConfig(work), null);
    writeFileSync(join(work, '.dt-pipeline.json'), JSON.stringify({ enabled: true, commitThreshold: 2 }));
    assert.deepEqual(loadPipelineConfig(work), { enabled: true, commitThreshold: 2 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadLastSyncSha reads .dt-worklog.local.json', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(loadLastSyncSha(work), null);
    writeFileSync(join(work, '.dt-worklog.local.json'), JSON.stringify({ lastSyncSha: 'abc123' }));
    assert.equal(loadLastSyncSha(work), 'abc123');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('currentBranch and headSha reflect repo', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(currentBranch(work), 'main');
    assert.match(headSha(work), /^[0-9a-f]{40}$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('unsyncedCommitCount counts after lastSyncSha, falls back to origin/main', () => {
  const { root, work } = makeRepo();
  try {
    const base = headSha(work);
    commit(work, 'a.txt');
    commit(work, 'b.txt');
    assert.equal(unsyncedCommitCount(work, base), 2);
    assert.equal(unsyncedCommitCount(work, null), 2);
    // dangling lastSyncSha → origin/main..HEAD 로 폴백(영구 침묵 방지) = 2
    assert.equal(unsyncedCommitCount(work, 'nonexistent-ref'), 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writeSnooze/readSnooze round-trip via .git/dt-wrap-snooze', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(readSnooze(work), null);
    writeSnooze(work, 'deadbeef');
    assert.equal(readSnooze(work), 'deadbeef');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
