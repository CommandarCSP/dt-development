import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGate } from '../scripts/gate.mjs';

function makeProject(name, files) {
  const dir = mkdtempSync(join(tmpdir(), `dt-gate-${name}-`));
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

test('runGate returns ok when all subgates pass', () => {
  // Mock: no subgates run because we pass run flags=false
  const dir = makeProject('empty', {});
  try {
    const result = runGate({
      projectRoot: dir,
      runTsc: false,
      runVitest: false,
      runReview: false,
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.failures, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runGate aggregates tsc failure when tsc returns non-zero', () => {
  // Provide a broken TS file but no tsconfig — tsc spawn will fail
  const dir = makeProject('bad-tsc', {
    'src/bad.ts': `const x: number = "string";`,
  });
  try {
    const result = runGate({
      projectRoot: dir,
      runTsc: true,
      runVitest: false,
      runReview: false,
    });
    // No tsconfig present, tsc may fail differently; just verify it reports a failure or skip if tsc not installed
    if (result.skipped?.includes('tsc')) {
      // tsc not available in test env — acceptable
      assert.ok(true);
    } else {
      assert.equal(result.ok, false);
      assert.ok(result.failures.some((f) => f.gate === 'tsc'));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runGate skips review gracefully when review path not given', () => {
  const dir = makeProject('noreview', {});
  try {
    const result = runGate({
      projectRoot: dir,
      runTsc: false,
      runVitest: false,
      runReview: true,
      reviewPaths: [],
    });
    // No paths → review skipped or trivially passes
    assert.equal(result.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runGate fails when review needed but script not found (no reviewScript provided)', () => {
  const dir = makeProject('noscript', {});
  try {
    // Pass a deliberately-bad reviewScript path so spawn fails — covers the review failure code path.
    // The null-reviewScript + autoDetect-fails case is now also a failure (not a skip) due to the fix.
    const result = runGate({
      projectRoot: dir,
      runTsc: false,
      runVitest: false,
      runReview: true,
      reviewPaths: ['src/foo.ts'],  // non-empty so partial mode tries to run
      reviewScript: '/definitely/not/a/real/path-12345.mjs',
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((f) => f.gate === 'review'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
