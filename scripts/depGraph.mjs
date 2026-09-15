/**
 * import 그래프와 디렉터리 군집 — 코드가 실제로 뭉친 곳을 보인다.
 * 소비처: /dt-handbook analyze(4장 빌딩블록).
 * 커뮤니티 탐지를 하지 않는다 — 디렉터리와 실제 결합이 어긋나는 것을 보이는 게 목적이다.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { walkSourceFiles } from './surfaceInventory.mjs';

const IMPORT_RE = /(?:^|\n)\s*(?:import\b[^'"]*?|export\b[^'"]*?from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/** 상대 지정자를 실제 파일로 푼다. 확장자·index 를 차례로 시도하고, 못 풀면 null(간선 없음). */
function resolveRel(fromAbs, spec) {
  const base = resolve(dirname(fromAbs), spec);
  // TS 의 ESM 관례: 소스는 .ts 인데 import 는 .js 로 적는다. 확장자를 떼고 다시 시도한다.
  const stripped = base.replace(/\.(?:js|mjs|jsx)$/, '');
  const cands = [
    base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => resolve(base, `index${e}`)),
    ...(stripped === base ? [] : EXTS.map((e) => stripped + e)),
  ];
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}

export function buildDepGraph(root) {
  root = resolve(root);
  const nodes = walkSourceFiles(root); // root 기준 상대경로
  const known = new Set(nodes);
  const edges = [];

  for (const rel of nodes) {
    const abs = join(root, rel);
    let src;
    try { src = readFileSync(abs, 'utf8'); } catch { continue; }
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(src))) {
      if (!m[1].startsWith('.')) continue; // 패키지는 간선이 아니다
      const target = resolveRel(abs, m[1]);
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
