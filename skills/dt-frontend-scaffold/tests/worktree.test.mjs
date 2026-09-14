import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorktree, removeWorktree, listWorktrees, isDirty } from '../scripts/worktree.mjs';

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'dt-scaffold-wt-'));
  spawnSync('git', ['init', '--quiet'], { cwd: dir });
  spawnSync('git', ['config', 'user.email', 'wt@test'], { cwd: dir });
  spawnSync('git', ['config', 'user.name', 'wt'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), 'init');
  spawnSync('git', ['add', '.'], { cwd: dir });
  spawnSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: dir });
  return dir;
}

test('createWorktree adds a worktree at expected path', () => {
  const repo = makeRepo();
  try {
    const path = createWorktree(repo, 'task-x', '.dt-frontend/worktrees');
    assert.ok(existsSync(path), `worktree path ${path} should exist`);
    assert.ok(existsSync(join(path, 'README.md')), 'worktree should contain repo files');
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('removeWorktree cleans up', () => {
  const repo = makeRepo();
  try {
    const path = createWorktree(repo, 'task-y', '.dt-frontend/worktrees');
    removeWorktree(repo, path);
    assert.equal(existsSync(path), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('listWorktrees returns array including main + created', () => {
  const repo = makeRepo();
  try {
    createWorktree(repo, 'task-z', '.dt-frontend/worktrees');
    const list = listWorktrees(repo);
    assert.ok(list.length >= 2, `expected >=2 worktrees, got ${list.length}`);
    assert.ok(list.some((wt) => wt.includes('task-z')));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('isDirty returns true for uncommitted changes', () => {
  const repo = makeRepo();
  try {
    assert.equal(isDirty(repo), false);
    writeFileSync(join(repo, 'README.md'), 'modified');
    assert.equal(isDirty(repo), true);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('createWorktree fails clearly when target path already exists', () => {
  const repo = makeRepo();
  try {
    createWorktree(repo, 'dup', '.dt-frontend/worktrees');
    assert.throws(() => createWorktree(repo, 'dup', '.dt-frontend/worktrees'), /already exists|exists/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
