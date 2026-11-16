#!/usr/bin/env node
/**
 * 스택 명령 고르기 — 프로젝트가 쓰는 패키지 관리자·테스트 도구와 실행 명령(설치·테스트·커버리지·수용 e2e·개발 서버).
 * 리뷰 엔진(커버리지), 스캐폴드 게이트(테스트), 스킬(수용 e2e·개발 서버)이 모두 이것을 쓴다. 키 설명은 docs/refs/stack-config.md.
 *
 * 순서: 스택 설정 `commands.*`(그대로 씀) → 스택 설정 `packageManager`·`testRunner`
 *       → package.json(`packageManager`·의존성·`scripts.test`) → lockfile → 스택 기본값.
 *
 * CLI: node scripts/stackCommands.mjs [--stack frontend|backend] [--project <dir>] [--json]
 *   기본은 사람이 읽는 표. --json 은 { packageManager, testRunner, commands: {이름: "명령 문자열"}, from }.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNNERS = ['vitest', 'jest'];
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'];
export const COMMAND_NAMES = ['install', 'test', 'coverage', 'accept', 'acceptLive', 'dev'];

const STACK_DEFAULTS = {
  frontend: { configFileName: '.dt-frontend.json', packageManager: 'pnpm', testRunner: 'vitest' },
  backend: { configFileName: '.dt-backend.json', packageManager: 'npm', testRunner: 'jest' },
};
const LOCKFILES = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm']];
const EXEC = { pnpm: ['pnpm', ['exec']], npm: ['npx', []], yarn: ['yarn', []] };
const INSTALL = {
  pnpm: ['pnpm', ['install', '--prefer-frozen-lockfile']],
  npm: ['npm', ['ci']],
  yarn: ['yarn', ['install', '--frozen-lockfile']],
};
const TEST_ARGS = { vitest: ['vitest', 'run'], jest: ['jest'] };
const COVERAGE_ARGS = {
  vitest: ['--coverage', '--coverage.reporter=json-summary'],
  jest: ['--coverage', '--coverageReporters=json-summary'],
};
/** package.json 스크립트로 부르는 명령 — 이름이 다르면 commands.* 로 적는다. */
const SCRIPTS = { accept: 'test:accept', acceptLive: 'test:accept:live', dev: 'dev' };

/** 문자열이면 셸로, 배열이면 [명령, ...인자]로. */
export function toCommand(v) {
  if (typeof v === 'string' && v.trim()) return ['sh', ['-c', v]];
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) return [v[0], v.slice(1)];
  return null;
}

/** [명령, 인자] → 사람이 읽는 한 줄. sh -c 는 안쪽 문자열만. */
export function commandString([cmd, args]) {
  if (cmd === 'sh' && args[0] === '-c') return args[1];
  return [cmd, ...args].join(' ');
}

export function readStackConfig(projectRoot, stack) {
  const name = STACK_DEFAULTS[stack]?.configFileName;
  if (!name) return {};
  try { return JSON.parse(readFileSync(join(projectRoot, name), 'utf8')) ?? {}; } catch { return {}; }
}

function readPackageJson(projectRoot) {
  try { return JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')); } catch { return null; }
}

function pickPackageManager(projectRoot, pkg, cfg, fallback) {
  if (cfg.packageManager) return { value: cfg.packageManager, from: '설정' };
  const declared = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  if (PACKAGE_MANAGERS.includes(declared)) return { value: declared, from: 'package.json packageManager' };
  for (const [file, pm] of LOCKFILES) if (existsSync(join(projectRoot, file))) return { value: pm, from: file };
  return { value: fallback, from: '기본값' };
}

function pickRunner(pkg, cfg, fallback) {
  if (cfg.testRunner) return { value: cfg.testRunner, from: '설정' };
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const has = RUNNERS.filter((r) => r in deps);
  if (has.length === 1) return { value: has[0], from: 'package.json 의존성' };
  const script = pkg?.scripts?.test ?? '';
  const inScript = RUNNERS.filter((r) => new RegExp(`\\b${r}\\b`).test(script));
  if (inScript.length === 1) return { value: inScript[0], from: 'package.json scripts.test' };
  return { value: fallback, from: '기본값' };
}

/**
 * @param {'frontend'|'backend'} stack
 * @param {string} projectRoot
 * @param {object} [config] 스택 설정 객체. 없으면 projectRoot 의 설정 파일을 읽는다.
 * @returns {{ packageManager, testRunner, commands: Record<string, [string, string[]]>, from: Record<string,string>, describe: string }}
 */
export function resolveStackCommands(stack, projectRoot, config) {
  const def = STACK_DEFAULTS[stack];
  if (!def) throw new Error(`unknown stack '${stack}' (expected one of: ${Object.keys(STACK_DEFAULTS).join(', ')})`);
  const cfg = config ?? readStackConfig(projectRoot, stack);
  if (cfg.testRunner != null && !RUNNERS.includes(cfg.testRunner)) {
    throw new Error(`testRunner '${cfg.testRunner}' 는 모르는 값이다 — ${RUNNERS.join(' | ')} 중 하나, 아니면 commands.test·commands.coverage 로 명령을 직접 적는다`);
  }
  if (cfg.packageManager != null && !PACKAGE_MANAGERS.includes(cfg.packageManager)) {
    throw new Error(`packageManager '${cfg.packageManager}' 는 모르는 값이다 — ${PACKAGE_MANAGERS.join(' | ')} 중 하나, 아니면 commands.* 로 명령을 직접 적는다`);
  }
  const pkg = readPackageJson(projectRoot);
  const pm = pickPackageManager(projectRoot, pkg, cfg, def.packageManager);
  const runner = pickRunner(pkg, cfg, def.testRunner);
  const given = cfg.commands ?? {};
  const [exec, pre] = EXEC[pm.value];
  const run = (script) => [pm.value, ['run', script]];

  const picked = {
    install: INSTALL[pm.value],
    test: [exec, [...pre, ...TEST_ARGS[runner.value]]],
    // FE 기본 조합(pnpm + vitest + test 스크립트)은 지금까지처럼 test 스크립트로 잰다.
    coverage: pm.value === 'pnpm' && runner.value === 'vitest' && pkg?.scripts?.test
      ? ['pnpm', ['test', '--run', ...COVERAGE_ARGS.vitest]]
      : [exec, [...pre, ...TEST_ARGS[runner.value], ...COVERAGE_ARGS[runner.value]]],
    accept: run(SCRIPTS.accept),
    acceptLive: run(SCRIPTS.acceptLive),
    dev: run(SCRIPTS.dev),
  };
  const commands = {}; const from = {};
  for (const name of COMMAND_NAMES) {
    const explicit = toCommand(given[name]);
    commands[name] = explicit ?? picked[name];
    from[name] = explicit ? '설정' : name === 'install' ? pm.from : ['accept', 'acceptLive', 'dev'].includes(name) ? `${pm.from} · package.json scripts` : `${pm.from} · ${runner.from}`;
  }
  const describe = `${pm.value}(${pm.from}) + ${runner.value}(${runner.from})`;
  return { packageManager: pm.value, testRunner: runner.value, commands, from, describe };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const stack = opt('stack') ?? 'frontend';
  const projectRoot = resolve(opt('project') ?? process.cwd());
  try {
    const r = resolveStackCommands(stack, projectRoot);
    const strings = Object.fromEntries(Object.entries(r.commands).map(([k, v]) => [k, commandString(v)]));
    if (args.includes('--json')) {
      process.stdout.write(JSON.stringify({ packageManager: r.packageManager, testRunner: r.testRunner, commands: strings, from: r.from }, null, 2) + '\n');
    } else {
      process.stdout.write(`${stack}: ${r.describe}\n`);
      for (const name of COMMAND_NAMES) process.stdout.write(`  ${name.padEnd(10)} ${strings[name]}  [${r.from[name]}]\n`);
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
