#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  loadPipelineConfig,
  currentBranch,
  decideStartReminder,
  decideSchemaNotice,
} from './lib/pipeline-state.mjs';
import { scan } from '../../scripts/migrate.mjs';

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
const notice = decideSchemaNotice({ config, prompt, scanFn: (root) => scan(root), repoRoot });
const contexts = [decision, notice].filter((d) => d.inject).map((d) => d.context);
if (contexts.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: contexts.join('\n'),
      },
    }),
  );
}
process.exit(0);
