import { readFileSync as _read, writeFileSync as _write, existsSync as _exists, mkdirSync as _mkdir } from 'node:fs';
import { dirname as _dirname, resolve as _resolve } from 'node:path';
import { fileURLToPath as _f2p } from 'node:url';
import { parseSections, mergeOwnedSections } from './lib/sections.mjs';
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

/** 옛 형식(스택 접두어 없는 `## 기술 스택`)이면 그 스택, 아니면 null. */
export function detectLegacy(md) {
  const { preamble, sections } = parseSections(md);
  if (!sections.some((s) => s.key === '기술 스택')) return null;
  return sections.some((s) => s.key === '공유 규약') || /# Project Context \(Backend\)/.test(preamble) ? 'backend' : 'frontend';
}

/** 옛 형식을 새 절 이름으로 옮긴다. 내용은 바꾸지 않는다. */
export function migrateLegacy(md) {
  const stack = detectLegacy(md);
  if (!stack) return { md, stack: null };
  const p = stack === 'backend' ? 'BE' : 'FE';
  const out = md
    .replace(/^# Project Context \(Backend\)\s*$/m, '# Project Context')
    .replace(/^## 기술 스택/m, `## ${p} 기술 스택`)
    .replace(/^## 프로젝트 기술\/라이브러리/m, `## ${p} 프로젝트 기술/라이브러리`);
  return { md: out, stack };
}

/**
 * `rendered`(그 스택 템플릿을 채운 전문)를 `existing` 에 합친다.
 * - 그 스택 소유 절: 바꾼다(없으면 정해진 순서 자리에 넣는다)
 * - 공통 절: existing 에 없을 때만 넣는다(사용자 편집 보존)
 * - 다른 스택 절·모르는 절: 그대로
 * - 머리(메타 주석·제목): rendered 것을 쓴다(동기화 시각 갱신)
 * existing 이 옛 형식이면 `{ ok: false, reason: 'legacy', stack }` — 먼저 migrateLegacy 를 보이고 확인받는다.
 */
export function mergeStackSections(existing, stack, rendered) {
  if (!SECTION_OWNERS[stack]) throw new Error(`stack 은 frontend|backend: ${stack}`);
  if (!existing || !existing.trim()) return { ok: true, md: rendered };
  const legacy = detectLegacy(existing);
  if (legacy) return { ok: false, reason: 'legacy', stack: legacy };
  return { ok: true, md: mergeOwnedSections(existing, rendered, { owned: SECTION_OWNERS[stack], fillIfAbsent: SECTION_OWNERS.common, order: ORDER }) };
}

// CLI — 스킬(문서)이 쓴다.
//   merge   --file docs/project-context.md --stack frontend|backend --from <채운 템플릿>   (exit 3 = 옛 형식, migrate 먼저)
//   migrate --file docs/project-context.md [--write]                                    (기본은 미리보기 출력)
if (process.argv[1] && _resolve(process.argv[1]) === _f2p(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : undefined; };
  const file = opt('file') ?? 'docs/project-context.md';
  const existing = _exists(file) ? _read(file, 'utf8') : '';
  if (cmd === 'merge') {
    const r = mergeStackSections(existing, opt('stack'), _read(opt('from'), 'utf8'));
    if (!r.ok) { process.stderr.write(`${file} 은 옛 형식(${r.stack})이다 — migrate 로 옮긴 뒤 다시 merge 한다\n`); process.exit(3); }
    _mkdir(_dirname(file), { recursive: true });
    _write(file, r.md);
    process.stdout.write(`${file} — ${opt('stack')} 절만 갱신했다\n`);
  } else if (cmd === 'migrate') {
    const r = migrateLegacy(existing);
    if (!r.stack) { process.stdout.write('옛 형식이 아니다 — 할 일 없음\n'); process.exit(0); }
    if (rest.includes('--write')) { _write(file, r.md); process.stdout.write(`${file} — ${r.stack} 옛 형식을 새 절 이름으로 옮겼다\n`); }
    else process.stdout.write(r.md);
  } else {
    process.stderr.write('usage: projectContextSync.mjs merge|migrate …\n');
    process.exit(2);
  }
}
