#!/usr/bin/env node
/**
 * NestJS 엔드포인트 역추출 — 컨트롤러 데코레이터에서 결정적으로 뽑는다(LLM 판단 없음). dt-adopt 3단계의 BE 입력.
 * 뽑는 것: method · path(전역 prefix + @Controller + 메서드 데코레이터) · 핸들러 · 가드(클래스·메서드) · @HttpCode · 근거(file:line).
 * 못 뽑는 것(에이전트가 코드를 읽어 채움): 요청·응답 DTO 형태, 던지는 예외에서 나오는 상태 코드, 동적 라우트.
 *
 * CLI: node scripts/adopt/beEndpoints.mjs <projectRoot> [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkSourceFiles } from '../surfaceInventory.mjs';

const METHODS = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
const HTTP_STATUS = { OK: 200, CREATED: 201, ACCEPTED: 202, NO_CONTENT: 204 };
const DEFAULT_STATUS = { POST: 201 };

const GUARD_RE = /@UseGuards\(((?:[^()]|\([^()]*\))*)\)/g;
const lineAt = (code, i) => code.slice(0, i).split('\n').length;
const strArg = (s) => s?.match(/^\s*['"`]([^'"`]*)['"`]/)?.[1] ?? '';
const join2 = (...parts) => '/' + parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');

/** main.ts 의 app.setGlobalPrefix('api/v1') */
export function globalPrefix(projectRoot) {
  for (const f of ['src/main.ts', 'src/main.js']) {
    const p = join(projectRoot, f);
    if (existsSync(p)) return readFileSync(p, 'utf8').match(/setGlobalPrefix\(\s*['"`]([^'"`]+)['"`]/)?.[1] ?? '';
  }
  return '';
}

/** 파일 하나의 컨트롤러 → 엔드포인트 목록. */
export function parseController(code, file, prefix = '') {
  const out = [];
  const ctrlRe = /@Controller\(([^)]*)\)\s*(?:@\w+\([^)]*\)\s*)*export\s+class\s+(\w+)/g;
  let c;
  while ((c = ctrlRe.exec(code))) {
    const base = strArg(c[1]) || (c[1].match(/path\s*:\s*['"`]([^'"`]+)/)?.[1] ?? '');
    const classStart = c.index;
    // 클래스 데코레이터 = @Controller 바로 위에 붙은 데코레이터 줄들 + @Controller 와 class 사이의 것. 앞 클래스의 데코레이터는 섞지 않는다.
    const above = code.slice(0, classStart).split('\n');
    above.pop();
    const deco = [];
    while (above.length && /^\s*@/.test(above[above.length - 1])) deco.unshift(above.pop());
    const before = deco.join('\n') + '\n' + c[0];
    const classGuards = [...before.matchAll(GUARD_RE)].map((m) => m[1].trim());
    const bodyStart = code.indexOf('{', classStart + c[0].length);
    const next = code.slice(bodyStart).search(/\n@Controller\(/);
    const body = code.slice(bodyStart, next < 0 ? code.length : bodyStart + next);
    const decoRe = new RegExp(`@(${METHODS.join('|')})\\(([^)]*)\\)`, 'g');
    let d;
    while ((d = decoRe.exec(body))) {
      // 메서드 데코레이터부터 이어지는 데코레이터 줄만 이 핸들러 몫이다. 첫 비-데코레이터 줄이 핸들러 시그니처.
      const lines = body.slice(d.index).split('\n');
      const decoLines = [];
      let sig = '';
      for (const l of lines) { if (/^\s*@/.test(l) || (decoLines.length && /^\s*[)\]},]/.test(l))) decoLines.push(l); else { sig = l; break; } }
      const decoBlock = decoLines.join('\n');
      const handler = sig.match(/^\s*(?:public\s+|private\s+)?(?:async\s+)?(\w+)\s*\(/)?.[1] ?? null;
      const guards = [...decoBlock.matchAll(GUARD_RE)].map((m) => m[1].trim());
      const codeName = decoBlock.match(/@HttpCode\(\s*(?:HttpStatus\.(\w+)|(\d{3}))\s*\)/);
      const method = d[1].toUpperCase();
      const status = codeName ? (codeName[2] ? Number(codeName[2]) : HTTP_STATUS[codeName[1]] ?? null) : DEFAULT_STATUS[method] ?? 200;
      const isPublic = /@Public\(\)/.test(decoBlock);
      out.push({
        method,
        path: join2(prefix, base, strArg(d[2])),
        controller: c[2],
        handler,
        guards: isPublic ? [] : [...classGuards, ...guards],
        public: isPublic,
        status,
        evidence: `${file}:${lineAt(code, bodyStart + d.index)}`,
      });
    }
  }
  return out;
}

export function beEndpoints(projectRoot) {
  const prefix = globalPrefix(projectRoot);
  const files = walkSourceFiles(projectRoot).filter((f) => /^src\//.test(f) && /\.controller\.[tj]s$/.test(f));
  return files.flatMap((f) => parseController(readFileSync(join(projectRoot, f), 'utf8'), f, prefix));
}

/** "의도인지 버그인지" 확인 후보 — 기계로 보이는 수상한 점만. */
export function endpointSuspects(endpoints) {
  const out = [];
  const guardedShare = endpoints.filter((e) => e.guards.length).length / Math.max(1, endpoints.length);
  for (const e of endpoints) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method) && !e.guards.length && !e.public && guardedShare >= 0.5 && !/^\/?(api\/v\d+\/)?auth\//.test(e.path.replace(/^\//, '')))
      out.push({ kind: 'unguarded-mutation', endpoint: `${e.method} ${e.path}`, evidence: e.evidence, question: '다른 엔드포인트는 대부분 인증 가드가 있는데 이 변경 API에는 없다. 의도(공개 API)인가, 빠뜨린 것인가?' });
  }
  const seen = new Map();
  for (const e of endpoints) {
    const k = `${e.method} ${e.path.replace(/:[^/]+/g, ':p')}`;
    if (seen.has(k)) out.push({ kind: 'duplicate-route', endpoint: k, evidence: `${seen.get(k)} · ${e.evidence}`, question: '같은 메서드·경로가 두 핸들러에 있다. 하나는 죽은 코드인가?' });
    else seen.set(k, e.evidence);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? '.');
  const eps = beEndpoints(root);
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify({ endpoints: eps, suspects: endpointSuspects(eps) }, null, 2) + '\n');
  else for (const e of eps) process.stdout.write(`${e.method.padEnd(6)} ${e.path}  ${e.status}  ${e.guards.join(',') || '(가드 없음)'}  ${e.evidence}\n`);
}
