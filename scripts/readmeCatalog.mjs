#!/usr/bin/env node
/**
 * README 전체 목록 자동 생성 — 명령·스킬·에이전트의 머리말에서 표를 만들어 README 의
 * `<!-- catalog:start -->` … `<!-- catalog:end -->` 사이를 채운다. 손으로 고치지 않는다.
 * README 위쪽의 "갈래" 표는 사람이 고른 묶음이라 그대로 둔다.
 *
 * CLI: node scripts/readmeCatalog.mjs [--write]   — 기본은 확인(README 가 생성 결과와 다르면 exit 1)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_TIERS } from './lib/config.mjs';

export const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const START = '<!-- catalog:start -->';
export const END = '<!-- catalog:end -->';

/** `key: value` 머리말(스킬·에이전트·명령 형식). 접은 블록(`key: >-` · `|`)은 들여쓴 다음 줄들을 한 줄로 잇는다. */
export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {}; const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const x = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!x) continue;
    let v = x[2];
    if (/^[>|][-+]?$/.test(v)) {
      const body = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) body.push(lines[++i].trim());
      v = body.join(' ');
    }
    out[x[1]] = v.replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/** 설명의 첫 문장(— 또는 . 앞)만, 표가 넘치지 않게. 파이프는 이스케이프. */
export function brief(desc, max = 110) {
  let s = (desc ?? '').replace(/^Use (this )?(skill )?when /i, '').split(/ — |\. (?=[A-Z가-힣])/)[0].trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
  return s.replace(/\|/g, '\\|');
}

const tierOf = (name) => Object.entries(AGENT_TIERS).find(([, list]) => list.includes(name))?.[0] ?? '—';

export function renderCatalog(root = PLUGIN_ROOT) {
  const md = (dir) => readdirSync(join(root, dir)).filter((f) => f.endsWith('.md')).sort();
  const skills = readdirSync(join(root, 'skills')).filter((d) => existsSync(join(root, 'skills', d, 'SKILL.md'))).sort();
  const commands = md('commands');
  const agents = md('agents');
  const cmdNames = new Set(commands.map((f) => f.replace(/\.md$/, '')));

  const lines = [START, '', `<details><summary>전체 목록 — 명령 ${commands.length} · 스킬 ${skills.length} · 에이전트 ${agents.length} (자동 생성: <code>node scripts/readmeCatalog.mjs --write</code>)</summary>`, ''];
  lines.push('**명령** — 사용자가 `/`로 부르는 입구. 절차는 따르는 스킬에 있다.', '', '| 명령 | 하는 일 | 따르는 스킬 |', '|---|---|---|');
  for (const f of commands) {
    const text = readFileSync(join(root, 'commands', f), 'utf8');
    const name = f.replace(/\.md$/, '');
    const skill = text.match(/skills\/(dt-[a-z0-9-]+)\/SKILL\.md/)?.[1] ?? text.match(/`?(dt-[a-z0-9-]+)`? 스킬/)?.[1] ?? '—';
    lines.push(`| \`/${name}\` | ${brief(frontmatter(text).description)} | \`${skill}\` |`);
  }
  lines.push('', '**스킬** — 명령이 부르거나, 조건이 맞으면 모델이 스스로 부른다. 같은 이름 명령이 있는 스킬은 `/` 메뉴에 나오지 않는다.', '', '| 스킬 | 하는 일 |', '|---|---|');
  for (const d of skills) {
    const fm = frontmatter(readFileSync(join(root, 'skills', d, 'SKILL.md'), 'utf8'));
    lines.push(`| \`${d}\`${cmdNames.has(d) ? ` (/${d})` : ''} | ${brief(fm.description)} |`);
  }
  lines.push('', '**에이전트** — 사용자가 부르지 않는다. 조율 스킬이 일을 맡긴다. 티어는 `.dt.json` `team.models`로 모델을 고르는 묶음이다.', '', '| 에이전트 | 티어 | 하는 일 |', '|---|---|---|');
  for (const f of agents) {
    const name = f.replace(/\.md$/, '');
    const fm = frontmatter(readFileSync(join(root, 'agents', f), 'utf8'));
    lines.push(`| \`${name}\` | ${tierOf(name)} | ${brief(fm.description)} |`);
  }
  lines.push('', '</details>', '', END);
  return lines.join('\n');
}

/** README 에서 표시 사이를 바꾼 결과. 표시가 없으면 null. */
export function applyCatalog(readme, catalog) {
  const i = readme.indexOf(START); const j = readme.indexOf(END);
  if (i < 0 || j < 0 || j < i) return null;
  return readme.slice(0, i) + catalog + readme.slice(j + END.length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = join(PLUGIN_ROOT, 'README.md');
  const readme = readFileSync(path, 'utf8');
  const next = applyCatalog(readme, renderCatalog());
  if (next == null) { process.stderr.write(`README.md 에 ${START} … ${END} 표시가 없다\n`); process.exit(2); }
  if (process.argv.includes('--write')) { writeFileSync(path, next); process.stdout.write('README.md 전체 목록을 다시 만들었다\n'); }
  else if (next !== readme) { process.stdout.write('README.md 전체 목록이 오래됐다 — node scripts/readmeCatalog.mjs --write\n'); process.exit(1); }
  else process.stdout.write('README.md 전체 목록이 최신이다\n');
}
