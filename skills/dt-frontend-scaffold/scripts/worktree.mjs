#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Public API

export function createWorktree(repoRoot, taskId, subDir = '.dt-frontend/worktrees') {
  const worktreesDir = join(repoRoot, subDir);
  mkdirSync(worktreesDir, { recursive: true });
  const target = join(worktreesDir, taskId);
  if (existsSync(target)) {
    throw new Error(`worktree path already exists: ${target}`);
  }
  const branch = currentBranch(repoRoot);
  const result = spawnSync('git', ['worktree', 'add', '--detach', target, branch], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git worktree add failed: ${result.stderr.trim()}`);
  }
  return target;
}

export function removeWorktree(repoRoot, worktreePath) {
  const result = spawnSync('git', ['worktree', 'remove', '--force', worktreePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git worktree remove failed: ${result.stderr.trim()}`);
  }
}

export function listWorktrees(repoRoot) {
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  const paths = [];
  for (const line of result.stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      paths.push(line.slice('worktree '.length).trim());
    }
  }
  return paths;
}

export function isDirty(repoRoot) {
  const result = spawnSync('git', ['status', '--porcelain'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.stdout.trim().length > 0;
}

function currentBranch(repoRoot) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return result.stdout.trim() || 'HEAD';
}

// CLI entry: node worktree.mjs <create|remove|list|isDirty> [args]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  try {
    if (cmd === 'create') {
      const taskId = args[0];
      const subDir = args[1]; // optional — e.g. '.dt-backend/worktrees'
      if (!taskId) { console.error('usage: worktree.mjs create <task-id> [subDir]'); process.exit(2); }
      console.log(subDir ? createWorktree(cwd, taskId, subDir) : createWorktree(cwd, taskId));
    } else if (cmd === 'remove') {
      const path = args[0];
      if (!path) { console.error('usage: worktree.mjs remove <path>'); process.exit(2); }
      removeWorktree(cwd, resolve(path));
    } else if (cmd === 'list') {
      for (const p of listWorktrees(cwd)) console.log(p);
    } else if (cmd === 'isDirty') {
      process.exit(isDirty(cwd) ? 1 : 0);
    } else {
      console.error('usage: worktree.mjs create|remove|list|isDirty');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
