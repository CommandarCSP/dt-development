/**
 * import 그래프와 디렉터리 군집 — 코드가 실제로 뭉친 곳을 보인다.
 * 소비처: /dt-handbook analyze(4장 빌딩블록).
 * 커뮤니티 탐지를 하지 않는다 — 디렉터리와 실제 결합이 어긋나는 것을 보이는 게 목적이다.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { walkSourceFiles } from './surfaceInventory.mjs';

const IMPORT_RE = /(?:^|\n)\s*(?:import\b[^'"]*?|export\b[^'"]*?from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/** 상대 지정자를 실제 파일로 푼다. 확장자·index 를 차례로 시도하고, 못 풀면 null(간선 없음). */
function resolveRel(fromAbs, spec) {
  return resolveBase(resolve(dirname(fromAbs), spec));
}

/** 절대 경로(확장자 없을 수 있음)를 실제 파일로 푼다. */
function resolveBase(base) {
  // TS 의 ESM 관례: 소스는 .ts 인데 import 는 .js 로 적는다. 확장자를 떼고 다시 시도한다.
  const stripped = base.replace(/\.(?:js|mjs|jsx)$/, '');
  const cands = [
    base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => resolve(base, `index${e}`)),
    ...(stripped === base ? [] : EXTS.map((e) => stripped + e)),
  ];
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

/** 주석·끝 쉼표가 있는 tsconfig 도 읽는다(JSONC). 못 읽으면 null. */
function readJsonc(p) {
  try {
    const t = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(t);
  } catch { return null; }
}

const SKIP = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.git']);
function findFiles(root, test, depth = 4) {
  const out = [];
  const walk = (dir, d) => {
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.') && d < depth) walk(join(dir, e.name), d + 1); }
      else if (test(e.name)) out.push(join(dir, e.name));
    }
  };
  walk(root, 0);
  return out;
}

/**
 * 패키지 이름으로 쓰는 import 를 푼다 — 모노레포·TS 프로젝트에서 상대 경로가 아닌 import 가 대부분이라,
 * 이것을 못 풀면 군집 응집도가 틀어진다.
 *   - tsconfig `compilerOptions.paths`(예: `@/*` → `./src/*`) — 그 tsconfig 폴더 아래 파일에만 쓴다(가까운 것 먼저).
 *   - 워크스페이스 패키지(`package.json` 의 `name`, 예: `@acme/ui`) — `exports['.'].source` · `source` → `src/index` → `index` → `main`.
 */
export function buildResolver(root) {
  const aliases = [];
  for (const p of findFiles(root, (n) => /^tsconfig.*\.json$/.test(n))) {
    const c = readJsonc(p)?.compilerOptions;
    if (!c?.paths) continue;
    const base = resolve(dirname(p), c.baseUrl ?? '.');
    for (const [pat, targets] of Object.entries(c.paths)) {
      if (!Array.isArray(targets)) continue;
      aliases.push({ scope: dirname(p), pat, targets: targets.map((t) => resolve(base, t)) });
    }
  }
  aliases.sort((a, b) => b.scope.length - a.scope.length || b.pat.length - a.pat.length);
  const packages = new Map();
  for (const p of findFiles(root, (n) => n === 'package.json')) {
    if (dirname(p) === root) continue;
    const pkg = readJsonc(p);
    if (pkg?.name) packages.set(pkg.name, { dir: dirname(p), pkg });
  }
  const tryFile = (abs) => resolveBase(abs);
  return (fromAbs, spec) => {
    for (const a of aliases) {
      if (!fromAbs.startsWith(a.scope + sep) && fromAbs !== a.scope) continue;
      const star = a.pat.indexOf('*');
      const hit = star < 0 ? (spec === a.pat ? '' : null) : (spec.startsWith(a.pat.slice(0, star)) && spec.endsWith(a.pat.slice(star + 1)) ? spec.slice(star, spec.length - (a.pat.length - star - 1)) : null);
      if (hit === null) continue;
      for (const t of a.targets) { const r = tryFile(t.replace('*', hit)); if (r) return r; }
    }
    const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    const ws = packages.get(name);
    if (!ws) return null;
    const sub = spec.slice(name.length).replace(/^\//, '');
    const { dir, pkg } = ws;
    if (sub) return tryFile(join(dir, 'src', sub)) ?? tryFile(join(dir, sub));
    const exp = pkg.exports?.['.'] ?? pkg.exports;
    const cands = [exp?.source, pkg.source, 'src/index', 'index', pkg.module, pkg.main].filter((x) => typeof x === 'string');
    for (const c of cands) { const r = tryFile(join(dir, c)); if (r) return r; }
    return null;
  };
}

export function buildDepGraph(root) {
  root = resolve(root);
  const nodes = walkSourceFiles(root); // root 기준 상대경로
  const known = new Set(nodes);
  const edges = [];
  const resolveBare = buildResolver(root);

  for (const rel of nodes) {
    const abs = join(root, rel);
    let src;
    try { src = readFileSync(abs, 'utf8'); } catch { continue; }
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(src))) {
      // 외부 패키지는 간선이 아니다. 별칭·워크스페이스 패키지는 저장소 안 파일로 풀린다.
      const target = m[1].startsWith('.') ? resolveRel(abs, m[1]) : resolveBare(abs, m[1]);
      if (!target) continue;
      const t = relative(root, target).split(sep).join('/');
      if (known.has(t)) edges.push([rel, t]);
    }
  }

  const dirOf = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.');
  const byDir = new Map();
  for (const f of nodes) {
    if (!byDir.has(dirOf(f))) byDir.set(dirOf(f), []);
    byDir.get(dirOf(f)).push(f);
  }

  const clusters = [...byDir.entries()].map(([dir, files]) => {
    const inside = new Set(files);
    let internal = 0;
    let inbound = 0;
    let outbound = 0;
    for (const [a, b] of edges) {
      const ai = inside.has(a);
      const bi = inside.has(b);
      if (ai && bi) internal++;
      else if (ai) outbound++;
      else if (bi) inbound++;
    }
    const total = internal + inbound + outbound;
    return {
      id: `cl:${dir}`, dir, files, internal, inbound, outbound,
      cohesion: total === 0 ? 0 : Number((internal / total).toFixed(3)),
    };
  }).sort((a, b) => b.files.length - a.files.length || a.dir.localeCompare(b.dir));

  return { nodes, edges, clusters };
}
