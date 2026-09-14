import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  currentBranch,
  isDirty,
  rebaseInProgress,
  aheadBehind,
  remoteBranchExists,
  gitState,
} from '../scripts/state.mjs';

function run(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

// 베어 origin + work 클론. work는 main 브랜치가 origin/main으로 push된 상태.
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dt-git-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  spawnSync('git', ['init', '--bare', '--quiet', origin]);
  spawnSync('git', ['init', '--quiet', '-b', 'main', work]);
  run(work, ['config', 'user.email', 'gf@test']);
  run(work, ['config', 'user.name', 'gf']);
  writeFileSync(join(work, 'README.md'), 'init\n');
  run(work, ['add', '.']);
  run(work, ['commit', '--quiet', '-m', 'init']);
  run(work, ['remote', 'add', 'origin', origin]);
  run(work, ['push', '--quiet', '-u', 'origin', 'main']);
  return { root, origin, work };
}

function commitFile(work, name, content, msg) {
  writeFileSync(join(work, name), content);
  run(work, ['add', name]);
  run(work, ['commit', '--quiet', '-m', msg]);
}

test('currentBranch returns the checked-out branch', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(currentBranch(work), 'main');
    run(work, ['switch', '-c', 'feat/x']);
    assert.equal(currentBranch(work), 'feat/x');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('isDirty reflects uncommitted changes', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(isDirty(work), false);
    writeFileSync(join(work, 'README.md'), 'changed\n');
    assert.equal(isDirty(work), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rebaseInProgress is true during a conflicted rebase, false after abort', () => {
  const { root, work } = makeRepo();
  try {
    // main: README 1번째 줄을 main-edit 로 바꿈
    commitFile(work, 'README.md', 'main-edit\n', 'main edit');
    // feat: 같은 줄을 feat-edit 로 바꿈 (init 시점에서 분기)
    run(work, ['switch', '-c', 'feat/x', 'HEAD~1']);
    commitFile(work, 'README.md', 'feat-edit\n', 'feat edit');
    assert.equal(rebaseInProgress(work), false);

    // main 위로 rebase → 충돌로 멈춤
    const r = spawnSync('git', ['rebase', 'main'], { cwd: work, encoding: 'utf8' });
    assert.notEqual(r.status, 0, 'rebase should stop on conflict');
    assert.equal(rebaseInProgress(work), true);

    run(work, ['rebase', '--abort']);
    assert.equal(rebaseInProgress(work), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('aheadBehind counts commits relative to a base ref', () => {
  const { root, work } = makeRepo();
  try {
    run(work, ['switch', '-c', 'feat/x']);
    commitFile(work, 'a.txt', 'a\n', 'add a');
    commitFile(work, 'b.txt', 'b\n', 'add b');
    // origin/main 대비 2 ahead, 0 behind
    assert.deepEqual(aheadBehind(work, 'origin/main'), { ahead: 2, behind: 0 });

    // origin/main 을 1커밋 전진시키면 feat 는 1 behind
    run(work, ['switch', 'main']);
    commitFile(work, 'c.txt', 'c\n', 'add c');
    run(work, ['push', '--quiet', 'origin', 'main']);
    run(work, ['switch', 'feat/x']);
    assert.deepEqual(aheadBehind(work, 'origin/main'), { ahead: 2, behind: 1 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('remoteBranchExists reflects branches on origin', () => {
  const { root, work } = makeRepo();
  try {
    assert.equal(remoteBranchExists(work, 'main'), true);
    assert.equal(remoteBranchExists(work, 'feat/x'), false);

    run(work, ['switch', '-c', 'feat/x']);
    commitFile(work, 'a.txt', 'a\n', 'add a');
    run(work, ['push', '--quiet', '-u', 'origin', 'feat/x']);
    assert.equal(remoteBranchExists(work, 'feat/x'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gitState aggregates a snapshot for a clean feature branch', () => {
  const { root, work } = makeRepo();
  try {
    run(work, ['switch', '-c', 'feat/x']);
    commitFile(work, 'a.txt', 'a\n', 'add a');
    const s = gitState(work, 'origin/main');
    assert.equal(s.currentBranch, 'feat/x');
    assert.equal(s.isMain, false);
    assert.equal(s.dirty, false);
    assert.equal(s.rebaseInProgress, false);
    assert.deepEqual(s.aheadBehind, { ahead: 1, behind: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('gitState sets aheadBehind null when base ref is missing', () => {
  const { root, work } = makeRepo();
  try {
    const s = gitState(work, 'origin/nonexistent');
    assert.equal(s.aheadBehind, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI prints JSON snapshot', () => {
  const { root, work } = makeRepo();
  try {
    const cli = new URL('../scripts/state.mjs', import.meta.url).pathname;
    const r = spawnSync('node', [cli, 'origin/main'], { cwd: work, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const s = JSON.parse(r.stdout);
    assert.equal(s.currentBranch, 'main');
    assert.equal(s.isMain, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
