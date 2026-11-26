import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadPipelineConfig,
  loadLastSyncSha,
  loadBaselines,
  loadWrapLabels,
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
    assert.deepEqual(loadPipelineConfig(work), { enabled: true, commitThreshold: 2, startReminder: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadPipelineConfig reads hooks from .dt.json, which wins over the legacy file', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt-pipeline.json'), JSON.stringify({ commitThreshold: 2 }));
    writeFileSync(join(work, '.dt.json'), JSON.stringify({ hooks: { commitThreshold: 5, startReminder: false } }));
    assert.deepEqual(loadPipelineConfig(work), { enabled: true, commitThreshold: 5, startReminder: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadPipelineConfig: .dt.json without hooks keeps hooks off', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt.json'), JSON.stringify({ team: { execution: 'parallel' } }));
    assert.equal(loadPipelineConfig(work), null);
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

test('unsyncedCommitCount: 기준점이 여럿이면 가장 최근 것, dangling 은 빼고 센다 (GEN-11)', () => {
  const { root, work } = makeRepo();
  try {
    const base = headSha(work);
    commit(work, 'a.txt');
    const mid = headSha(work);
    commit(work, 'b.txt');
    assert.equal(unsyncedCommitCount(work, [base, mid]), 1, '더 최근(mid)부터');
    assert.equal(unsyncedCommitCount(work, [mid, base]), 1, '순서와 무관');
    assert.equal(unsyncedCommitCount(work, ['nonexistent-ref', mid]), 1, 'dangling 은 빼고');
    assert.equal(unsyncedCommitCount(work, []), 2, '없으면 origin/main');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadBaselines: lastWrapSha(.dt-pipeline.local.json) 와 lastSyncSha 를 함께 읽는다', () => {
  const { root, work } = makeRepo();
  try {
    assert.deepEqual(loadBaselines(work), []);
    writeFileSync(join(work, '.dt-worklog.local.json'), JSON.stringify({ lastSyncSha: 'bbb' }));
    assert.deepEqual(loadBaselines(work), ['bbb']);
    writeFileSync(join(work, '.dt-pipeline.local.json'), JSON.stringify({ lastWrapSha: 'aaa' }));
    assert.deepEqual(loadBaselines(work), ['aaa', 'bbb']);
    writeFileSync(join(work, '.dt-pipeline.local.json'), '{ broken');
    assert.deepEqual(loadBaselines(work), ['bbb'], '망가진 파일은 없는 것처럼');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('loadWrapLabels: 설정 없으면 예전 단계, tracker·wiki 가 none 이면 커밋만', () => {
  const { root, work } = makeRepo();
  try {
    assert.deepEqual(loadWrapLabels(work), ['커밋 정리', 'Confluence 문서 판단', 'Jira 동기화']);
    writeFileSync(join(work, '.dt.json'), JSON.stringify({ tracker: 'none', wiki: 'none' }));
    assert.deepEqual(loadWrapLabels(work), ['커밋 정리']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
