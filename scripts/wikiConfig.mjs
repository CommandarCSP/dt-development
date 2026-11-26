#!/usr/bin/env node
/**
 * 위키 문서(dt-confluence-doc) 설정·규칙 — 팀 정책 TP-003(docs/policies/TP-003-wiki-docs.md)을 기계로 낸다(GEN-10).
 *
 * - 문서 종류 7개와 구역·제목 규칙·라벨·검토일
 * - 설정 합치기: 기본값 → 팀 `.dt-confluence.json` → 개인 `.dt-confluence.local.json`. 위키 종류는 `.dt.json` 의 `wiki`
 * - 공통 머리(상태·담당자·검토일·관련 이슈·관련 결정·요약)를 HTML(Confluence)·마크다운으로 만든다
 * 옛 종류 이름(worklog → report, techdoc → design|guide 를 묻기)과 옛 키(parentPageId, labelsByType 의 옛 이름)는
 * 한 minor 동안 받고 경고한다(호환 정책 §4).
 *
 * CLI
 *   node scripts/wikiConfig.mjs [--project <dir>] [--json]
 *   node scripts/wikiConfig.mjs title  --type <종류> --topic "<주제>" [--date YYYY-MM-DD]
 *   node scripts/wikiConfig.mjs header --type <종류> --status <상태> --owner "<이름>" [--date …] [--issues A-1,A-2] [--decisions PD-1] --summary "<요약>" [--format html|markdown]
 *   node scripts/wikiConfig.mjs path   --type <종류> --title "<제목>"          → markdown 위키의 파일 경로
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';

export const TEAM_FILE = '.dt-confluence.json';
export const LOCAL_FILE = '.dt-confluence.local.json';

/** 구역(최상위 페이지). 키는 markdown 위키의 폴더 이름이다. */
export const SECTIONS = {
  design: '설계',
  guide: '운영 가이드',
  meeting: '회의록',
  report: '보고·회고',
  release: '릴리즈 노트',
  postmortem: '장애 회고',
};

/** 문서 종류 — TP-003 §1. `title` 의 {date}·{topic} 을 채운다. review = 검토일을 두는가. */
export const TYPES = {
  meeting: { name: '회의록', section: 'meeting', title: '{date} {topic}', review: false, byYear: true },
  report: { name: '작업 보고', section: 'report', title: '{date} {topic} 작업 보고', review: false },
  design: { name: '설계 문서', section: 'design', title: '[설계] {topic}', review: true },
  guide: { name: '운영 가이드', section: 'guide', title: '[가이드] {topic}', review: true },
  retro: { name: '회고', section: 'report', title: '{date} {topic} 회고', review: false },
  release: { name: '릴리즈 노트', section: 'release', title: '{topic} 릴리즈 노트', review: false },
  postmortem: { name: '장애 회고', section: 'postmortem', title: '{date} 장애: {topic}', review: false },
};

export const STATUSES = { '초안': 'neutral', '검토 중': 'yellow', '확정': 'green', '폐기': 'red' };
const OLD_TYPES = { worklog: 'report', techdoc: null };
const KNOWN = ['site', 'cloudId', 'defaultSpaceKey', 'defaultSpaceId', 'sections', 'labelsByType', 'reviewMonths', 'parentPageId', '$schemaVersion'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const placeholder = (v) => typeof v === 'string' && /^REPLACE/.test(v);

/** 종류 이름 → { type, warning?, ask? }. techdoc 은 둘 중 무엇인지 사람에게 묻는다(ask). */
export function normalizeType(t) {
  if (t in TYPES) return { type: t };
  if (t in OLD_TYPES) {
    if (OLD_TYPES[t]) return { type: OLD_TYPES[t], warning: `종류 '${t}' 는 '${OLD_TYPES[t]}' 로 바뀌었다(TP-003) — 다음부터 --type ${OLD_TYPES[t]}` };
    return { type: null, ask: ['design', 'guide'], warning: `종류 '${t}' 는 설계 문서(design)와 운영 가이드(guide)로 나뉘었다 — 어느 쪽인지 묻는다(TP-003)` };
  }
  throw new Error(`문서 종류 '${t}' 는 없다 — ${Object.keys(TYPES).join(' | ')}`);
}

function readJson(p, warnings) {
  if (!existsSync(p)) return null;
  try { const v = JSON.parse(readFileSync(p, 'utf8')); return isObj(v) ? v : null; } catch (e) { warnings.push(`${p}: JSON 을 읽지 못해 무시했다 (${e.message})`); return null; }
}

/**
 * @returns {{ wiki, writes, project, sections: Record<string, string|null>, labels: Record<string,string[]>, reviewMonths, warnings, sources }}
 */
export function resolveWikiConfig(projectRoot, { team, local, dt } = {}) {
  const warnings = []; const sources = [];
  const t = team !== undefined ? team : readJson(join(projectRoot, TEAM_FILE), warnings);
  const l = local !== undefined ? local : readJson(join(projectRoot, LOCAL_FILE), warnings);
  if (t) sources.push(TEAM_FILE);
  if (l) sources.push(LOCAL_FILE);
  const c = { ...(t ?? {}), ...(l ?? {}) };
  for (const k of Object.keys(c)) if (!KNOWN.includes(k)) warnings.push(`알 수 없는 키 "${k}" — 무시했다`);

  const sections = Object.fromEntries(Object.keys(SECTIONS).map((s) => [s, null]));
  if (isObj(c.sections)) {
    for (const [s, id] of Object.entries(c.sections)) {
      if (!(s in SECTIONS)) { warnings.push(`sections.${s} 는 없는 구역이다 — ${Object.keys(SECTIONS).join(' | ')}`); continue; }
      sections[s] = placeholder(id) ? null : (id == null ? null : String(id));
    }
  }
  if (c.parentPageId != null && !placeholder(c.parentPageId)) {
    warnings.push('옛 키 parentPageId 를 구역 페이지가 없는 종류의 부모로 썼다 — 구역별 sections.<구역> 으로 바꿔 적는다(TP-003 §3)');
    for (const s of Object.keys(sections)) sections[s] ??= String(c.parentPageId);
  }

  const labels = Object.fromEntries(Object.keys(TYPES).map((ty) => [ty, [`doc-${ty}`]]));
  if (isObj(c.labelsByType)) {
    for (const [k, v] of Object.entries(c.labelsByType)) {
      const n = k in TYPES ? { type: k } : k in OLD_TYPES ? normalizeType(k) : null;
      if (!n) { warnings.push(`labelsByType.${k} 는 없는 종류다`); continue; }
      const targets = n.type ? [n.type] : n.ask;
      if (!(k in TYPES)) warnings.push(`labelsByType.${k} 는 옛 종류 이름이다 — ${targets.join('·')} 로 읽었다`);
      for (const ty of targets) labels[ty] = [...new Set([`doc-${ty}`, ...(Array.isArray(v) ? v : [])])];
    }
  }

  const reviewMonths = c.reviewMonths ?? 6;
  if (!Number.isInteger(reviewMonths) || reviewMonths < 1) throw new Error('reviewMonths 는 1 이상의 정수');

  const dtc = dt !== undefined ? { config: { wiki: dt?.wiki ?? 'confluence' } } : loadConfig(projectRoot);
  const wiki = dtc.config.wiki;
  if (wiki === 'notion') warnings.push('wiki "notion" 은 아직 연동하지 않는다 — none 처럼 본문을 대화에 마크다운으로만 보인다(docs/refs/wiki-adapter.md)');
  const project = Object.fromEntries(['site', 'cloudId', 'defaultSpaceKey', 'defaultSpaceId'].map((k) => [k, placeholder(c[k]) ? null : (c[k] ?? null)]));
  return { wiki, writes: wiki === 'confluence' || wiki === 'markdown', project, sections, labels, reviewMonths, warnings, sources };
}

const today = () => new Date().toISOString().slice(0, 10);
const checkDate = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`날짜는 YYYY-MM-DD: ${d}`); return d; };

/** 제목 규칙(TP-003 §3). */
export function buildTitle(type, { topic, date = today() }) {
  const ty = TYPES[type];
  if (!ty) throw new Error(`문서 종류 '${type}' 는 없다`);
  if (!topic || !String(topic).trim()) throw new Error('topic(주제)이 필요하다');
  return ty.title.replace('{date}', checkDate(date)).replace('{topic}', String(topic).trim());
}

/** 다음 검토일 — 날짜에 months 를 더한다(말일은 그 달의 마지막 날로). */
export function nextReview(date, months = 6) {
  const [y, m, d] = checkDate(date).split('-').map(Number);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12); const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 공통 머리(TP-003 §2). 값이 없는 칸은 뺀다. 검토일은 review 종류에만.
 * @param {{ type, status, owner, date?, issues?: string[], decisions?: string[], summary, reviewMonths?, site? }} h
 */
export function renderHeader(h, format = 'html') {
  const ty = TYPES[h.type];
  if (!ty) throw new Error(`문서 종류 '${h.type}' 는 없다`);
  if (!(h.status in STATUSES)) throw new Error(`상태는 ${Object.keys(STATUSES).join(' | ')} 중 하나`);
  if (!h.owner) throw new Error('담당자(owner)가 필요하다');
  if (!h.summary) throw new Error('요약(summary)이 필요하다');
  const date = checkDate(h.date ?? today());
  const review = ty.review ? `${date} (다음 검토: ${nextReview(date, h.reviewMonths ?? 6)})` : null;
  const issues = (h.issues ?? []).filter(Boolean);
  const decisions = (h.decisions ?? []).filter(Boolean);
  const issueLink = (k) => (h.site ? `<a href="https://${h.site}/browse/${esc(k)}">${esc(k)}</a>` : esc(k));
  if (format === 'markdown') {
    const line1 = [`**상태** ${h.status}`, `**담당자** ${h.owner}`, review && `**검토일** ${review}`].filter(Boolean).join(' · ');
    const line2 = [issues.length && `**관련 이슈** ${issues.join(', ')}`, decisions.length && `**관련 결정** ${decisions.join(', ')}`].filter(Boolean).join(' · ');
    return [`> ${line1}`, line2 && `> ${line2}`, `> **요약** ${h.summary}`].filter(Boolean).join('\n') + '\n';
  }
  const p1 = [`<span data-type="status" data-color="${STATUSES[h.status]}">${esc(h.status)}</span>`, `담당자: ${esc(h.owner)}`, review && `검토일: ${esc(review)}`].filter(Boolean).join(' · ');
  const p2 = [issues.length && `관련 이슈: ${issues.map(issueLink).join(', ')}`, decisions.length && `관련 결정: ${decisions.map(esc).join(', ')}`].filter(Boolean).join(' · ');
  return `<div data-type="panel-info"><p>${p1}</p>${p2 ? `<p>${p2}</p>` : ''}<p><strong>요약</strong> ${esc(h.summary)}</p></div>`;
}

/** markdown 위키의 파일 경로 — docs/wiki/<구역>/[<연도>/]<제목>.md */
export function wikiPath(type, title, date) {
  const ty = TYPES[type];
  if (!ty) throw new Error(`문서 종류 '${type}' 는 없다`);
  const safe = String(title).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  const year = ty.byYear ? `${(date ?? (title.match(/^\d{4}/) ?? [today().slice(0, 4)])[0]).slice(0, 4)}/` : '';
  return `docs/wiki/${ty.section}/${year}${safe}.md`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const projectRoot = resolve(opt('project') ?? process.cwd());
  const cmd = args[0] && !args[0].startsWith('--') ? args[0] : null;
  try {
    if (cmd === 'title') process.stdout.write(buildTitle(normalizeType(opt('type')).type, { topic: opt('topic'), date: opt('date') }) + '\n');
    else if (cmd === 'header') {
      const cfg = resolveWikiConfig(projectRoot);
      process.stdout.write(renderHeader({
        type: normalizeType(opt('type')).type, status: opt('status'), owner: opt('owner'), date: opt('date'),
        issues: (opt('issues') ?? '').split(',').map((s) => s.trim()), decisions: (opt('decisions') ?? '').split(',').map((s) => s.trim()),
        summary: opt('summary'), reviewMonths: cfg.reviewMonths, site: cfg.project.site,
      }, opt('format') ?? (cfg.wiki === 'confluence' ? 'html' : 'markdown')) + '\n');
    } else if (cmd === 'path') process.stdout.write(wikiPath(normalizeType(opt('type')).type, opt('title'), opt('date')) + '\n');
    else {
      const r = resolveWikiConfig(projectRoot);
      if (args.includes('--json')) process.stdout.write(JSON.stringify({ ...r, types: TYPES, sectionNames: SECTIONS }, null, 2) + '\n');
      else {
        process.stdout.write(`위키 ${r.wiki}${r.writes ? '' : '(쓰지 않음)'} · 스페이스 ${r.project.defaultSpaceKey ?? '(없음)'} · 검토 주기 ${r.reviewMonths}개월\n`);
        for (const [s, n] of Object.entries(SECTIONS)) process.stdout.write(`  ${n.padEnd(8)} ${r.sections[s] ?? '(구역 페이지 없음 — 쓸 때 묻고 만든다)'}\n`);
        for (const w of r.warnings) process.stdout.write(`! ${w}\n`);
      }
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
