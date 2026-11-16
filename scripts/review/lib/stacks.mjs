import { STACK_RULE_LOCATIONS } from './rule-loader.mjs';
import { resolveStackCommands } from '../../stackCommands.mjs';

// Per-stack knobs for the (stack-agnostic) review engine.
// - ruleLocations:  where this stack's rule .md files live (relative to pluginRoot)
// - configFileName: the project config that holds coverage settings + enabledSkills + layout
//
// 커버리지·설치 명령은 scripts/stackCommands.mjs 가 프로젝트를 보고 고른다(GEN-08·GEN-04).
// vitest·jest 둘 다 coverage/coverage-summary.json 을 같은 모양으로 내므로 parseCoverageSummary 하나로 읽는다.
export const STACKS = {
  frontend: { ruleLocations: STACK_RULE_LOCATIONS.frontend, configFileName: '.dt-frontend.json' },
  backend: { ruleLocations: STACK_RULE_LOCATIONS.backend, configFileName: '.dt-backend.json' },
};

export function resolveStack(name) {
  const stack = STACKS[name];
  if (!stack) {
    throw new Error(`unknown stack '${name}' (expected one of: ${Object.keys(STACKS).join(', ')})`);
  }
  return stack;
}

/** 커버리지를 잴 명령과 기준 작업 트리를 채울 설치 명령. @returns {{ testCommand, installCommand, describe }} */
export function resolveCoverageCommands(stackName, projectRoot, config) {
  resolveStack(stackName);
  const r = resolveStackCommands(stackName, projectRoot, config);
  const describe = r.from.coverage === '설정' ? 'commands.coverage(설정)' : r.describe;
  return { testCommand: r.commands.coverage, installCommand: r.commands.install, packageManager: r.packageManager, runner: r.testRunner, describe };
}
