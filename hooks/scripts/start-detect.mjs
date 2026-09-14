#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  loadPipelineConfig,
  currentBranch,
  decideStartReminder,
} from './lib/pipeline-state.mjs';

function readEvent() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const event = readEvent();
const repoRoot = event.cwd || process.cwd();
const prompt = event.prompt || '';

const config = loadPipelineConfig(repoRoot);
const branch = currentBranch(repoRoot);

const decision = decideStartReminder({ config, branch, prompt });
if (decision.inject) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: decision.context,
      },
    }),
  );
}
process.exit(0);
