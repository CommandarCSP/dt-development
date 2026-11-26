#!/usr/bin/env node
/**
 * 작업 기록(dt-worklog-sync) 설정 — 프리셋 → 팀 `.dt-worklog.json` → 개인 `.dt-worklog.local.json` 순으로 합친다(GEN-09).
 *
 * 프리셋(규칙 문장은 skills/dt-worklog-sync/references/presets/<이름>.md, 정책은 docs/policies/TP-002):
 *   basic          — 기본. Story·Task·Bug 가 기록 단위, Sub-task 선택, 한 주 안, 마무리 댓글에 산출물이나 결정 사항.
 *   org-guideline  — 사내 가이드라인 v1.0 재현. Sub-task 강제, 1~3일, 수행 Epic, 날짜·산출물 필드·릴리즈 필수.
 * `preset` 이 없고 옛 키(issueTypeNames·transitionMap·outputFieldName·outputFieldId)가 있으면 org-guideline 으로 본다
 * — 그 키는 옛 위저드가 회사 예시를 복사해 만든 것이라, 이미 쓰던 팀의 동작을 바꾸지 않는다. 경고를 남긴다.
 *
 * 트래커는 공통 설정 `.dt.json` 의 `tracker`(scripts/lib/config.mjs). jira 만 연동한다.
 *
 * CLI
 *   node scripts/worklogConfig.mjs [--project <dir>] [--json]
 *   node scripts/worklogConfig.mjs check-close <마무리 댓글 파일> [--project <dir>]   → 종료 0 통과 · 1 막음(빠진 항목)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveGitWeb, originRemote, GIT_HOSTS } from './gitWebUrl.mjs';
import { H } from './lib/headings.mjs';

export const TEAM_FILE = '.dt-worklog.json';
export const LOCAL_FILE = '.dt-worklog.local.json';
export const DEFAULT_PRESET = 'basic';

/** 이슈 유형 이름 후보 — 프로젝트의 이슈 유형 중 앞에 있는 것부터 맞춘다(인스턴스 언어마다 이름이 다르다). */
const TYPE_NAMES = {
  epic: ['Epic', '에픽'],
  story: ['Story', '스토리'],
  task: ['Task', '작업'],
  bug: ['Bug', '버그'],
  subtask: ['Subtask', 'Sub-task', '하위 작업'],
};

export const PRESETS = {
  basic: {
    templates: 'basic',
    issueTypes: TYPE_NAMES,
    unit: ['story', 'task', 'bug'],           // 기록의 기본 단위
    subtask: 'optional',                      // optional = 한 이슈를 여러 사람이 나눌 때만 · required = 늘 Sub-task 로
    transitions: { default: { start: ['In Progress', '진행 중'], done: ['Done', '완료'] } },
    epic: { required: false, default: null },
    size: { maxDays: 5, split: null },        // 담당자 한 명이 한 주 안
    requiredDates: [],
    outputField: null,                        // 산출물은 댓글 본문에. 커스텀 필드는 쓰지 않는다
    releases: 'optional',                     // 프로젝트에 릴리즈가 있을 때만 고른다
    close: { comment: true, need: 'outputOrDecision' },
    bugComments: {},
    gitHost: null,                            // 호스트 이름으로 감지, 모르면 묻는다
  },
  'org-guideline': {
    templates: 'org-guideline',
    issueTypes: { epic: ['에픽', 'Epic'], story: ['스토리', 'Story'], task: ['작업', 'Task'], bug: ['버그', 'Bug'], subtask: ['하위 작업', 'Sub-task', 'Subtask'] },
    unit: ['subtask'],
    subtask: 'required',
    transitions: {
      subtask: { start: ['In Progress'], done: ['Done'] },
      story: { devStart: ['개발 진행'], devDone: ['개발 완료'] },
      bug: { deployed: ['Deployed'], verified: ['Verified'] },
    },
    epic: { required: true, default: '수행' },
    size: { minDays: 1, maxDays: 3, split: '(n)' },
    requiredDates: ['story', 'task'],
    outputField: { name: '산출물', id: null },
    releases: 'required',
    close: { comment: true, need: 'output' },
    bugComments: { deployed: '해결 방법', verified: '검증 방법' },
    gitHost: 'gitlab',
  },
};

const RULE_KEYS = Object.keys(PRESETS.basic);
const PLAIN_KEYS = ['preset', 'site', 'cloudId', 'defaultProjectKey', 'issueKeyPattern', 'gitWebBaseUrl', '$schemaVersion'];
const LOCAL_ONLY = ['lastSyncSha'];
const LEGACY = ['issueTypeNames', 'transitionMap', 'outputFieldName', 'outputFieldId'];
const RELEASES = ['required', 'optional', 'off'];
const NEEDS = ['output', 'decision', 'outputOrDecision'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));
const arr = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const placeholder = (v) => typeof v === 'string' && /^(REPLACE|OMIT)/.test(v);

function readJson(p, warnings) {
  if (!existsSync(p)) return null;
  try {
    const v = JSON.parse(readFileSync(p, 'utf8'));
    return isObj(v) ? v : (warnings.push(`${p}: 최상위가 객체가 아니라 무시했다`), null);
  } catch (e) { warnings.push(`${p}: JSON 을 읽지 못해 무시했다 (${e.message})`); return null; }
}

/** 옛 키 → 새 키. 옛 키는 한 minor 동안 함께 받는다(호환 정책 §4). */
function fromLegacy(c, warnings) {
  const out = {};
  const used = LEGACY.filter((k) => k in c);
  if (!used.length) return out;
  warnings.push(`옛 설정 키(${used.join('·')})를 새 키로 읽었다 — issueTypes·transitions·outputField 로 바꿔 적는다(skills/dt-worklog-sync/references/presets/README.md)`);
  if (isObj(c.issueTypeNames)) out.issueTypes = Object.fromEntries(Object.entries(c.issueTypeNames).map(([k, v]) => [k, arr(v)]));
  if (isObj(c.transitionMap)) out.transitions = Object.fromEntries(Object.entries(c.transitionMap).map(([t, m]) => [t, isObj(m) ? Object.fromEntries(Object.entries(m).map(([a, n]) => [a, arr(n)])) : m]));
  const name = placeholder(c.outputFieldName) ? null : c.outputFieldName;
  const id = placeholder(c.outputFieldId) ? null : c.outputFieldId;
  if (name || id) out.outputField = { name: name ?? '산출물', id: id ?? null };
  return out;
}

function mergeRules(base, over) {
  const out = clone(base);
  for (const [k, v] of Object.entries(over)) {
    if (k === 'issueTypes' || k === 'transitions') out[k] = { ...out[k], ...clone(v) };
    else out[k] = clone(v);
  }
  return out;
}

/** 값 검사 — 틀리면 던진다(작업 기록은 사람에게 보이는 쓰기라, 틀린 설정으로 조용히 진행하지 않는다). */
function check(r) {
  const bad = [];
  if (!Array.isArray(r.unit) || !r.unit.length || r.unit.some((u) => !(u in TYPE_NAMES))) bad.push(`unit 은 ${Object.keys(TYPE_NAMES).join('·')} 중 하나 이상의 배열`);
  if (!['optional', 'required'].includes(r.subtask)) bad.push('subtask 는 optional | required');
  if (!RELEASES.includes(r.releases)) bad.push(`releases 는 ${RELEASES.join(' | ')}`);
  if (!isObj(r.close) || !NEEDS.includes(r.close.need)) bad.push(`close.need 는 ${NEEDS.join(' | ')}`);
  if (r.gitHost != null && !GIT_HOSTS.includes(r.gitHost)) bad.push(`gitHost 는 ${GIT_HOSTS.join(' | ')} 또는 null`);
  if (r.outputField != null && !(isObj(r.outputField) && (r.outputField.name || r.outputField.id))) bad.push('outputField 는 null 또는 { name, id }');
  if (!Array.isArray(r.requiredDates)) bad.push('requiredDates 는 배열');
  if (bad.length) throw new Error(`작업 기록 설정이 틀렸다 — ${bad.join('; ')}`);
}

/**
 * @returns {{ preset, presetFrom, rules, project: object, local: object, tracker, git, warnings: string[], sources: string[] }}
 */
export function resolveWorklogConfig(projectRoot, { team, local, dt, remote } = {}) {
  const warnings = []; const sources = [];
  const t = team !== undefined ? team : readJson(join(projectRoot, TEAM_FILE), warnings);
  const l = local !== undefined ? local : readJson(join(projectRoot, LOCAL_FILE), warnings);
  if (t) sources.push(TEAM_FILE);
  if (l) sources.push(LOCAL_FILE);
  const c = { ...(t ?? {}) };

  let preset; let presetFrom;
  if (c.preset != null) {
    if (!(c.preset in PRESETS)) throw new Error(`preset '${c.preset}' 는 없다 — ${Object.keys(PRESETS).join(' | ')}`);
    preset = c.preset; presetFrom = '설정';
  } else if (LEGACY.some((k) => k in c)) {
    preset = 'org-guideline'; presetFrom = '옛 설정 키';
    warnings.push(`${TEAM_FILE} 에 preset 이 없고 옛 키가 있어 org-guideline(사내 가이드라인)으로 봤다 — 계속 쓰려면 "preset": "org-guideline", 새 기본 규칙(TP-002)으로 바꾸려면 "preset": "basic" 을 적는다`);
  } else {
    preset = DEFAULT_PRESET; presetFrom = '기본값';
  }

  const over = { ...fromLegacy(c, warnings) };
  for (const src of [c, l ?? {}]) {
    for (const [k, v] of Object.entries(src)) {
      if (RULE_KEYS.includes(k)) over[k] = v;
      else if (!PLAIN_KEYS.includes(k) && !LEGACY.includes(k) && !LOCAL_ONLY.includes(k)) warnings.push(`알 수 없는 키 "${k}" — 무시했다`);
    }
  }
  const rules = mergeRules(PRESETS[preset], over);
  check(rules);

  const project = Object.fromEntries(['site', 'cloudId', 'defaultProjectKey', 'issueKeyPattern', 'gitWebBaseUrl']
    .map((k) => [k, placeholder(l?.[k] ?? c[k]) ? null : (l?.[k] ?? c[k] ?? null)]));
  const dtConfig = dt !== undefined ? { config: { tracker: dt?.tracker ?? 'jira' }, warnings: [] } : loadConfig(projectRoot);
  warnings.push(...(dtConfig.warnings ?? []).filter((w) => w.includes('tracker')));
  const tracker = dtConfig.config.tracker;
  if (tracker === 'github' || tracker === 'linear') warnings.push(`tracker "${tracker}" 는 아직 연동하지 않는다 — none 처럼 정리한 작업을 마크다운으로만 보인다(docs/refs/tracker-adapter.md)`);

  const git = resolveGitWeb({ remote: remote !== undefined ? remote : originRemote(projectRoot), gitHost: rules.gitHost, gitWebBaseUrl: project.gitWebBaseUrl });
  return { preset, presetFrom, rules, project, local: { lastSyncSha: l?.lastSyncSha ?? null }, tracker, writes: tracker === 'jira', git, warnings, sources };
}

// 한 줄 안에서만 읽는다([ \\t]) — 값이 빈 줄이면 다음 줄을 값으로 잡지 않게.
const FIELD = (label) => new RegExp(`^[ \\t]*(?:[-*][ \\t]*)?(?:\\*\\*)?${label}(?:\\*\\*)?[ \\t]*[:：][ \\t]*(.*)$`, 'm');
const filled = (v) => {
  const s = String(v ?? '').trim().replace(/←.*$/, '').trim();
  return Boolean(s) && !/^\{.*\}$/.test(s) && !/^(없음|n\/a|-|—)$/i.test(s);
};

/**
 * 마무리 댓글 검사(TP-002 §4) — Done 전이 전에 스킬이 돌린다.
 * @returns {{ ok: boolean, missing: string[], has: { result, output, decision } }}
 */
export function checkCloseComment(md, rules) {
  const val = (label) => (String(md ?? '').match(FIELD(label)) ?? [])[1];
  const L = H.closeComment; // scripts/lib/headings.mjs
  const has = { result: filled(val(L.result)), output: filled(val(L.output)), decision: filled(val(L.decision)) };
  const missing = [];
  const need = rules?.close?.need ?? 'outputOrDecision';
  if (rules?.templates !== 'org-guideline' && !has.result) missing.push(L.result);
  if (need === 'output' && !has.output) missing.push(L.output);
  if (need === 'decision' && !has.decision) missing.push(L.decision);
  if (need === 'outputOrDecision' && !has.output && !has.decision) missing.push(`${L.output} 또는 ${L.decision}`);
  return { ok: missing.length === 0, missing, has };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--project');
  const projectRoot = resolve(i >= 0 ? args[i + 1] : process.cwd());
  if (i >= 0) args.splice(i, 2);
  try {
    const r = resolveWorklogConfig(projectRoot);
    if (args[0] === 'check-close') {
      if (!args[1]) throw new Error('usage: worklogConfig.mjs check-close <파일>');
      const c = checkCloseComment(readFileSync(args[1], 'utf8'), r.rules);
      if (c.ok) { process.stdout.write(`마무리 댓글 통과 (${r.preset})\n`); process.exit(0); }
      process.stdout.write(`마무리 댓글에 빠진 것: ${c.missing.join(', ')} — Done 으로 넘기지 않는다(TP-002 §4)\n`);
      process.exit(1);
    }
    if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
    else {
      process.stdout.write(`프리셋 ${r.preset} [${r.presetFrom}] · 트래커 ${r.tracker}${r.writes ? '' : '(쓰지 않음)'} · 기록 단위 ${r.rules.unit.join('·')} · Sub-task ${r.rules.subtask}\n`);
      process.stdout.write(`git ${r.git.kind ?? '모름'} ${r.git.webBase ?? ''} [${r.git.from}]\n`);
      for (const w of r.warnings) process.stdout.write(`! ${w}\n`);
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
