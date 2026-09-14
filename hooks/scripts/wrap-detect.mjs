#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import {
  loadPipelineConfig,
  loadLastSyncSha,
  unsyncedCommitCount,
  headSha,
  readSnooze,
  writeSnooze,
  decideWrapReminder,
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

const config = loadPipelineConfig(repoRoot);
const lastSync = loadLastSyncSha(repoRoot);
const unsynced = unsyncedCommitCount(repoRoot, lastSync);
const head = headSha(repoRoot);
const snooze = readSnooze(repoRoot);

const decision = decideWrapReminder({ config, unsynced, head, snooze });
if (decision.block) {
  // 출력 후에 스누즈를 기록한다 — 중간에 죽어도 넛지가 영구 소실되지 않도록.
  process.stdout.write(JSON.stringify({ decision: 'block', reason: decision.reason }));
  if (head) writeSnooze(repoRoot, head);
}
process.exit(0);
