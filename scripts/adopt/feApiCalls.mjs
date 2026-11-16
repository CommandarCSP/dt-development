#!/usr/bin/env node
/**
 * FE 가 실제로 부르는 API — `apiClient|axios|http.get('/path')` 같은 호출을 결정적으로 뽑는다(dt-adopt 3단계의 FE 입력).
 * 템플릿 리터럴의 `${id}` 는 `:param` 으로 바꿔 BE 경로와 맞춘다. 테스트·mock 파일은 뺀다(mock 은 계약의 사본이라 근거가 아니다).
 *
 * CLI: node scripts/adopt/feApiCalls.mjs <projectRoot> [--json]
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkSourceFiles } from '../surfaceInventory.mjs';

const CALL_RE = /\b(?:apiClient|api|client|axios|http|instance)\.(get|post|put|patch|delete)\s*(?:<[^>()]*>)?\(\s*([`'"])([^`'"]*)\2/g;
const isExcluded = (f) => /(\.|\/)(test|spec)\.[tj]sx?$/.test(f) || /(^|\/)(__tests__|__mocks__|mocks|e2e|fixtures)\//.test(f);

export const normalizeCallPath = (p) => p.replace(/\$\{\s*(?:[\w.]*\.)?(\w+)\s*\}/g, ':$1').replace(/\?.*$/, '').replace(/\/+$/, '') || '/';

export function feApiCalls(projectRoot) {
  const out = [];
  for (const f of walkSourceFiles(projectRoot).filter((x) => /^src\//.test(x) && !isExcluded(x))) {
    const code = readFileSync(join(projectRoot, f), 'utf8');
    let m;
    CALL_RE.lastIndex = 0;
    while ((m = CALL_RE.exec(code))) {
      if (!m[3].startsWith('/')) continue;
      out.push({ method: m[1].toUpperCase(), path: normalizeCallPath(m[3]), evidence: `${f}:${code.slice(0, m.index).split('\n').length}` });
    }
  }
  return out;
}

/** FE 호출 ↔ BE 엔드포인트 대조. 경로 매개변수 이름은 무시한다(:id = :postId). */
export function matchCalls(calls, endpoints) {
  const key = (method, path) => `${method} ${path.replace(/:[^/]+/g, ':p')}`;
  const be = new Map(endpoints.map((e) => [key(e.method, e.path), e]));
  const used = new Set();
  const unmatched = [];
  for (const c of calls) {
    const k = key(c.method, c.path);
    if (be.has(k)) used.add(k); else unmatched.push(c);
  }
  return { unmatchedCalls: unmatched, unusedEndpoints: endpoints.filter((e) => !used.has(key(e.method, e.path))) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = feApiCalls(resolve(process.argv[2] ?? '.'));
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else for (const c of r) process.stdout.write(`${c.method.padEnd(6)} ${c.path}  ${c.evidence}\n`);
}
