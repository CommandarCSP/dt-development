import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Parse `coverage-summary.json` (vitest --reporter=json-summary output).
export function parseCoverageSummary(json) {
  const files = {};
  let total = 0;
  for (const [key, value] of Object.entries(json)) {
    if (key === 'total') {
      total = value.lines?.pct ?? 0;
    } else if (value.lines?.pct != null) {
      files[key] = value.lines.pct;
    }
  }
  return { total, files };
}

// Compare HEAD coverage vs BASE coverage for changed files.
// head: { total, files: { path: pct } }
// base: { total, files: { path: pct } }
// changed: string[] (paths relative to repo root)
// threshold: number (e.g. 80)
// baselineProtection: bool — if true, modified files must not drop below their base pct
export function compareCoverage({ head, base, changed, threshold, baselineProtection }) {
  const findings = [];
  for (const path of changed) {
    const headPct = head.files[path];
    const basePct = base.files[path];
    if (headPct == null) continue; // file not in coverage (e.g. excluded)
    const isNew = basePct == null;
    if (isNew) {
      if (headPct < threshold) {
        findings.push({
          severity: 'critical',
          file: path,
          headPct,
          reason: 'new-file-below-threshold',
          message: `신규 파일 ${path}: ${headPct}% (${threshold}% 필요)`,
        });
      }
    } else if (baselineProtection && headPct < basePct) {
      findings.push({
        severity: 'critical',
        file: path,
        headPct,
        basePct,
        reason: 'baseline-drop',
        message: `${path}: ${headPct}% (base ${basePct}%, -${basePct - headPct}% baseline 하락)`,
      });
    }
  }
  return { findings };
}

// Default test runner (frontend / vitest). Backend passes a jest command.
export const DEFAULT_TEST_COMMAND = ['pnpm', ['test', '--run', '--coverage', '--coverage.reporter=json-summary']];
export const DEFAULT_INSTALL_COMMAND = ['pnpm', ['install', '--prefer-frozen-lockfile']];

// Run the test runner with coverage in given working directory, return parsed summary.
// testCommand: [cmd, argsArray] — overridable per stack (vitest vs jest). Both emit
// coverage/coverage-summary.json with the same shape.
export function measureCoverage(workdir, { testCommand = DEFAULT_TEST_COMMAND } = {}) {
  const [cmd, args] = testCommand;
  const result = spawnSync(
    cmd,
    args,
    { cwd: workdir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout };
  }
  const summaryPath = join(workdir, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) {
    return { ok: false, error: 'coverage-summary.json not produced' };
  }
  const json = JSON.parse(readFileSync(summaryPath, 'utf8'));
  return { ok: true, summary: parseCoverageSummary(json) };
}

// Create a temporary worktree at baseRef, run coverage there, then clean up.
// Returns null on failure.
export function measureBaselineCoverage(repoRoot, baseRef, {
  testCommand = DEFAULT_TEST_COMMAND,
  installCommand = DEFAULT_INSTALL_COMMAND,
} = {}) {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'dt-baseline-'));
  try {
    const add = spawnSync('git', ['worktree', 'add', '--detach', tmpRoot, baseRef], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (add.status !== 0) {
      return { ok: false, error: add.stderr };
    }
    // install deps in the worktree (uses lockfile, fast if cached)
    const [instCmd, instArgs] = installCommand;
    const inst = spawnSync(instCmd, instArgs, {
      cwd: tmpRoot,
      encoding: 'utf8',
    });
    if (inst.status !== 0) {
      return { ok: false, error: `${instCmd} install failed in baseline worktree` };
    }
    const measured = measureCoverage(tmpRoot, { testCommand });
    return measured;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', tmpRoot], { cwd: repoRoot });
    try { rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  }
}

// Get changed files between baseRef and HEAD.
export function getChangedFiles(repoRoot, baseRef) {
  const result = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.trim().split('\n').filter(Boolean);
}
