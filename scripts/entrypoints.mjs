/**
 * 진입점 수집 — 라우트·IPC·HTTP·CLI 를 결정적으로 뽑는다. LLM 판단 없음.
 * 소비처: /dt-handbook analyze(시나리오 후보의 출발점).
 * 못 찾는 형태(동적 등록·리플렉션)는 못 찾은 채로 둔다 — 추측하지 않는다.
 */
import { existsSync, readFileSync } from 'node:fs';
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
/**
 * Express·Koa(router)·Fastify 의 `app.get('/x', handler)` 모양. 받는 쪽 이름을 서버 쪽으로 좁히고
 * 경로가 `/` 로 시작하며 뒤에 처리기가 오는 것만 본다 — `axios.get('/api/x')`·`map.get('k')` 를 진입점으로 잡지 않게.
 */
const ROUTER_CALL_RE = /\b(?:app|server|fastify|api|router|routes|[a-z][\w$]*Router)\.(get|post|put|patch|delete|options|head|all)\(\s*['"`](\/[^'"`]*)['"`]\s*,/g;
const HTTP_RE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
const CTRL_RE = /@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/;
const JS_EXT = /\.(?:ts|tsx|js|jsx|mjs)$/;
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** Next.js 파일 기반 라우트 — `next` 의존이 있을 때만 본다(아무 `pages/` 폴더를 라우트로 보지 않게). */
const usesNext = (root) => {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return Boolean(pkg.dependencies?.next ?? pkg.devDependencies?.next);
  } catch { return false; }
};
const NEXT_APP_RE = /^(?:src\/)?app\/(.*?)(?:^|\/)?(page|route)\.(?:tsx|jsx|ts|js)$/;
const NEXT_PAGES_RE = /^(?:src\/)?pages\/(.+)\.(?:tsx|jsx|ts|js)$/;
const HANDLER_EXPORT_RE = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
// 경로 묶음 `(group)`·병렬 슬롯 `@slot` 은 URL 에 안 나온다.
const nextUrl = (segs) => `/${segs.split('/').filter((x) => x && !/^\(.*\)$/.test(x) && !x.startsWith('@')).join('/')}`;

/**
 * 설정으로 더하는 패턴 — `.dt-handbook.json` 의 `entrypoints.extraPatterns`
 * (`[{ kind, pattern, flags? }]`, 첫 캡처 그룹이 이름). JS 밖의 언어(Flask `@app.route`, Go `HandleFunc` …)는 여기로 받는다.
 * 틀린 정규식은 건너뛰고 warnings 로 알린다.
 */
export function compileExtraPatterns(list = []) {
  const patterns = [];
  const warnings = [];
  if (!Array.isArray(list)) return { patterns, warnings: ['entrypoints.extraPatterns: 배열이어야 한다 — 무시했다'] };
  list.forEach((p, i) => {
    if (!p || typeof p.pattern !== 'string' || typeof p.kind !== 'string') { warnings.push(`entrypoints.extraPatterns[${i}]: kind·pattern 문자열이 필요하다 — 건너뛴다`); return; }
    try {
      const flags = [...new Set(`${p.flags ?? ''}g`)].join('');
      patterns.push({ kind: p.kind, re: new RegExp(p.pattern, flags), ...(Array.isArray(p.ext) ? { ext: p.ext } : {}) });
    } catch (e) { warnings.push(`entrypoints.extraPatterns[${i}]: 정규식이 틀렸다(${e.message}) — 건너뛴다`); }
  });
  return { patterns, warnings };
}

/** `.dt-handbook.json` 의 extraPatterns 를 읽는다. 파일이 없거나 키가 없으면 빈 목록. */
export function loadExtraPatterns(root) {
  const p = join(root, '.dt-handbook.json');
  if (!existsSync(p)) return { patterns: [], warnings: [] };
  try { return compileExtraPatterns(JSON.parse(readFileSync(p, 'utf8')).entrypoints?.extraPatterns ?? []); }
  catch (e) { return { patterns: [], warnings: [`.dt-handbook.json 을 읽지 못했다 — ${e.message}`] }; }
}

export function collectEntrypoints(root, { extraPatterns = [] } = {}) {
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

  const next = usesNext(root);
  const extraExts = [...new Set(extraPatterns.flatMap((p) => p.ext ?? []))];
  const isJs = (rel) => JS_EXT.test(rel);
  // walkSourceFiles 는 root 기준 상대경로(POSIX 구분자)를 돌려준다.
  for (const rel of walkSourceFiles(root, { extraExts })) {
    let src;
    try { src = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
    if (!isJs(rel)) {                                              // 설정 패턴이 더한 확장자 — 그 패턴만 본다
      for (const { kind, re, ext } of extraPatterns) {
        if (!ext?.some((x) => rel.endsWith(x))) continue;
        for (const m of src.matchAll(re)) push(kind, m[1] ?? m[0], rel, lineOf(src, m.index));
      }
      continue;
    }

    for (const { kind, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) push(kind, m[1], rel, lineOf(src, m.index));
    }
    ROUTER_CALL_RE.lastIndex = 0;
    for (const m of src.matchAll(ROUTER_CALL_RE)) push('http', `${m[1].toUpperCase()} ${m[2]}`, rel, lineOf(src, m.index));
    for (const { kind, re, ext } of extraPatterns) {
      if (ext && !ext.some((x) => rel.endsWith(x))) continue;      // ext 를 적은 패턴은 그 확장자만
      for (const m of src.matchAll(re)) push(kind, m[1] ?? m[0], rel, lineOf(src, m.index));
    }

    if (next) {
      const a = NEXT_APP_RE.exec(rel);
      if (a && a[2] === 'page') push('route', nextUrl(a[1]), rel, 1);
      if (a && a[2] === 'route') {
        const url = nextUrl(a[1]);
        for (const h of src.matchAll(HANDLER_EXPORT_RE)) push('http', `${h[1]} ${url}`, rel, lineOf(src, h.index));
      }
      const pg = !a && NEXT_PAGES_RE.exec(rel);
      if (pg && !/(^|\/)_(app|document|error)$/.test(pg[1])) {
        const url = nextUrl(pg[1].replace(/(^|\/)index$/, ''));
        push(url.startsWith('/api/') || url === '/api' ? 'http' : 'route', url.startsWith('/api') ? `ANY ${url}` : url, rel, 1);
      }
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
