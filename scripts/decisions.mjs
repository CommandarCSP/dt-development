#!/usr/bin/env node
/**
 * 결정 기록 — 팀 정책 TP(플러그인 `docs/policies/`) · 프로젝트 결정 PD(각 프로젝트 `docs/decisions/`).
 *
 * 문서 양식은 `templates/decision.md.tmpl`, 언제 무엇을 남기는지는 `docs/orchestration-policy.md` 원칙 9 와
 * `docs/refs/askquestion-principle.md` "답과 가정을 남기는 곳" 이 정한다.
 *
 * 디스크를 읽는 함수(load*)와 순수 함수(parse·validate·isExpired)를 나눴다. 테스트는 순수 함수를 문자열로 검사한다.
 *
 * CLI
 *   node scripts/decisions.mjs list  <projectRoot> [--all] [--json]   채택된 PD + TP (--all: 모든 상태)
 *   node scripts/decisions.mjs next  <projectRoot> [--prefix PD|TP]   다음 번호
 *   node scripts/decisions.mjs check <dir>                            양식 검사, 문제가 있으면 exit 1
 *   node scripts/decisions.mjs show  <projectRoot> <id>               한 건의 메타·파일 경로
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['proposed', 'accepted', 'superseded', 'deprecated'];
export const REQUIRED_META = ['id', 'title', 'status', 'scope', 'date'];
export const REQUIRED_SECTIONS = ['맥락', '결정', '이유', '버린 대안', '출처'];
export const PROJECT_DIR = 'docs/decisions';
export const POLICY_DIR = 'docs/policies';
const ID_RE = /^(PD|TP)-(\d{3,})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 머리말(`---` 블록, 한 줄 `key: value`)과 `## 절` 제목을 읽는다. */
export function parseDecision(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  const body = m ? text.slice(m[0].length) : text;
  const sections = new Set([...body.matchAll(/^## (.+?)\s*$/gm)].map((s) => s[1]));
  return { meta, sections, hasFrontmatter: Boolean(m) };
}

/** 양식 문제 목록. 비면 통과. `fileName` 을 주면 번호·접두어가 파일명과 맞는지도 본다. */
export function validateDecision(doc, { fileName } = {}) {
  const p = [];
  if (!doc.hasFrontmatter) return ['머리말(--- 블록)이 없다'];
  for (const k of REQUIRED_META) if (!doc.meta[k]) p.push(`머리말 ${k} 가 없다`);
  if (doc.meta.id && !ID_RE.test(doc.meta.id)) p.push(`id "${doc.meta.id}" 는 PD-NNN 또는 TP-NNN 이어야 한다`);
  if (doc.meta.status && !STATUSES.includes(doc.meta.status)) p.push(`status "${doc.meta.status}" 는 ${STATUSES.join('|')} 중 하나여야 한다`);
  for (const k of ['date', 'expires']) if (doc.meta[k] && !DATE_RE.test(doc.meta[k])) p.push(`${k} "${doc.meta[k]}" 는 YYYY-MM-DD 여야 한다`);
  if (doc.meta.status === 'superseded' && !doc.meta.supersededBy) p.push('superseded 면 supersededBy 가 있어야 한다');
  for (const s of REQUIRED_SECTIONS) if (!doc.sections.has(s)) p.push(`"## ${s}" 절이 없다`);
  if (fileName && doc.meta.id && !basename(fileName).startsWith(`${doc.meta.id}-`)) p.push(`파일명 ${basename(fileName)} 이 id ${doc.meta.id} 로 시작하지 않는다`);
  return p;
}

/** 만료일이 오늘보다 앞이면 true. `today` 는 YYYY-MM-DD. */
export function isExpired(meta, today = new Date().toISOString().slice(0, 10)) {
  return Boolean(meta.expires) && DATE_RE.test(meta.expires) && meta.expires < today;
}

/** 지금 따라야 하는 결정인가 — accepted 이고 대체되지 않음(만료돼도 유효하되 경고 대상). */
export const isActive = (meta) => meta.status === 'accepted' && !meta.supersededBy;

/** 한 폴더의 결정 문서들. 폴더가 없으면 []. 던지지 않는다. */
export function loadDecisionDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => ID_RE.test(f.split('-').slice(0, 2).join('-')) && f.endsWith('.md'))
    .sort()
    .map((f) => {
      const file = join(dir, f);
      const doc = parseDecision(readFileSync(file, 'utf8'));
      return { file, meta: doc.meta, problems: validateDecision(doc, { fileName: f }) };
    });
}

/** 프로젝트 PD + 플러그인 TP. */
export function loadDecisions(projectRoot, pluginRoot = PLUGIN_ROOT) {
  return [...loadDecisionDir(join(projectRoot, PROJECT_DIR)), ...loadDecisionDir(join(pluginRoot, POLICY_DIR))];
}

export function findDecision(projectRoot, id, pluginRoot = PLUGIN_ROOT) {
  return loadDecisions(projectRoot, pluginRoot).find((d) => d.meta.id === id) ?? null;
}

/** 다음 번호(3자리). 기존 최대 + 1. */
export function nextId(dir, prefix = 'PD') {
  const nums = loadDecisionDir(dir).map((d) => d.meta.id).filter((id) => id?.startsWith(`${prefix}-`)).map((id) => Number(id.split('-')[1]));
  return `${prefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
}

/**
 * override 근거 확인 — 리뷰 엔진이 쓴다. decisionRef 가 없거나, 못 찾거나, 지금 유효하지 않으면 문제.
 * @returns {{ ok: boolean, level: 'error'|'warn'|null, message: string|null }}
 */
export function checkDecisionRef(projectRoot, ref, { pluginRoot = PLUGIN_ROOT, today } = {}) {
  if (!ref) return { ok: false, level: 'error', message: '근거 결정(decisionRef)이 없다 — /dt-decision 으로 PD 를 남기고 decisionRef 를 적는다' };
  const d = findDecision(projectRoot, ref, pluginRoot);
  if (!d) return { ok: false, level: 'error', message: `근거 결정 ${ref} 를 ${PROJECT_DIR}/ 에서 찾지 못했다` };
  if (!isActive(d.meta)) return { ok: false, level: 'error', message: `근거 결정 ${ref} 가 지금 유효하지 않다(status: ${d.meta.status}${d.meta.supersededBy ? `, 대체: ${d.meta.supersededBy}` : ''})` };
  if (isExpired(d.meta, today)) return { ok: true, level: 'warn', message: `근거 결정 ${ref} 가 만료됐다(${d.meta.expires}) — 다시 검토한다` };
  return { ok: true, level: null, message: null };
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const pos = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--prefix');
  const prefixIdx = rest.indexOf('--prefix');
  const prefix = prefixIdx >= 0 ? rest[prefixIdx + 1] : 'PD';
  const root = resolve(pos[0] ?? process.cwd());
  if (cmd === 'list') {
    const today = new Date().toISOString().slice(0, 10);
    const all = loadDecisions(root).map((d) => ({ ...d.meta, file: d.file, expired: isExpired(d.meta, today), problems: d.problems }));
    const out = flags.has('--all') ? all : all.filter(isActive);
    if (flags.has('--json')) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    else for (const d of out) process.stdout.write(`${d.id}\t${d.status}${d.expired ? '(만료)' : ''}\t${d.title}\t${d.scope}\n`);
    return 0;
  }
  if (cmd === 'next') {
    const dir = prefix === 'TP' ? join(root, POLICY_DIR) : join(root, PROJECT_DIR);
    process.stdout.write(nextId(dir, prefix) + '\n');
    return 0;
  }
  if (cmd === 'check') {
    const bad = loadDecisionDir(root).filter((d) => d.problems.length);
    for (const d of bad) process.stdout.write(`${d.file}\n${d.problems.map((x) => `  - ${x}`).join('\n')}\n`);
    process.stdout.write(bad.length ? `문제 ${bad.length}건\n` : '결정 문서 양식 문제 0건\n');
    return bad.length ? 1 : 0;
  }
  if (cmd === 'show') {
    const d = findDecision(root, pos[1]);
    process.stdout.write(JSON.stringify(d, null, 2) + '\n');
    return d ? 0 : 1;
  }
  process.stderr.write('usage: decisions.mjs list|next|check|show …\n');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(cli(process.argv.slice(2)));
}
