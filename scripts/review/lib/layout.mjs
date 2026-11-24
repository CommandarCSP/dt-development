// 폴더 구조 바꿔 끼우기(GEN-04) — 규칙은 표준 경로(`src/...`, `e2e/...`)로 적고,
// 엔진이 스택 설정을 보고 프로젝트의 실제 경로로 바꾼다. 설정이 기본값이면 아무것도 바꾸지 않는다.
//
// 스택 설정:
//   paths.src  — 표준 `src/` 자리(예: "app", "packages/web/src", "." = 루트). 기본 "src"
//   paths.e2e  — 표준 `e2e/` 자리. 기본 "e2e"
//   paths.test — BE 표준 `test/`(e2e) 자리. 기본 "test"
//   layout     — src 아래 층 폴더 이름 바꾸기. 키·값 모두 src 기준 상대 경로
//                예: { "pages": "routes", "business": "features", "components/domain": "widgets" }
//   testing.location — 테스트 파일 자리. "__tests__"(기본) | "colocated"(소스 옆)   (GEN-06)
//   testing.suffix   — 종류별 파일 이름 꼬리 { unit, integration, e2e, any }. 적은 것만 바꾼다
//                      기본: .unit.test · .integration.test · e2e(FE .spec · BE .e2e.test) · .test
//
// 바꾸는 곳: 규칙의 appliesTo·excludePathPatterns, forbidden-import 의 matches·forbidden-call 의 matchArguments 안
// 폴더 이름(`**/business/**` 등), requires-sibling-test 의 testPath.
// 테스트 경로는 엔진이 아는 모양(classifyTestGlob)이어야 바뀐다 — 구조 테스트가 지킨다.
// 키·값은 docs/refs/stack-config.md.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 스택 설정 파일. 없거나 깨졌으면 {} — 기본 구조로 본다. */
export async function readConfig(projectRoot, configFileName) {
  try { return JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8')) ?? {}; } catch { return {}; }
}

const clean = (p) => String(p ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

export const TEST_KINDS = ['unit', 'integration', 'e2e', 'any'];
export const TEST_LOCATIONS = ['__tests__', 'colocated'];
/** 규칙 문서가 쓰는 꼬리. 긴 것부터 맞춘다(.unit.test 가 .test 보다 먼저). */
const RULE_SUFFIX = [['unit', '.unit.test'], ['integration', '.integration.test'], ['e2e', '.e2e.test'], ['any', '.test']];

/** @returns {{ location: string, suffix: Record<string,string>, identity: boolean }} */
export function testingFromConfig(cfg = {}) {
  const t = cfg?.testing ?? {};
  const location = t.location == null ? '__tests__' : String(t.location);
  if (!TEST_LOCATIONS.includes(location)) {
    throw new Error(`testing.location '${location}' 는 모르는 값이다 — ${TEST_LOCATIONS.join(' | ')} 중 하나 (docs/refs/stack-config.md §3)`);
  }
  const suffix = {};
  for (const [k, v] of Object.entries(t.suffix ?? {})) {
    if (!TEST_KINDS.includes(k)) throw new Error(`testing.suffix.${k} 는 모르는 종류다 — ${TEST_KINDS.join(' | ')} (docs/refs/stack-config.md §3)`);
    const val = String(v ?? '').trim().replace(/\.(ts|tsx|js|jsx)$/, '');
    if (!val) throw new Error(`testing.suffix.${k} 가 비었다 — 예: ".spec"`);
    suffix[k] = /^[.-]/.test(val) ? val : `.${val}`;
  }
  return { location, suffix, identity: location === '__tests__' && Object.keys(suffix).length === 0 };
}

/** @returns {{ src: string, e2e: string, test: string, layout: [string,string][], testing: object, identity: boolean }} */
export function layoutFromConfig(cfg = {}) {
  const src = cfg?.paths?.src == null ? 'src' : clean(cfg.paths.src);
  const e2e = cfg?.paths?.e2e == null ? 'e2e' : clean(cfg.paths.e2e);
  const testDir = cfg?.paths?.test == null ? 'test' : clean(cfg.paths.test);
  const testing = testingFromConfig(cfg);
  const entries = Object.entries(cfg?.layout ?? {})
    .filter(([k, v]) => typeof v === 'string' && clean(k) && clean(v) && clean(k) !== clean(v))
    .map(([k, v]) => [clean(k), clean(v)])
    .sort((a, b) => b[0].length - a[0].length); // 긴 키 먼저(components/domain 이 components 보다 앞)
  return {
    src: src === '.' ? '' : src, e2e: e2e === '.' ? '' : e2e, test: testDir === '.' ? '' : testDir, layout: entries, testing,
    identity: src === 'src' && e2e === 'e2e' && testDir === 'test' && entries.length === 0 && testing.identity,
  };
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
  if (glob === 'test' || glob.startsWith('test/')) return join2(lay.test, glob.slice(5));
  return glob;
}

// ── 테스트 파일 이름(GEN-06) ──────────────────────────────────────────────
const EXT = '(ts|tsx|\\{ts,tsx\\})';
const SRC_TEST = new RegExp(`^(src(?:/[^*]+?)?)/\\*\\*/__tests__/\\*\\*/\\*([\\w.-]*)\\.${EXT}$`);
const E2E_TEST = new RegExp(`^((?:e2e|test)(?:/\\*\\*)?)/\\*([\\w.-]+)\\.${EXT}$`);
const TEST_PATH = /^(__tests__\/)?\{basename\}([\w.-]+)\.(tsx?)$/;

/** 꼬리(`.repository.integration.test`)를 종류와 앞부분으로. 모르는 꼬리면 null. */
function splitSuffix(middle) {
  if (middle === '') return { kind: 'any', head: '', implicit: true };
  for (const [kind, s] of RULE_SUFFIX) if (middle.endsWith(s)) return { kind, head: middle.slice(0, -s.length) };
  return null;
}

/**
 * 규칙 문서의 테스트 경로 하나를 읽는다. 테스트 경로가 아니면 { kind: null }, 테스트 경로인데 모르는 모양이면 null.
 * 아는 모양: `src[/층]/**\/__tests__/**\/*<꼬리>.<확장자>` · `e2e|test/**\/*<꼬리>.<확장자>`
 */
export function classifyTestGlob(glob) {
  if (typeof glob !== 'string') return { kind: null };
  let m = glob.match(SRC_TEST);
  if (m) { const s = splitSuffix(m[2]); return s && { ...s, where: 'src', prefix: m[1], ext: m[3] }; }
  m = glob.match(E2E_TEST);
  if (m) return { kind: 'e2e', head: '', where: 'e2e', prefix: m[1], ext: m[3], middle: m[2] };
  const looksTest = /__tests__|\.(test|spec)\b|-spec\b|^(e2e|test)\//.test(glob);
  return looksTest ? null : { kind: null };
}

/** 종류의 실제 꼬리. 설정에 없으면 규칙 문서의 꼬리. */
const suffixOf = (lay, kind) => lay.testing.suffix[kind] ?? Object.fromEntries(RULE_SUFFIX)[kind];

/** 다른 꼬리에 덮이는 꼬리를 뺀다(.test 가 있으면 .unit.test 는 군더더기). */
function minimalSuffixes(list) {
  const uniq = [...new Set(list)];
  return uniq.filter((s) => !uniq.some((o) => o !== s && s.endsWith(o)));
}

/** 표준 테스트 glob 하나를 설정의 이름·자리로. 결과는 glob 배열(colocated 의 "아무 테스트"는 꼬리마다 하나). */
export function rewriteTestGlob(glob, lay) {
  const c = classifyTestGlob(glob);
  if (!c || !c.kind || lay.testing.identity) return [glob];
  if (c.where === 'e2e') {
    const s = lay.testing.suffix.e2e;
    return [s ? `${c.prefix}/*${s}.${c.ext}` : glob];
  }
  const dir = lay.testing.location === 'colocated' ? `${c.prefix}/**/` : `${c.prefix}/**/__tests__/**/`;
  if (c.implicit) {
    if (lay.testing.location !== 'colocated') return [glob]; // __tests__ 안이면 무엇이든 테스트
    return minimalSuffixes(['any', 'unit', 'integration'].map((k) => suffixOf(lay, k))).map((s) => `${dir}*${s}.${c.ext}`);
  }
  return [`${dir}*${c.head}${suffixOf(lay, c.kind)}.${c.ext}`];
}

/** requires-sibling-test 의 testPath(`__tests__/{basename}.unit.test.ts`)를 설정대로. */
export function rewriteTestPath(testPath, lay) {
  const m = typeof testPath === 'string' ? testPath.match(TEST_PATH) : null;
  if (!m || lay.testing.identity) return testPath;
  const s = splitSuffix(m[2]);
  if (!s) return testPath;
  const dir = lay.testing.location === 'colocated' ? '' : '__tests__/';
  return `${dir}{basename}${s.head}${suffixOf(lay, s.kind)}.${m[3]}`;
}

/**
 * 꼬리가 겹칠 때(unit ".spec" ⊂ integration ".integration.spec") 단위 규칙이 통합 테스트에 걸리지 않게
 * 더 긴 꼬리를 제외 목록에 더한다. 규칙이 그 종류도 다루면 더하지 않는다.
 */
function overlapExcludes(appliesTo, lay) {
  const cs = appliesTo.map(classifyTestGlob).filter((c) => c?.kind && c.where === 'src');
  const kinds = new Set(cs.map((c) => c.kind));
  const out = [];
  for (const c of cs) {
    if (c.implicit) continue;
    const own = c.head + suffixOf(lay, c.kind);
    for (const other of ['unit', 'integration']) {
      if (kinds.has(other)) continue;
      const theirs = c.head + suffixOf(lay, other);
      if (theirs !== own && theirs.endsWith(own)) out.push(...rewriteTestGlob(`${c.prefix}/**/__tests__/**/*${c.head}${RULE_SUFFIX.find(([k]) => k === other)[1]}.${c.ext}`, lay));
    }
  }
  return out;
}

/**
 * 테스트를 소스 옆에 두면 소스용 규칙(`src/pages/*.tsx`)이 테스트 파일까지 소스로 본다 — `__tests__` 구조에선 폴더가 달라
 * 생기지 않던 일. 한 층 glob 이거나 "테스트가 있어야 한다" 규칙이면 테스트 파일을 뺀다.
 * (`src/**\/*.tsx` 처럼 깊이 무관 규칙은 `__tests__` 안 파일에도 이미 걸리므로 그대로 둔다 — 두 구조의 결과를 같게.)
 */
function colocatedSourceExcludes(rule, lay) {
  if (lay.testing.location !== 'colocated') return [];
  if (rule.appliesTo.some((g) => classifyTestGlob(g)?.kind)) return [];
  const shallow = rule.appliesTo.some((g) => /^src\//.test(g) && !g.includes('**'));
  const needsTest = rule.detection.some((d) => d.type === 'requires-sibling-test');
  if (!shallow && !needsTest) return [];
  return minimalSuffixes(['any', 'unit', 'integration'].map((k) => suffixOf(lay, k))).map((s) => `src/**/*${s}.{ts,tsx}`);
}

/** 구조 규칙이 테스트 파일을 빼는 목록(`src/**\/*.test.ts`)에 설정한 꼬리도 더한다. */
function testFileExcludes(excludes, lay) {
  const extra = [];
  for (const g of excludes) {
    const m = g.match(/^(src(?:\/[^*]+?)?)\/\*\*\/\*\.test\.(ts|tsx|\{ts,tsx\})$/);
    if (!m) continue;
    for (const s of Object.values(lay.testing.suffix)) extra.push(`${m[1]}/**/*${s}.${m[2]}`);
  }
  return extra;
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
  const uniq = (xs) => [...new Set(xs)];
  return rules.map((r) => ({
    ...r,
    appliesTo: uniq(r.appliesTo.flatMap((g) => rewriteTestGlob(g, lay)).map((g) => rewriteGlob(g, lay))),
    excludePathPatterns: uniq([
      ...r.excludePathPatterns.flatMap((g) => rewriteTestGlob(g, lay)),
      ...overlapExcludes(r.appliesTo, lay),
      ...testFileExcludes(r.excludePathPatterns, lay),
      ...colocatedSourceExcludes(r, lay),
    ].map((g) => rewriteGlob(g, lay))),
    detection: r.detection.map((d) => {
      const out = { ...d };
      if (d.type === 'requires-sibling-test' && d.testPath) out.testPath = rewriteTestPath(d.testPath, lay);
      if (d.type === 'forbidden-import' && Array.isArray(d.matches)) out.matches = d.matches.map((m) => rewriteImportPattern(m, lay));
      if (Array.isArray(d.matchArguments)) out.matchArguments = d.matchArguments.map((m) => rewriteImportPattern(m, lay));
      return out;
    }),
  }));
}
