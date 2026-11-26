#!/usr/bin/env node
// CLI entry for the dt review engine (stack-agnostic).
// Usage:
//   node review.mjs full [--base <ref>] [--no-coverage] [--project <path>] [--stack frontend|backend] [--verbose]
//   node review.mjs partial --paths a.ts,b.ts [--project <path>] [--stack frontend|backend] [--verbose]
//
// --stack:   which rule set + config file to use (default: frontend). The coverage command is
//            picked from the stack config's coverage.* and the project (lockfile, package.json).
// --verbose: show manual-review (사람 확인) items in full (default: summary only).

import { resolve } from 'node:path';
import { runFullMode } from './modes/full.mjs';
import { runPartialMode } from './modes/partial.mjs';
import { resolveStack } from './lib/stacks.mjs';

const rawArgs = process.argv.slice(2);
let mode = 'full';
let optsStart = 0;
if (rawArgs.length > 0 && (rawArgs[0] === 'full' || rawArgs[0] === 'partial')) {
  mode = rawArgs[0];
  optsStart = 1;
}
const opts = parseOpts(rawArgs.slice(optsStart));
const pluginRoot = resolve(new URL('../..', import.meta.url).pathname);
const projectRoot = resolve(opts.project ?? process.cwd());
const stackName = opts.stack ?? 'frontend';
const stack = resolveStack(stackName);

try {
  let report;
  const verbose = Boolean(opts.verbose);
  if (mode === 'full') {
    report = await runFullMode({
      pluginRoot,
      projectRoot,
      baseRef: opts.base ?? null,
      runCoverage: !opts['no-coverage'],
      verbose,
      stack: stackName,
      ruleLocations: stack.ruleLocations,
      configFileName: stack.configFileName,
    });
  } else {
    const paths = (opts.paths || '').split(',').filter(Boolean);
    report = await runPartialMode({ pluginRoot, projectRoot, paths, verbose, stack: stackName, ruleLocations: stack.ruleLocations, configFileName: stack.configFileName });
  }
  console.log(report);
  process.exit(/Ready to merge: No/.test(report) ? 1 : 0);
} catch (e) {
  console.error('review failed:', e.stack || e.message);
  process.exit(2);
}

function parseOpts(arr) {
  const opts = {};
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = arr[i + 1];
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}
