#!/usr/bin/env node
/**
 * `docs/specs/interactions.md` 절 단위 병합 — FE(spec-author)·BE(bespec-author)가 같은 파일을 서로 덮어쓰지 않게 한다.
 * 소유: `## FE 크로스페이지` = FE 스펙, `## BE 크로스리소스` = BE 스펙(`docs/refs/artifact-contract.md`).
 * 절 안의 하위 항목(네비게이션 그래프·공유 상태·액션→리액션 등)은 `###` 이하로 쓴다.
 *
 * CLI
 *   merge   --file docs/specs/interactions.md --stack frontend|backend --from <자기 절만 담은 파일>   (exit 3 = 옛 형식)
 *   migrate --file docs/specs/interactions.md [--write]                                            (기본은 미리보기)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSections, renderSections, mergeOwnedSections } from './lib/sections.mjs';

export const OWNERS = { frontend: 'FE 크로스페이지', backend: 'BE 크로스리소스' };
const ORDER = [OWNERS.frontend, OWNERS.backend];
export const PREAMBLE = '# Interactions\n\n<!-- 크로스유닛 상호작용 맵(docs/refs/interaction-integrity.md). FE 절은 FE 스펙(spec-author), BE 절은 BE 스펙(bespec-author)이 쓴다 — 각자 자기 절만 scripts/interactionsSync.mjs merge 로 바꾼다. -->\n\n';

/** 소유 절 밖에 `##` 절이 있으면 옛 형식(절 구분 전 — spec-author 가 파일 전체를 쓰던 때). */
export function detectLegacy(md) {
  if (!md || !md.trim()) return false;
  const known = new Set(ORDER);
  return parseSections(md).sections.some((s) => !known.has(s.key));
}

/** 옛 형식의 소유 밖 절을 한 단계 내려 `## FE 크로스페이지` 아래로 모은다. BE 절은 그대로. 내용은 바꾸지 않는다. */
export function migrateLegacy(md) {
  if (!detectLegacy(md)) return { md, moved: 0 };
  const { sections } = parseSections(md);
  const known = new Set(ORDER);
  const loose = sections.filter((s) => !known.has(s.key));
  const demoted = loose.map((s) => s.text.replace(/^(#{2,5}) /gm, (_, h) => `#${h} `)).join('').replace(/\n*$/, '\n');
  const fe = sections.find((s) => s.key === OWNERS.frontend);
  const be = sections.find((s) => s.key === OWNERS.backend);
  const feText = (fe ? fe.text.replace(/\n*$/, '\n\n') : `## ${OWNERS.frontend}\n\n`) + demoted;
  const out = [{ key: OWNERS.frontend, text: feText }, ...(be ? [be] : [])];
  return { md: renderSections({ preamble: PREAMBLE, sections: out }), moved: loose.length };
}

/**
 * @param {string} existing 지금 파일 내용('' 이면 새 파일)
 * @param {'frontend'|'backend'} stack
 * @param {string} section `## <소유 절>` 로 시작하는 자기 절 전문
 */
export function mergeInteractions(existing, stack, section) {
  const owner = OWNERS[stack];
  if (!owner) throw new Error(`stack 은 frontend|backend: ${stack}`);
  if (!section.startsWith(`## ${owner}`)) throw new Error(`자기 절은 "## ${owner}" 로 시작해야 한다`);
  if (detectLegacy(existing)) return { ok: false, reason: 'legacy' };
  const rendered = PREAMBLE + section;
  return { ok: true, md: mergeOwnedSections(existing || PREAMBLE, rendered, { owned: [owner], order: ORDER }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
  const file = opt('file') ?? 'docs/specs/interactions.md';
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (cmd === 'merge') {
    const r = mergeInteractions(existing, opt('stack'), readFileSync(opt('from'), 'utf8'));
    if (!r.ok) { process.stderr.write(`${file} 은 옛 형식(절 구분 전)이다 — migrate 로 옮긴 뒤 다시 merge 한다\n`); process.exit(3); }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, r.md);
    process.stdout.write(`${file} — ${OWNERS[opt('stack')]} 절만 갱신했다\n`);
  } else if (cmd === 'migrate') {
    const r = migrateLegacy(existing);
    if (!r.moved) { process.stdout.write('옛 형식이 아니다 — 할 일 없음\n'); process.exit(0); }
    if (rest.includes('--write')) { writeFileSync(file, r.md); process.stdout.write(`${file} — 절 ${r.moved}개를 ## ${OWNERS.frontend} 아래로 옮겼다\n`); }
    else process.stdout.write(r.md);
  } else {
    process.stderr.write('usage: interactionsSync.mjs merge|migrate …\n');
    process.exit(2);
  }
}
