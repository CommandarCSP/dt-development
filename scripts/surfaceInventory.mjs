/**
 * 표면 인벤토리 — 프로젝트의 "화면 목록"을 결정적으로 뽑는다. LLM 판단 없음.
 * 소비자: /dt-guide analyze 3단계(출발 지도), dt-audit auditor(undocumented 탐지).
 * 스펙: docs/specs/2026-09-12-user-guide-skill-design.md §5-3.
 */
import { readdirSync, readFileSync, statSync, existsSync, realpathSync } from 'node:fs';
import { join, relative, sep, posix, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-preload', 'build', 'out', 'release', 'coverage', '.next', '.superpowers']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

export function walkSourceFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (SRC_EXT.has(extname(entry))) out.push(relative(root, full).split(sep).join(posix.sep));
    }
  };
  walk(root);
  return out.sort();
}

const isTestFile = (f) => /(\.|\/)(test|spec)\.[tj]sx?$/.test(f) || /(^|\/)(tests?|__tests__|__mocks__|e2e|test-utils|fixtures)\//.test(f);

export function detectType(files) {
  return files.some((f) => /(^|\/)electron\//.test(f)) ? 'electron' : 'web';
}

export function detectRouter(files, readFile) {
  if (files.some((f) => /^app\/.*page\.(tsx|jsx|ts|js)$/.test(f))) return 'next-app';
  if (files.some((f) => /^pages\/.*\.(tsx|jsx)$/.test(f))) return 'next-pages';
  if (files.some((f) => !isTestFile(f) && /createBrowserRouter|createHashRouter|<Route\s/.test(readFile(f)))) return 'react-router';
  return 'none';
}

/** package.json 에서 라우터·프레임워크 후보를 뽑는다 — AI 가 "무엇을 찾아야 하는지" 단서(D13). 목록은 힌트용이라 넓게 잡는다. */
const HINT_DEPS = /^(react-router(-dom)?|@tanstack\/(react-|vue-)?router|next|nuxt|vue|vue-router|@angular\/(core|router)|svelte|@sveltejs\/kit|@remix-run\/[a-z-]+|solid-js|@solidjs\/router|astro|qwik|electron|next-auth|wouter|@reach\/router)$/;
export function routerHints(projectRoot) {
  const p = join(projectRoot, 'package.json');
  if (!existsSync(p)) return [];
  let pkg;
  try { pkg = JSON.parse(readFileSync(p, 'utf8')); } catch { return []; } // 망가진 package.json 때문에 인벤토리 전체가 죽으면 안 된다 — 힌트만 포기한다(D13).
  return Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }).filter((d) => HINT_DEPS.test(d)).sort();
}

const GUARD_RE = /RequireAuth|ProtectedRoute|useSession|getServerSession|redirect\(['"]\/login/;
const EXTERNAL_RE = /(window\.open\(|shell\.openExternal\(|signIn\(|https:\/\/accounts\.[^\s'"]+|oauth[\w/]*)/i;

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function reactRouterScreens(files, readFile) {
  const screens = [];
  for (const f of files) {
    if (isTestFile(f)) continue;
    const text = readFile(f);
    if (!/createBrowserRouter|createHashRouter|<Route\s/.test(text)) continue;
    const re = /(?:path:\s*|<Route[^>]*?\bpath=)['"]([^'"]+)['"]([^\n]*)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const restOfLine = m[2];
      screens.push({ route: m[1], file: f, line: lineOf(text, m.index), kind: 'route', authHint: GUARD_RE.test(restOfLine) ? 'guard' : 'unknown' });
    }
  }
  return screens;
}

function nextAppScreens(files, readFile) {
  return files
    .filter((f) => /^app\/.*page\.(tsx|jsx|ts|js)$/.test(f) && !/^app\/api\//.test(f))
    .map((f) => {
      const dir = f.replace(/^app/, '').replace(/\/page\.[tj]sx?$/, '');
      // 라우트 그룹만 남은 경로(app/(marketing)/page.tsx)는 벗기면 빈 문자열 — 루트다.
      const route = dir.replace(/\/\([^)]+\)/g, '') || '/';
      return { route, file: f, line: 1, kind: 'route', authHint: GUARD_RE.test(readFile(f)) ? 'guard' : 'unknown' };
    });
}

function nextPagesScreens(files, readFile) {
  return files
    .filter((f) => /^pages\/.*\.(tsx|jsx)$/.test(f) && !/^pages\/api\//.test(f) && !/\/_(app|document|error)\.[tj]sx$/.test(f))
    .map((f) => {
      let route = f.replace(/^pages/, '').replace(/\.[tj]sx$/, '').replace(/\/index$/, '');
      if (route === '') route = '/';
      return { route, file: f, line: 1, kind: 'route', authHint: GUARD_RE.test(readFile(f)) ? 'guard' : 'unknown' };
    });
}

/** 라우터 없는 앱(Electron 단일 창 등): *Page|*View|*Screen 컴포넌트 정의를 화면 후보로. */
function viewComponentScreens(files, readFile) {
  const screens = [];
  for (const f of files) {
    if (isTestFile(f) || !/\.(tsx|jsx)$/.test(f)) continue;
    const text = readFile(f);
    const re = /(?:export\s+(?:default\s+)?(?:function|const)\s+|^\s*(?:function|const)\s+)([A-Z][A-Za-z0-9]*(?:Page|View|Screen))\b/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      screens.push({ route: `view:${m[1]}`, file: f, line: lineOf(text, m.index), kind: 'view', authHint: 'unknown' });
    }
  }
  return screens;
}

function electronSurfaces(files, readFile) {
  const screens = [];
  const ipc = new Set();
  for (const f of files) {
    if (isTestFile(f) || !/(^|\/)electron\//.test(f)) continue;
    const text = readFile(f);
    let m;
    const winRe = /new BrowserWindow\(/g;
    let n = 0;
    while ((m = winRe.exec(text)) !== null) {
      n++;
      screens.push({ route: n === 1 ? 'window:main' : `window:${basename(f, extname(f))}-${n}`, file: f, line: lineOf(text, m.index), kind: 'window', authHint: 'unknown' });
    }
    const ipcRe = /ipcMain\.(?:handle|on)\(\s*['"]([^'"]+)['"]/g;
    while ((m = ipcRe.exec(text)) !== null) ipc.add(m[1]);
    if (/Menu\.buildFromTemplate/.test(text)) {
      const labelRe = /label:\s*['"]([^'"]+)['"]/g;
      while ((m = labelRe.exec(text)) !== null) {
        screens.push({ route: `menu:${m[1]}`, file: f, line: lineOf(text, m.index), kind: 'menu', authHint: 'unknown' });
      }
    }
  }
  return { screens, ipcChannels: [...ipc].sort() };
}

function externalRedirects(files, readFile) {
  const out = [];
  for (const f of files) {
    if (isTestFile(f)) continue;
    const text = readFile(f);
    const re = new RegExp(EXTERNAL_RE.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      const lineEnd = text.indexOf('\n', m.index);
      out.push({ file: f, line: lineOf(text, m.index), match: text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim() });
    }
  }
  return out;
}

export function surfaceInventory({ projectRoot, type }) {
  projectRoot = resolve(projectRoot);                              // 상대 루트('.')도 받는다 — 출력 경로가 루트 기준으로 남게
  const files = walkSourceFiles(projectRoot);
  const cache = new Map();
  const readFile = (f) => {
    if (!cache.has(f)) cache.set(f, readFileSync(join(projectRoot, f), 'utf8'));
    return cache.get(f);
  };
  const resolvedType = type ?? detectType(files);
  const router = detectRouter(files, readFile);

  let screens = [];
  let ipcChannels = [];
  if (resolvedType === 'electron') {
    const e = electronSurfaces(files, readFile);
    screens.push(...e.screens);
    ipcChannels = e.ipcChannels;
    // 힌트는 최대한 낸다(D13) — 창·메뉴에 더해, 렌더러에서 react-router 를 찾았으면 그 라우트도, *Page|*View 폴백도 함께. 무엇이 화면인지는 AI 가 고른다.
    if (router === 'react-router') screens.push(...reactRouterScreens(files, readFile));
    screens.push(...viewComponentScreens(files, readFile));
  } else if (router === 'react-router') screens = reactRouterScreens(files, readFile);
  else if (router === 'next-app') screens = nextAppScreens(files, readFile);
  else if (router === 'next-pages') screens = nextPagesScreens(files, readFile);
  else screens = viewComponentScreens(files, readFile);

  // route → file → line. 같으면 0 을 돌려 안정 정렬을 깨지 않는다. 로캘에 안 흔들리게 코드포인트 비교(결정적 출력이 이 스크립트의 전제).
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  screens.sort((a, b) => cmp(a.route, b.route) || cmp(a.file, b.file) || a.line - b.line);

  const hints = routerHints(projectRoot);
  // Electron 은 창·메뉴가 기준선이라, 렌더러에서 react-router 를 찾았을 때만 라우터를 감지했다고 말한다(next-* 는 Electron 에서 화면 추출기가 없다).
  const knownRouter = resolvedType === 'electron' ? router === 'react-router' : router !== 'none';
  // 아는 패턴이 하나도 안 잡혔는데 package.json 에 다른 라우터 후보가 있으면 "모른다"(unknown) — none 과 구분해 AI 가 직접 찾게 한다(D13).
  const otherRouterHint = hints.some((h) => !/^(react-router(-dom)?|next|electron|next-auth)$/.test(h));
  const reportedRouter = knownRouter ? router : otherRouterHint ? 'unknown' : 'none';
  const confidence = knownRouter ? 'detected' : 'fallback';
  return { type: resolvedType, router: reportedRouter, confidence, hints, screens, ipcChannels, externalRedirects: externalRedirects(files, readFile) };
}

// ── CLI ───────────────────────────────────────────────────────────────
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  const USAGE = 'Usage: node scripts/surfaceInventory.mjs <projectRoot> [--json] [--type web|electron]\n';
  const args = process.argv.slice(2);
  // 플래그를 먼저 걷어낸다 — '--type electron <root>' 처럼 값이 앞서도 projectRoot 를 오해하지 않게 값 토큰을 건너뛴다.
  const positionals = [];
  let json = false;
  let type;
  let bad = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') json = true;
    else if (a === '--type') type = args[++i];
    else if (a.startsWith('--')) bad = true;
    else positionals.push(a);
  }
  const root = positionals[0] && resolve(process.cwd(), positionals[0]);   // '.' 로 줘도 절대 경로로
  if (bad || !root || !existsSync(root) || (type !== undefined && type !== 'web' && type !== 'electron')) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  const result = surfaceInventory({ projectRoot: root, type });
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else {
    process.stdout.write(`type ${result.type} · router ${result.router} · screens ${result.screens.length} · ipc ${result.ipcChannels.length} · external ${result.externalRedirects.length}\n`);
    for (const s of result.screens) process.stdout.write(`  ${s.kind.padEnd(6)} ${s.route}  ${s.file}:${s.line}${s.authHint === 'guard' ? '  [guard]' : ''}\n`);
    // 이 스크립트는 힌트다(D13) — 라우터를 모르거나 화면이 적으면 사람(AI)이 코드를 직접 따라가야 한다고 출력에서도 말한다.
    if (result.router === 'unknown' || result.router === 'none' || result.screens.length < 3) {
      process.stdout.write(`힌트: 이 스크립트는 아는 패턴만 뽑는다 — 라우터를 모르거나 화면이 적으면 진입 파일부터 import 를 따라가 화면 전환 방식을 직접 찾아라 (hints: ${result.hints.join(', ') || '없음'})\n`);
    }
  }
}
