import { STACK_RULE_LOCATIONS } from './rule-loader.mjs';

// Per-stack knobs for the (stack-agnostic) review engine.
// - ruleLocations: where this stack's rule .md files live (relative to pluginRoot)
// - configFileName: the project config that holds coverage settings + enabledSkills
// - testCommand:    [cmd, argsArray] used to produce coverage/coverage-summary.json
// - installCommand: [cmd, argsArray] used to hydrate a baseline worktree before measuring
//
// Both vitest (FE) and jest (BE) emit coverage/coverage-summary.json with the same
// shape, so parseCoverageSummary works for both.
export const STACKS = {
  frontend: {
    ruleLocations: STACK_RULE_LOCATIONS.frontend,
    configFileName: '.dt-frontend.json',
    testCommand: ['pnpm', ['test', '--run', '--coverage', '--coverage.reporter=json-summary']],
    installCommand: ['pnpm', ['install', '--prefer-frozen-lockfile']],
  },
  backend: {
    ruleLocations: STACK_RULE_LOCATIONS.backend,
    configFileName: '.dt-backend.json',
    testCommand: ['npx', ['jest', '--coverage', '--coverageReporters=json-summary']],
    installCommand: ['npm', ['ci']],
  },
};

export function resolveStack(name) {
  const stack = STACKS[name];
  if (!stack) {
    throw new Error(`unknown stack '${name}' (expected one of: ${Object.keys(STACKS).join(', ')})`);
  }
  return stack;
}
