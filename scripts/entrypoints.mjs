/**
 * 진입점 수집 — 라우트·IPC·HTTP·CLI 를 결정적으로 뽑는다. LLM 판단 없음.
 * 소비처: /dt-handbook analyze(시나리오 후보의 출발점).
 * 못 찾는 형태(동적 등록·리플렉션)는 못 찾은 채로 둔다 — 추측하지 않는다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { walkSourceFiles } from './surfaceInventory.mjs';

const PATTERNS = [
  { kind: 'ipc',   re: /\bipcMain\.(?:handle|handleOnce|on|once)\(\s*['"`]([^'"`]+)['"`]/g },
  // 채널을 상수·변수로 넘기는 등록도 흔하다(CH.foo, channel). 이름은 적힌 그대로 남기고
  // 실제 문자열이 무엇인지는 워커가 코드를 보고 푼다.
  { kind: 'ipc',   re: /\bipcMain\.(?:handle|handleOnce|on|once)\(\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*,/g },
  { kind: 'route', re: /<Route\b[^>]*\bpath=\{?['"`]([^'"`}]+)['"`]/g },
  { kind: 'route', re: /\bpath:\s*['"`]([^'"`]+)['"`]\s*,\s*(?:element|component|Component):/g },
  { kind: 'cli',   re: /\.command\(\s*['"`]([^'"`]+)['"`]/g },
  { kind: 'event', re: /\bapp\.on\(\s*['"`]([^'"`]+)['"`]/g },
];
const HTTP_RE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
const CTRL_RE = /@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/;
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

export function collectEntrypoints(root) {
  const entrypoints = [];
  const seen = new Set();
  const push = (kind, name, file, line) => {
    const base = `${kind}:${name}`;
    let id = base;
    let n = 1;
    while (seen.has(id)) id = `${base}#${++n}`;
    seen.add(id);
    entrypoints.push({ id, kind, name, file, line });
  };

  // walkSourceFiles 는 root 기준 상대경로(POSIX 구분자)를 돌려준다.
  for (const rel of walkSourceFiles(root)) {
    let src;
    try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }

    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) push(kind, m[1], rel, lineOf(src, m.index));
    }

    // HTTP 는 컨트롤러 접두어와 합쳐야 실제 경로가 된다.
    const ctrl = CTRL_RE.exec(src);
    if (ctrl) {
      const prefix = (ctrl[1] ?? '').replace(/^\/|\/$/g, '');
      HTTP_RE.lastIndex = 0;
      let m;
      while ((m = HTTP_RE.exec(src))) {
        const tail = (m[2] ?? '').replace(/^\//, '');
        const path = [prefix, tail].filter(Boolean).join('/');
        push('http', `${m[1].toUpperCase()} ${path}`, rel, lineOf(src, m.index));
      }
    }
  }

  const counts = {};
  for (const e of entrypoints) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  return { entrypoints, counts };
}
