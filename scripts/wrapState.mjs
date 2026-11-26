#!/usr/bin/env node
/**
 * 마무리 루틴 상태(GEN-11) — 실제로 돌 단계 목록과 Stop 훅의 기준점.
 *
 * - 단계: `.dt.json` 의 `wrap.steps`(기본 commit → wiki → tracker)에서, 어댑터가 꺼진 단계를 뺀다.
 *   wiki 는 `wiki` 가 confluence·markdown 일 때만, tracker 는 `tracker` 가 jira 일 때만 돈다.
 *   루틴(skills/dt-wrap)과 훅(hooks/scripts/lib/pipeline-state.mjs)이 같은 계산을 쓴다.
 * - 기준점: `/dt-wrap` 을 마치면 `.dt-pipeline.local.json` 의 `lastWrapSha` 에 HEAD 를 남긴다(단계를 건너뛰어도).
 *   훅은 이 값과 옛 `.dt-worklog.local.json` 의 `lastSyncSha` 중 더 최근 것부터 커밋을 센다.
 *
 * CLI
 *   node scripts/wrapState.mjs steps [--project <dir>]           → { steps, skipped, labels, warnings } JSON
 *   node scripts/wrapState.mjs mark  [--project <dir>] [--sha X]  → lastWrapSha 기록(기본 HEAD)
 *   node scripts/wrapState.mjs state [--project <dir>]           → { lastWrapSha, lastSyncSha } JSON
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';

export const WRAP_STATE_FILE = '.dt-pipeline.local.json';
export const WRAP_STEPS = ['commit', 'wiki', 'tracker'];

const WIKI_LABEL = { confluence: 'Confluence 문서 판단', markdown: '위키 문서 판단(markdown)' };
const TRACKER_LABEL = { jira: 'Jira 동기화' };

/**
 * @param {{ wrap?: { steps?: string[] }, wiki?: string, tracker?: string }} config  loadConfig().config
 * @returns {{ steps: {name: string, label: string, skill: string|null}[], skipped: {name: string, reason: string}[], labels: string[] }}
 */
export function resolveWrapSteps(config) {
  const order = config?.wrap?.steps ?? WRAP_STEPS;
  const wiki = config?.wiki ?? 'confluence';
  const tracker = config?.tracker ?? 'jira';
  const steps = [];
  const skipped = [];
  for (const name of order) {
    if (name === 'commit') steps.push({ name, label: '커밋 정리', skill: null });
    else if (name === 'wiki') {
      if (WIKI_LABEL[wiki]) steps.push({ name, label: WIKI_LABEL[wiki], skill: 'dt-confluence-doc' });
      else skipped.push({ name, reason: `wiki: ${wiki}` });
    } else if (name === 'tracker') {
      if (TRACKER_LABEL[tracker]) steps.push({ name, label: TRACKER_LABEL[tracker], skill: 'dt-worklog-sync' });
      else skipped.push({ name, reason: `tracker: ${tracker}` });
    }
  }
  return { steps, skipped, labels: steps.map((s) => s.label) };
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const sha = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** 마무리 기준점 두 개. 없으면 null. 던지지 않는다(훅에서 쓴다). */
export function loadWrapBaselines(projectRoot) {
  return {
    lastWrapSha: sha(readJson(join(projectRoot, WRAP_STATE_FILE))?.lastWrapSha),
    lastSyncSha: sha(readJson(join(projectRoot, '.dt-worklog.local.json'))?.lastSyncSha),
  };
}

/** `/dt-wrap` 을 마쳤을 때 부른다. 다른 키는 그대로 둔다. */
export function markWrap(projectRoot, headSha, now = new Date()) {
  const path = join(projectRoot, WRAP_STATE_FILE);
  const prev = (existsSync(path) && readJson(path)) || {};
  const next = { ...prev, lastWrapSha: headSha, lastWrapAt: now.toISOString() };
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  return next;
}

function git(root, args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const root = resolve(opt('--project') ?? process.cwd());
  if (cmd === 'steps') {
    const { config, warnings } = loadConfig(root);
    process.stdout.write(JSON.stringify({ ...resolveWrapSteps(config), warnings }, null, 2) + '\n');
  } else if (cmd === 'state') {
    process.stdout.write(JSON.stringify(loadWrapBaselines(root), null, 2) + '\n');
  } else if (cmd === 'mark') {
    let head = opt('--sha');
    if (!head) {
      const r = git(root, ['rev-parse', 'HEAD']);
      if (r.status !== 0) { process.stderr.write('HEAD 를 읽지 못했다 — git 저장소인지 확인\n'); process.exit(2); }
      head = r.stdout.trim();
    }
    process.stdout.write(JSON.stringify(markWrap(root, head)) + '\n');
  } else {
    process.stderr.write('사용법: wrapState.mjs steps|state|mark [--project <dir>] [--sha <sha>]\n');
    process.exit(2);
  }
}
