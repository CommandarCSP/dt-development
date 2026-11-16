// 폴더 구조 바꿔 끼우기(GEN-04) — 규칙은 표준 경로(`src/...`, `e2e/...`)로 적고,
// 엔진이 스택 설정을 보고 프로젝트의 실제 경로로 바꾼다. 설정이 기본값이면 아무것도 바꾸지 않는다.
//
// 스택 설정:
//   paths.src  — 표준 `src/` 자리(예: "app", "packages/web/src", "." = 루트). 기본 "src"
//   paths.e2e  — 표준 `e2e/` 자리. 기본 "e2e"
//   layout     — src 아래 층 폴더 이름 바꾸기. 키·값 모두 src 기준 상대 경로
//                예: { "pages": "routes", "business": "features", "components/domain": "widgets" }
//
// 바꾸는 곳: 규칙의 appliesTo·excludePathPatterns, forbidden-import 의 matches·forbidden-call 의 matchArguments 안
// 폴더 이름(`**/business/**` 등).
// 키·값은 docs/refs/stack-config.md.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 스택 설정 파일. 없거나 깨졌으면 {} — 기본 구조로 본다. */
export async function readConfig(projectRoot, configFileName) {
  try { return JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8')) ?? {}; } catch { return {}; }
}

const clean = (p) => String(p ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

/** @returns {{ src: string, e2e: string, layout: [string,string][], identity: boolean }} */
export function layoutFromConfig(cfg = {}) {
  const src = cfg?.paths?.src == null ? 'src' : clean(cfg.paths.src);
  const e2e = cfg?.paths?.e2e == null ? 'e2e' : clean(cfg.paths.e2e);
  const entries = Object.entries(cfg?.layout ?? {})
    .filter(([k, v]) => typeof v === 'string' && clean(k) && clean(v) && clean(k) !== clean(v))
    .map(([k, v]) => [clean(k), clean(v)])
    .sort((a, b) => b[0].length - a[0].length); // 긴 키 먼저(components/domain 이 components 보다 앞)
  return { src: src === '.' ? '' : src, e2e: e2e === '.' ? '' : e2e, layout: entries, identity: src === 'src' && e2e === 'e2e' && entries.length === 0 };
}

const join2 = (base, rest) => (base ? (rest ? `${base}/${rest}` : base) : rest);

/** src 아래 상대 경로의 앞쪽 층 이름을 바꾼다. */
function mapLayer(rest, layout) {
  for (const [from, to] of layout) {
    if (rest === from) return to;
    if (rest.startsWith(`${from}/`)) return to + rest.slice(from.length);
  }
  return rest;
}

/** 표준 경로 glob 하나를 프로젝트 경로로. `src/`·`e2e/`로 시작하지 않는 것(설정 파일·`**` 등)은 그대로. */
export function rewriteGlob(glob, lay) {
  if (typeof glob !== 'string') return glob;
  if (glob === 'src' || glob.startsWith('src/')) return join2(lay.src, mapLayer(glob.slice(4), lay.layout));
  if (glob === 'e2e' || glob.startsWith('e2e/')) return join2(lay.e2e, glob.slice(4));
  return glob;
}

/** import 경로 패턴 안의 층 이름(`**\/business/**`, `../../store/**`, `@/types/*Dto`)을 바꾼다. */
export function rewriteImportPattern(pattern, lay) {
  if (typeof pattern !== 'string' || !lay.layout.length) return pattern;
  let out = pattern;
  for (const [from, to] of lay.layout) {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|/)${esc}(?=/|$)`, 'g'), `$1${to}`);
  }
  return out;
}

/** 규칙 목록을 프로젝트 구조에 맞게 바꾼 새 목록. 원본은 건드리지 않는다. */
export function applyLayout(rules, cfg) {
  const lay = layoutFromConfig(cfg);
  if (lay.identity) return rules;
  return rules.map((r) => ({
    ...r,
    appliesTo: r.appliesTo.map((g) => rewriteGlob(g, lay)),
    excludePathPatterns: r.excludePathPatterns.map((g) => rewriteGlob(g, lay)),
    detection: r.detection.map((d) => {
      const out = { ...d };
      if (d.type === 'forbidden-import' && Array.isArray(d.matches)) out.matches = d.matches.map((m) => rewriteImportPattern(m, lay));
      if (Array.isArray(d.matchArguments)) out.matchArguments = d.matchArguments.map((m) => rewriteImportPattern(m, lay));
      return out;
    }),
  }));
}
