import { readFileSync as _read, writeFileSync as _write, existsSync as _exists, mkdirSync as _mkdir } from 'node:fs';
import { dirname as _dirname, resolve as _resolve } from 'node:path';
import { fileURLToPath as _f2p } from 'node:url';
import { parseSections, mergeOwnedSections, renderSections } from './lib/sections.mjs';
const META_REGEX = /<!-- lastSyncedAt: ([^,]+), packageJsonMtime: ([^ ]+) -->/;

export function parseMetaHeader(markdown) {
  const m = markdown.match(META_REGEX);
  if (!m) return { lastSyncedAt: null, packageJsonMtime: null };
  return { lastSyncedAt: m[1].trim(), packageJsonMtime: m[2].trim() };
}

export function serializeMetaHeader({ lastSyncedAt, packageJsonMtime }) {
  return `<!-- Synced from package.json -->\n<!-- lastSyncedAt: ${lastSyncedAt}, packageJsonMtime: ${packageJsonMtime} -->`;
}

export function needsSync({ currentPkgMtime, storedPkgMtime }) {
  if (!storedPkgMtime) return true;
  return currentPkgMtime.getTime() > new Date(storedPkgMtime).getTime();
}

// ---------------------------------------------------------------------------
// 절 단위 병합 — FE·BE 스킬이 같은 docs/project-context.md 를 서로 덮어쓰지 않게 한다(GEN-34).
// 각 스택은 자기 절만 바꾸고, 공통 절은 없을 때만 채운다. 나머지는 글자 그대로 둔다.
// 절 제목은 2단계(##)로 둔다 — materialize-tokens.mjs 가 `## 디자인 토큰` 아래 `###` 를 읽는다.

export const SECTION_OWNERS = {
  common: ['개요', '제약사항', '도메인 용어'],
  frontend: ['FE 기술 스택', 'FE 프로젝트 기술/라이브러리', '디자인 토큰'],
  backend: ['BE 기술 스택', 'BE 프로젝트 기술/라이브러리', '공유 규약'],
};
const ORDER = ['개요', ...SECTION_OWNERS.frontend, ...SECTION_OWNERS.backend, '제약사항', '도메인 용어'];

export { sectionKey, parseSections } from './lib/sections.mjs';

// ---------------------------------------------------------------------------
// 플러그인 형식이 아닌 기존 문서 — 플러그인이 만들기 전부터 있던 project-context(옛 단일 템플릿, 다른 언어·다른 제목)를
// 그대로 두고 플러그인 절을 옆에 붙이면, 같은 내용이 두 벌이 되고 낡은 기록(코드에 없는 기술)이 스펙 작성의 입력으로 남는다.
// 그래서 merge 는 멈추고(exit 3), migrate 미리보기로 "어느 절을 어디로 옮길지 · 겹치는 절 · 코드에 없는 기술"을 보이고 확인받는다.

/** 제목 키워드 → 플러그인 절. 언어·표기에 묶이지 않게 키워드로 본다(대소문자 무시). 스택 절은 'stack' 으로 두고 스택 접두어를 붙인다. */
export const HEADING_KEYWORDS = [
  { target: 'stack', re: /tech(nology)?\s*stack|^stack$|^tech(nolog(y|ies))?$|기술\s*스택|^기술$|dependencies|libraries|라이브러리|tooling/i },
  { target: '개요', re: /overview|introduction|^about\b|^summary$|개요|소개/i },
  { target: '제약사항', re: /constraint|limitation|non-?functional|제약/i },
  { target: '도메인 용어', re: /glossary|terminology|^terms$|용어/i },
];
const KNOWN = new Set([...SECTION_OWNERS.common, ...SECTION_OWNERS.frontend, ...SECTION_OWNERS.backend]);
const LEGACY_KO = { '기술 스택': '기술 스택', '프로젝트 기술/라이브러리': '프로젝트 기술/라이브러리' };

/** 내용으로 스택을 짐작한다 — 못 하면 null(호출한 쪽 stack 을 쓴다). */
function guessStack(md) {
  // 절·제목이 가장 강한 신호다(플러그인 템플릿의 스택 전용 절). 그다음이 본문의 기술 이름.
  const keys = parseSections(md).sections.map((x) => x.key);
  if (keys.includes('공유 규약') || /# Project Context \(Backend\)/.test(md)) return 'backend';
  if (keys.includes('디자인 토큰')) return 'frontend';
  const be = /nest(js)?\b|prisma|typeorm|express|fastify/i.test(md);
  const fe = /\breact\b|\bvue\b|svelte|angular|vite|tailwind|디자인 토큰/i.test(md);
  return be && !fe ? 'backend' : fe && !be ? 'frontend' : null;
}

/** 플러그인 절이 아닌 절 하나 → 옮길 자리(없으면 null). */
const UNDECIDED = '(스택 미정)';
const prefixed = (stack, name) => `${stack === 'backend' ? 'BE' : stack === 'frontend' ? 'FE' : UNDECIDED} ${name}`;
function targetOf(key, stack) {
  if (LEGACY_KO[key]) return prefixed(stack, LEGACY_KO[key]);
  const hit = HEADING_KEYWORDS.find((h) => h.re.test(key));
  if (!hit) return null;
  return hit.target === 'stack' ? prefixed(stack, '기술 스택') : hit.target;
}

/** 기술 이름(문서에 적힌 표기) → 패키지. 스택 사전 점검의 영역 표와 같은 기술을 본다. */
const TECH = [
  ['React', /\breact(\.js)?\b(?![- ]?(query|router|native))/i, ['react']], ['Vue', /\bvue(\.js)?\b/i, ['vue', 'nuxt']], ['Svelte', /\bsvelte/i, ['svelte', '@sveltejs/kit']],
  ['Angular', /\bangular\b/i, ['@angular/core']], ['Next.js', /\bnext\.?js\b/i, ['next']],
  ['TanStack Query', /tanstack\s*query|react[- ]query/i, ['@tanstack/react-query', 'react-query']], ['SWR', /\bswr\b/i, ['swr']], ['Apollo', /\bapollo\b/i, ['@apollo/client']],
  ['Redux', /\bredux\b/i, ['redux', '@reduxjs/toolkit']], ['Zustand', /\bzustand\b/i, ['zustand']], ['Jotai', /\bjotai\b/i, ['jotai']], ['Recoil', /\brecoil\b/i, ['recoil']], ['MobX', /\bmobx\b/i, ['mobx']],
  ['Tailwind', /tailwind/i, ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss']], ['SCSS/Sass', /\b(scss|sass)\b/i, ['sass', 'node-sass', 'sass-embedded']],
  ['styled-components', /styled[- ]components/i, ['styled-components']], ['Emotion', /\bemotion\b/i, ['@emotion/react', '@emotion/styled']], ['MUI', /\bmui\b|material[- ]ui/i, ['@mui/material']], ['Ant Design', /\bantd\b|ant design/i, ['antd']],
  ['React Router', /react[- ]router/i, ['react-router', 'react-router-dom']], ['TanStack Router', /tanstack\s*router/i, ['@tanstack/react-router']],
  ['Vitest', /\bvitest\b/i, ['vitest']], ['Jest', /\bjest\b/i, ['jest']], ['Mocha', /\bmocha\b/i, ['mocha']], ['MSW', /\bmsw\b/i, ['msw']],
  ['Playwright', /playwright/i, ['@playwright/test', 'playwright']], ['Cypress', /cypress/i, ['cypress']],
  ['NestJS', /\bnest(js)?\b/i, ['@nestjs/core']], ['Express', /\bexpress(\.js)?\b/i, ['express']], ['Fastify', /fastify/i, ['fastify']],
  ['Prisma', /\bprisma\b/i, ['@prisma/client', 'prisma']], ['TypeORM', /typeorm/i, ['typeorm']], ['Sequelize', /sequelize/i, ['sequelize']], ['Drizzle', /drizzle/i, ['drizzle-orm']], ['Mongoose', /mongoose/i, ['mongoose']],
  ['Supertest', /supertest/i, ['supertest']], ['Testcontainers', /testcontainers/i, ['testcontainers', '@testcontainers/postgresql', '@testcontainers/mysql']],
];

/** 문서에 적혔는데 package.json 에 없는 기술(낡은 기록 후보). deps 가 비었으면(package.json 없음) 판단하지 않는다. */
export function staleTech(text, deps = {}) {
  const names = Object.keys(deps);
  if (!names.length) return [];
  return TECH.filter(([, re, pkgs]) => re.test(text) && !pkgs.some((p) => names.includes(p))).map(([label]) => label);
}

/**
 * 플러그인 형식이 아닌 절을 어떻게 옮길지 계획한다.
 * @param {string} md 기존 문서
 * @param {{ stack?: 'frontend'|'backend', deps?: object }} opts stack = 내용으로 짐작이 안 될 때 쓸 스택(merge 를 부른 쪽)
 * @returns {{ stack: string|null, renames: {from,to}[], conflicts: {from,to}[], unmapped: string[], stale: {section,names}[] } | null}
 *   플러그인 형식이면(옮길 절도 겹치는 절도 없으면) null
 */
export function legacyPlan(md, { stack, deps } = {}) {
  if (!md || !md.trim()) return null;
  const { preamble, sections } = parseSections(md);
  const st = guessStack(md) ?? stack ?? null;
  const present = new Set(sections.map((s) => s.key));
  const renames = []; const conflicts = []; const unmapped = []; const stale = [];
  for (const s of sections) {
    if (KNOWN.has(s.key) || s.key.startsWith(ARCHIVE)) continue;
    const to = targetOf(s.key, st);
    if (!to) { unmapped.push(s.key); continue; }
    (present.has(to) || renames.some((r) => r.to === to) ? conflicts : renames).push({ from: s.key, to });
    const names = staleTech(s.text, deps);
    if (names.length) stale.push({ section: s.key, names });
  }
  const backendTitle = /# Project Context \(Backend\)/.test(preamble);
  if (!renames.length && !conflicts.length && !backendTitle) return null;
  return { stack: st, renames, conflicts, unmapped, stale };
}

/** 겹치는 절을 둘 다 둘 때 붙이는 접두어 — 이 이름은 다시 옮길 대상으로 보지 않는다. */
export const ARCHIVE = '옛 기록 — ';

/** 옛 형식이면 그 스택(짐작 못 하면 'unknown'), 아니면 null. merge 가 멈출지 정하는 데 쓴다. */
export function detectLegacy(md, opts = {}) {
  const plan = legacyPlan(md, opts);
  return plan ? plan.stack ?? 'unknown' : null;
}

/**
 * 계획대로 옮긴다. 내용은 바꾸지 않는다 — 제목만 바꾸고, 겹치는 절은 resolve 로 정한다.
 * @param {{ stack?, deps?, resolve?: 'drop'|'keep' }} opts resolve: drop=옛 절을 지운다 · keep=`옛 기록 — <제목>` 으로 남긴다.
 *   겹치는 절이 있는데 resolve 가 없으면 { needsResolve: true } 로 돌려주고 아무것도 바꾸지 않는다.
 */
export function migrateLegacy(md, opts = {}) {
  const plan = legacyPlan(md, opts);
  if (!plan) return { md, stack: null, plan: null };
  if (plan.conflicts.length && !opts.resolve) return { md, stack: plan.stack, plan, needsResolve: true };
  if ([...plan.renames, ...plan.conflicts].some((r) => r.to.startsWith(UNDECIDED))) return { md, stack: null, plan, needsStack: true };
  const { preamble, sections } = parseSections(md);
  const renameTo = new Map(plan.renames.map((r) => [r.from, r.to]));
  const conflict = new Set(plan.conflicts.map((c) => c.from));
  const out = [];
  for (const s of sections) {
    const title = s.text.slice(3, s.text.indexOf('\n') < 0 ? undefined : s.text.indexOf('\n'));
    if (renameTo.has(s.key)) out.push({ key: renameTo.get(s.key), text: s.text.replace(title, renameTo.get(s.key)) });
    else if (conflict.has(s.key)) { if (opts.resolve === 'keep') out.push({ key: ARCHIVE + s.key, text: s.text.replace(title, ARCHIVE + title) }); }
    else out.push(s);
  }
  return { md: renderSections({ preamble: preamble.replace(/^# Project Context \(Backend\)\s*$/m, '# Project Context'), sections: out }), stack: plan.stack, plan };
}

/**
 * `rendered`(그 스택 템플릿을 채운 전문)를 `existing` 에 합친다.
 * - 그 스택 소유 절: 바꾼다(없으면 정해진 순서 자리에 넣는다)
 * - 공통 절: existing 에 없을 때만 넣는다(사용자 편집 보존)
 * - 다른 스택 절·모르는 절: 그대로
 * - 머리(메타 주석·제목): rendered 것을 쓴다(동기화 시각 갱신)
 * existing 이 옛 형식이면 `{ ok: false, reason: 'legacy', stack }` — 먼저 migrateLegacy 를 보이고 확인받는다.
 */
export function mergeStackSections(existing, stack, rendered, { deps } = {}) {
  if (!SECTION_OWNERS[stack]) throw new Error(`stack 은 frontend|backend: ${stack}`);
  if (!existing || !existing.trim()) return { ok: true, md: rendered };
  const plan = legacyPlan(existing, { stack, deps });
  if (plan) return { ok: false, reason: 'legacy', stack: plan.stack ?? 'unknown', plan };
  return { ok: true, md: mergeOwnedSections(existing, rendered, { owned: SECTION_OWNERS[stack], fillIfAbsent: SECTION_OWNERS.common, order: ORDER }) };
}

// CLI — 스킬(문서)이 쓴다.
//   merge   --file docs/project-context.md --stack frontend|backend --from <채운 템플릿> [--root .]   (exit 3 = 플러그인 형식 아님, migrate 먼저)
//   migrate --file docs/project-context.md [--stack frontend|backend] [--resolve drop|keep] [--write] [--json] [--root .]
//           기본은 미리보기(옮길 절·겹치는 절·코드에 없는 기술 + 옮긴 결과). 겹치는 절이 있는데 --resolve 가 없으면 --write 는 exit 4.
//   --root 의 package.json 으로 "코드에 없는 기술"을 판단한다(기본: 현재 폴더).
function depsAt(root) {
  try { const pkg = JSON.parse(_read(_resolve(root, 'package.json'), 'utf8')); return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }; } catch { return {}; }
}

export function describePlan(plan) {
  const lines = [];
  for (const r of plan.renames) lines.push(`옮김   ## ${r.from} → ## ${r.to}`);
  for (const c of plan.conflicts) lines.push(`겹침   ## ${c.from} ↔ 이미 있는 ## ${c.to} — 옛 절을 지울까(--resolve drop), "${ARCHIVE}${c.from}"로 남길까(--resolve keep)`);
  for (const st of plan.stale) lines.push(`낡음?  ## ${st.section}: ${st.names.join(', ')} — package.json 에 없다`);
  for (const u of plan.unmapped) lines.push(`그대로 ## ${u} (플러그인 절과 대응하지 않음 — 손대지 않는다)`);
  if (!plan.stack) lines.push('스택을 정하지 못했다 — --stack frontend|backend 로 알려 준다');
  return lines.join('\n');
}

if (process.argv[1] && _resolve(process.argv[1]) === _f2p(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
  const file = opt('file') ?? 'docs/project-context.md';
  const existing = _exists(file) ? _read(file, 'utf8') : '';
  const deps = depsAt(opt('root') ?? process.cwd());
  if (cmd === 'merge') {
    const r = mergeStackSections(existing, opt('stack'), _read(opt('from'), 'utf8'), { deps });
    if (!r.ok) { process.stderr.write(`${file} 은 플러그인 형식이 아니다 — migrate 로 미리보고 옮긴 뒤 다시 merge 한다\n${describePlan(r.plan)}\n`); process.exit(3); }
    _mkdir(_dirname(file), { recursive: true });
    _write(file, r.md);
    process.stdout.write(`${file} — ${opt('stack')} 절만 갱신했다\n`);
  } else if (cmd === 'migrate') {
    const r = migrateLegacy(existing, { stack: opt('stack'), deps, resolve: opt('resolve') });
    if (!r.plan) { process.stdout.write('플러그인 형식이다 — 할 일 없음\n'); process.exit(0); }
    if (rest.includes('--json')) { process.stdout.write(JSON.stringify(r.plan, null, 2) + '\n'); process.exit(0); }
    process.stdout.write(describePlan(r.plan) + '\n');
    if (r.needsStack) process.exit(4);
    if (rest.includes('--write')) {
      if (r.needsResolve) { process.stderr.write('겹치는 절이 있다 — --resolve drop|keep 을 정한 뒤 다시 쓴다\n'); process.exit(4); }
      _write(file, r.md); process.stdout.write(`${file} — 플러그인 절 이름으로 옮겼다\n`);
    } else if (!r.needsResolve) process.stdout.write('\n--- 옮긴 결과(미리보기) ---\n' + r.md);
  } else {
    process.stderr.write('usage: projectContextSync.mjs merge|migrate …\n');
    process.exit(2);
  }
}
