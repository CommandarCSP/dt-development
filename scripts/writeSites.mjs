/**
 * 쓰기 지점 수집 — 데이터의 주인을 찾는 재료. 읽기는 흩어져도 되지만 쓰기가 흩어지면 사고가 난다.
 * 소비처: /dt-handbook analyze(5장 데이터 관리 주체).
 * 규칙은 실물을 보고 늘린다 — 추측으로 늘리면 오탐이 쏟아진다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { walkSourceFiles } from './surfaceInventory.mjs';

const RULES = [
  { kind: 'db',    re: /\bprisma\.(\w+)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g, target: (m) => `db:${m[1]}` },
  { kind: 'db',    re: /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["`']?(\w+)/gi,                             target: (m) => `db:${m[1].toLowerCase()}` },
  { kind: 'file',  re: /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync)\s*\(/g,       target: () => 'file:fs' },
  { kind: 'store', re: /\bset\(\s*\(?\s*(?:\{|\w+\s*=>)/g,                                                      target: () => 'store:state' },
  { kind: 'store', re: /\b(?:dispatch|commit)\(\s*['"`](\w+)/g,                                                 target: (m) => `store:${m[1]}` },
  { kind: 'ipc',   re: /\b(?:ipcRenderer|webContents)\.send\(\s*['"`]([^'"`]+)['"`]/g,                          target: (m) => `ipc:${m[1]}` },
  { kind: 'cache', re: /\bcache\.(?:set|del|invalidate|clear)\s*\(/g,                                           target: () => 'cache:default' },
];
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

export function collectWriteSites(root) {
  const sites = [];
  for (const rel of walkSourceFiles(root)) {
    let src;
    try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
    for (const { kind, re, target } of RULES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) sites.push({ kind, target: target(m), file: rel, line: lineOf(src, m.index) });
    }
  }

  const byTarget = {};
  for (const s of sites) {
    byTarget[s.target] = byTarget[s.target] ?? [];
    if (!byTarget[s.target].includes(s.file)) byTarget[s.target].push(s.file);
  }
  const multiOwner = Object.keys(byTarget).filter((t) => byTarget[t].length > 1).sort();
  return { sites, byTarget, multiOwner };
}
