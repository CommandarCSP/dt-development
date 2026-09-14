#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Run a phase gate. Each subgate can be enabled/disabled.
// Returns: { ok, failures: [{ gate, message }], skipped: [...] }
export function runGate({
  projectRoot,
  runTsc = true,
  runVitest = true,
  runReview = true,
  runPrisma = false,                // BE: `prisma validate` (Phase 1) or `migrate diff` (Phase 2)
  reviewPaths = [],
  reviewMode = 'partial',           // 'partial' or 'full'
  reviewScript = null,              // absolute path to review.mjs (auto-detect if null)
  reviewStack = null,               // 'frontend' | 'backend' — appended as --stack
  vitestArgs = ['run'],
  testCommand = null,               // [cmd, argsArray] — overrides vitest invocation (e.g. BE jest)
  prismaArgs = ['validate'],        // args for the prisma subgate
}) {
  const failures = [];
  const skipped = [];

  if (runTsc) {
    const [cmd, cargs] = binCmd(projectRoot, 'tsc', ['--noEmit']);
    const result = spawnSync(cmd, cargs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.error || result.status == null) {
      skipped.push('tsc');
    } else if (result.status !== 0) {
      failures.push({ gate: 'tsc', message: result.stdout + result.stderr });
    }
  }

  if (runPrisma) {
    const [cmd, cargs] = binCmd(projectRoot, 'prisma', prismaArgs);
    const result = spawnSync(cmd, cargs, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.error || result.status == null) {
      skipped.push('prisma');
    } else if (result.status !== 0) {
      failures.push({ gate: 'prisma', message: result.stdout + result.stderr });
    }
  }

  if (runVitest) {
    const [cmd, args] = testCommand || binCmd(projectRoot, 'vitest', vitestArgs);
    const label = testCommand ? 'test' : 'vitest';
    const result = spawnSync(cmd, args, {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.error || result.status == null) {
      skipped.push(label);
    } else if (result.status !== 0) {
      failures.push({ gate: label, message: result.stdout + result.stderr });
    }
  }

  if (runReview) {
    if (reviewPaths.length === 0 && reviewMode === 'partial') {
      // nothing to review — treat as pass
      skipped.push('review (no paths)');
    } else {
      const script = reviewScript || autoDetectReviewScript();
      if (!script) {
        failures.push({
          gate: 'review',
          message: 'review script not found — pass --review-script <path> or install dt-frontend plugin properly',
        });
      } else {
        const args = [script, reviewMode, '--no-coverage', '--project', projectRoot];
        if (reviewMode === 'partial') {
          args.push('--paths', reviewPaths.join(','));
        }
        if (reviewStack) {
          args.push('--stack', reviewStack);
        }
        const result = spawnSync('node', args, { encoding: 'utf8' });
        if (result.status === 1) {
          failures.push({ gate: 'review', message: result.stdout });
        } else if (result.status !== 0) {
          failures.push({ gate: 'review', message: `review crashed: ${result.stderr}` });
        }
      }
    }
  }

  return { ok: failures.length === 0, failures, skipped };
}

// Prefer the project-local binary (node_modules/.bin/<tool>) over `npx`,
// which can resolve to a broken global shim in some environments (pilot finding).
// Falls back to npx when the local binary isn't present.
function binCmd(projectRoot, tool, toolArgs = []) {
  const local = join(projectRoot, 'node_modules', '.bin', tool);
  if (existsSync(local)) return [local, toolArgs];
  return ['npx', [tool, ...toolArgs]];
}

function autoDetectReviewScript() {
  // Primary: gate.mjs is at skills/dt-frontend-scaffold/scripts/, so
  // ../../dt-frontend-review/scripts/review.mjs is the canonical relative path.
  // Fallback: honor CLAUDE_PLUGIN_ROOT env var if set (e.g. when plugin is invoked from a slash command).
  const candidates = [
    new URL('../../dt-frontend-review/scripts/review.mjs', import.meta.url).pathname,
  ];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(`${process.env.CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/scripts/review.mjs`);
  }
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);
  const projectRoot = resolve(opts.project || process.cwd());
  // --test-runner jest selects the BE jest command; default keeps vitest.
  const testCommand = opts['test-runner'] === 'jest'
    ? binCmd(projectRoot, 'jest', ['--coverage=false'])
    : null;
  const result = runGate({
    projectRoot,
    runTsc: opts.tsc !== 'false',
    runVitest: opts.test !== 'false' && opts.vitest !== 'false',
    runReview: opts.review !== 'false',
    runPrisma: opts.prisma === 'true' || opts.prisma === true,
    reviewPaths: typeof opts.paths === 'string' ? opts.paths.split(',').filter(Boolean) : [],
    reviewMode: typeof opts.mode === 'string' ? opts.mode : 'partial',
    reviewScript: typeof opts['review-script'] === 'string' ? opts['review-script'] : null,
    reviewStack: typeof opts.stack === 'string' ? opts.stack : null,
    testCommand,
    prismaArgs: typeof opts['prisma-args'] === 'string' ? opts['prisma-args'].split(' ') : ['validate'],
  });

  for (const s of result.skipped) {
    console.log(`[gate] skipped: ${s}`);
  }
  for (const f of result.failures) {
    console.error(`[gate] FAIL ${f.gate}:`);
    console.error(f.message);
  }
  if (result.ok) {
    const testGate = opts['test-runner'] === 'jest' ? 'test' : 'vitest';
    const enabled = [
      opts.tsc !== 'false' && 'tsc',
      (opts.prisma === 'true' || opts.prisma === true) && 'prisma',
      (opts.test !== 'false' && opts.vitest !== 'false') && testGate,
      opts.review !== 'false' && 'review',
    ].filter(Boolean);
    const ran = enabled.filter((g) => !result.skipped.some((s) => s.includes(g)));
    console.log(`[gate] OK (${ran.length === 0 ? 'all skipped' : ran.join(', ') + ' passed'})`);
  }
  process.exit(result.ok ? 0 : 1);
}

function parseArgs(arr) {
  const opts = {};
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].startsWith('--')) {
      const k = arr[i].slice(2);
      const next = arr[i + 1];
      if (next && !next.startsWith('--')) {
        opts[k] = next;
        i++;
      } else {
        opts[k] = true;
      }
    }
  }
  return opts;
}
