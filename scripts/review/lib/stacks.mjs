import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STACK_RULE_LOCATIONS } from './rule-loader.mjs';

// Per-stack knobs for the (stack-agnostic) review engine.
// - ruleLocations:  where this stack's rule .md files live (relative to pluginRoot)
// - configFileName: the project config that holds coverage settings + enabledSkills
// - defaults:       package manager + test runner used when neither config nor project says otherwise
//
// 커버리지 명령은 resolveCoverageCommands 가 프로젝트를 보고 고른다(GEN-08).
// vitest·jest 둘 다 coverage/coverage-summary.json 을 같은 모양으로 내므로 parseCoverageSummary 하나로 읽는다.
export const STACKS = {
  frontend: {
    ruleLocations: STACK_RULE_LOCATIONS.frontend,
    configFileName: '.dt-frontend.json',
    defaults: { packageManager: 'pnpm', runner: 'vitest' },
  },
  backend: {
    ruleLocations: STACK_RULE_LOCATIONS.backend,
    configFileName: '.dt-backend.json',
    defaults: { packageManager: 'npm', runner: 'jest' },
  },
};

export function resolveStack(name) {
  const stack = STACKS[name];
  if (!stack) {
    throw new Error(`unknown stack '${name}' (expected one of: ${Object.keys(STACKS).join(', ')})`);
  }
  return stack;
}

export const RUNNERS = ['vitest', 'jest'];
export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn'];

const LOCKFILES = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm']];
const EXEC = { pnpm: ['pnpm', ['exec']], npm: ['npx', []], yarn: ['yarn', []] };
const INSTALL = {
  pnpm: ['pnpm', ['install', '--prefer-frozen-lockfile']],
  npm: ['npm', ['ci']],
  yarn: ['yarn', ['install', '--frozen-lockfile']],
};
const RUNNER_ARGS = {
  vitest: ['vitest', 'run', '--coverage', '--coverage.reporter=json-summary'],
  jest: ['jest', '--coverage', '--coverageReporters=json-summary'],
};

/** 문자열이면 셸로, 배열이면 [명령, ...인자]로. */
function toCommand(v) {
  if (typeof v === 'string' && v.trim()) return ['sh', ['-c', v]];
  if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) return [v[0], v.slice(1)];
  return null;
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
  if (cfg.runner) return { value: cfg.runner, from: '설정' };
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const has = RUNNERS.filter((r) => r in deps);
  if (has.length === 1) return { value: has[0], from: 'package.json 의존성' };
  const script = pkg?.scripts?.test ?? '';
  const inScript = RUNNERS.filter((r) => new RegExp(`\\b${r}\\b`).test(script));
  if (inScript.length === 1) return { value: inScript[0], from: 'package.json scripts.test' };
  return { value: fallback, from: '기본값' };
}

/**
 * 커버리지를 잴 명령과 기준 작업 트리를 채울 설치 명령을 고른다.
 * 순서: 설정 `coverage.command`/`installCommand`(그대로 씀) → 설정 `coverage.packageManager`·`runner`
 *       → package.json(`packageManager`·의존성·`scripts.test`) → lockfile → 스택 기본값.
 * @returns {{ testCommand, installCommand, packageManager, runner, describe: string }}
 */
export function resolveCoverageCommands(stackName, projectRoot, coverageConfig = {}) {
  const stack = resolveStack(stackName);
  const cfg = coverageConfig ?? {};
  if (cfg.runner != null && !RUNNERS.includes(cfg.runner)) {
    throw new Error(`coverage.runner '${cfg.runner}' 는 모르는 값이다 — ${RUNNERS.join(' | ')} 중 하나, 아니면 coverage.command 로 명령을 직접 적는다`);
  }
  if (cfg.packageManager != null && !PACKAGE_MANAGERS.includes(cfg.packageManager)) {
    throw new Error(`coverage.packageManager '${cfg.packageManager}' 는 모르는 값이다 — ${PACKAGE_MANAGERS.join(' | ')} 중 하나`);
  }
  const pkg = readPackageJson(projectRoot);
  const pm = pickPackageManager(projectRoot, pkg, cfg, stack.defaults.packageManager);
  const runner = pickRunner(pkg, cfg, stack.defaults.runner);

  let testCommand = toCommand(cfg.command);
  if (!testCommand) {
    // FE 기본 조합(pnpm + vitest)은 지금까지처럼 package.json 의 test 스크립트로 부른다.
    if (pm.value === 'pnpm' && runner.value === 'vitest' && pkg?.scripts?.test) {
      testCommand = ['pnpm', ['test', '--run', '--coverage', '--coverage.reporter=json-summary']];
    } else {
      const [cmd, pre] = EXEC[pm.value];
      testCommand = [cmd, [...pre, ...RUNNER_ARGS[runner.value]]];
    }
  }
  const installCommand = toCommand(cfg.installCommand) ?? INSTALL[pm.value];
  const describe = cfg.command
    ? `coverage.command(설정)`
    : `${pm.value}(${pm.from}) + ${runner.value}(${runner.from})`;
  return { testCommand, installCommand, packageManager: pm.value, runner: runner.value, describe };
}
