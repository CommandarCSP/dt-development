/**
 * 쓰기 지점 수집 — 데이터의 주인을 찾는 재료. 읽기는 흩어져도 되지만 쓰기가 흩어지면 사고가 난다.
 * 소비처: /dt-handbook analyze(5장 데이터 관리 주체).
 * 규칙은 실물을 보고 늘린다 — 추측으로 늘리면 오탐이 쏟아진다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { walkSourceFiles, isTestFile } from './surfaceInventory.mjs';

const RULES = [
  { kind: 'db',    re: /\bprisma\.(\w+)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g, target: (m) => `db:${m[1]}` },
  { kind: 'db',    re: /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["`']?(\w+)/gi,                             target: (m) => `db:${m[1].toLowerCase()}` },
  { kind: 'file',  re: /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|rmSync|unlinkSync)\s*\(/g,       target: () => 'file:fs' },
  // 상태 객체를 직접 넘기면(Zustand `set({ a })`·`store.setState({ a, b })`) 필드마다 센다 — 필드가 달라야 주인이 보인다.
  { kind: 'store', re: /\b(?:set|setState)\(\s*\{([^}]*)\}/g,                                                    target: (m) => objectKeys(m[1]).map((k) => `store:${k}`) },
  { kind: 'store', re: /\b(?:set|setState)\(\s*\(?\s*\w+\s*\)?\s*=>/g,                                                target: () => 'store:state' },
  { kind: 'store', re: /\b(?:dispatch|commit)\(\s*['"`](\w+)/g,                                                 target: (m) => `store:${m[1]}` },
  { kind: 'ipc',   re: /\b(?:ipcRenderer|webContents)\.send\(\s*['"`]([^'"`]+)['"`]/g,                          target: (m) => `ipc:${m[1]}` },
  { kind: 'cache', re: /\bcache\.(?:set|del|invalidate|clear)\s*\(/g,                                           target: () => 'cache:default' },
  // 브라우저 저장 — IndexedDB(직접·idb 래퍼), Web Storage.
  { kind: 'idb',   re: /\bobjectStore\(\s*['"`]([\w-]+)['"`]\s*\)\s*\.(?:put|add|delete|clear)\(/g,                 target: (m) => `idb:${m[1]}` },
  { kind: 'idb',   re: /\bdb\.(?:put|add|delete|clear)\(\s*['"`]([\w-]+)['"`]/g,                                     target: (m) => `idb:${m[1]}` },
  { kind: 'storage', re: /\b(?:localStorage|sessionStorage|storage)\.(?:setItem|removeItem)\(\s*([^,)]+)/g,        target: (m) => `storage:${m[1].trim().replace(/^['"`]|['"`]$/g, '')}` },
];
/** `{ a: 1, b, ...c, 'd': x }` → ['a', 'b', 'd'] — 펼침(...)과 중첩 안은 뺀다. */
function objectKeys(body) {
  const keys = [];
  let depth = 0; let cur = '';
  for (const ch of body + ',') {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { const k = cur.trim().match(/^['"]?([A-Za-z_$][\w$]*)['"]?\s*(?::|$)/); if (k && !cur.trim().startsWith('...')) keys.push(k[1]); cur = ''; continue; }
    cur += ch;
  }
  return [...new Set(keys)];
}
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

export function collectWriteSites(root) {
  const sites = [];
  // 테스트는 데이터의 주인이 아니다 — 픽스처·가짜 저장소가 "쓰는 곳"으로 잡히면 진짜 주인이 묻힌다.
  for (const rel of walkSourceFiles(root).filter((f) => !isTestFile(f))) {
    let src;
    try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
    for (const { kind, re, target } of RULES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) for (const t of [].concat(target(m))) sites.push({ kind, target: t, file: rel, line: lineOf(src, m.index) });
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
