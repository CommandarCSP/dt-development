/**
 * 캡처 — 레시피 스캐폴딩(순수) + 실행(Playwright, 격리). 스펙 §6.
 * 드라이버는 주입 가능(테스트는 가짜). 실패한 화면은 그 화면만 failed 로 남기고 계속한다.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseInventory } from './inventory.mjs';
import { loadChromium } from './build.mjs';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ── 스캐폴딩 ──────────────────────────────────────────────────────────
const IDENT = /[A-Za-z0-9_$]/;
const UNUSED_WARN = '// ⚠ 인벤토리 needs 에 없는 상태 — 안 쓰면 직접 지워라';
const TODO_MARK = '/* TODO: 상태를 만든다 */';
const STUB = (indent, name) => `${indent}'${name}': async ({ page, env }) => { ${TODO_MARK} },`;
const SCANNER_LIMIT = ' (흔한 원인: 마지막 항목의 쉼표 누락, 정규식 리터럴·중첩 템플릿 리터럴 — 그 줄을 단순하게 바꾸고 다시 돌려라)';

/**
 * i 가 문자열·줄 주석·블록 주석의 시작이면 그 끝 다음 인덱스, 아니면 -1.
 * 한계: 정규식 리터럴(`/…/`)은 줄 주석·나눗셈과 구별하지 않고, 템플릿 리터럴 안의 `${…}`도 들여다보지 않는다.
 * 그래서 `/[{'"]/` 같은 정규식이나 `` `${`x`}` `` 같은 중첩 템플릿이 있으면 괄호 세기가 어긋날 수 있다.
 */
function skipNoise(src, i) {
  const ch = src[i];
  if (ch === "'" || ch === '"' || ch === '`') {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') { j++; continue; }
      if (src[j] === ch) return j + 1;
    }
    return src.length;
  }
  if (ch === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); return n === -1 ? src.length : n; }
  if (ch === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); return n === -1 ? src.length : n + 2; }
  return -1;
}

/**
 * `{` 에서 시작해 균형이 맞는 `}` 의 위치. 문자열과 주석(줄·블록) 안의 괄호는 세지 않는다. 없으면 -1.
 * 한계: `skipNoise` 가 정규식 리터럴과 중첩 템플릿 리터럴을 모르니, 그런 줄이 있으면 균형 계산이 틀릴 수 있다.
 * 그래서 병합 결과는 언제나 `node --check` 로 다시 본다(SCAFFOLD_WOULD_BREAK).
 */
function matchBrace(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const j = skipNoise(src, i);
    if (j !== -1) { i = j - 1; continue; }
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

/**
 * `export default {` 의 여는 괄호 위치. 문자열·주석 속 글자는 보지 않는다. 없으면 -1.
 * `default` 와 `{` 사이의 주석(`/* … *\/`·`// …`)은 건너뛴다 — `export default /* 레시피 *\/ {` 꼴도 찾는다.
 */
function findExportDefaultBrace(src) {
  for (let i = 0; i < src.length; i++) {
    const j = skipNoise(src, i);
    if (j !== -1) { i = j - 1; continue; }
    if (!src.startsWith('export', i)) continue;
    if (IDENT.test(src[i - 1] ?? '')) continue;
    let k = i + 6;
    if (!/\s/.test(src[k] ?? '')) continue;
    while (/\s/.test(src[k] ?? '')) k++;
    if (!src.startsWith('default', k)) continue;
    k += 7;
    if (IDENT.test(src[k] ?? '')) continue;
    for (;;) {                                                       // 공백과 주석을 번갈아 넘긴다
      while (/\s/.test(src[k] ?? '')) k++;
      if (src[k] !== '/') break;                                     // 주석만 넘긴다 — 다른 글자면 거기서 판단한다
      const c = skipNoise(src, k);
      if (c === -1) break;
      k = c;
    }
    if (src[k] !== '{') continue;                                    // export default makeConfig(…) 꼴은 다루지 않는다
    return k;
  }
  return -1;
}

/**
 * `export default { … }` 바로 아래 깊이(깊이 1)의 `states: {` 여는·닫는 괄호 위치. 못 찾으면 null.
 * 앞에 나오는 도우미 객체의 `states`(예: `const fixtures = { states: … }`)나 중첩 객체의 `states` 는 건너뛴다.
 */
function findStatesBlock(src) {
  const start = findExportDefaultBrace(src);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const j = skipNoise(src, i);
    if (j !== -1) { i = j - 1; continue; }
    const ch = src[i];
    if (ch === '{') { depth++; continue; }
    if (ch === '}') { if (--depth === 0) return null; continue; }     // export default 객체가 닫혔다
    if (depth !== 1) continue;
    if (!src.startsWith('states', i)) continue;
    if (IDENT.test(src[i - 1] ?? '') || IDENT.test(src[i + 6] ?? '')) continue;
    let k = i + 6;
    while (/\s/.test(src[k] ?? '')) k++;
    if (src[k] !== ':') continue;
    for (k++; /\s/.test(src[k] ?? ''); k++);
    if (src[k] !== '{') continue;
    const close = matchBrace(src, k);
    return close === -1 ? null : { open: k, close };
  }
  return null;
}

/**
 * `{` 다음부터 `close` 직전까지 훑어 **마지막 실제 토큰 다음 인덱스**를 돌려준다.
 * 공백과 주석(줄·블록)은 토큰이 아니다 — 꼬리 주석 앞에 끼워 넣으려고 쓴다.
 * 블록이 비어 있으면 여는 `{` 바로 뒤를 돌려준다.
 */
function lastRealTokenEnd(src, open, close) {
  let end = open + 1;                                              // 여는 `{` 자신이 첫 토큰
  for (let i = open + 1; i < close; i++) {
    const ch = src[i];
    if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) { i = skipNoise(src, i) - 1; continue; }  // 주석은 건너뛴다(토큰으로 세지 않는다)
    if (ch === "'" || ch === '"' || ch === '`') { const j = Math.min(skipNoise(src, i), close); end = j; i = j - 1; continue; }
    if (/\s/.test(ch)) continue;
    end = i + 1;
  }
  return end;
}

/** states 블록 바로 아래 깊이의 키만 훑는다(중첩된 객체의 키는 세지 않는다). */
function topLevelStateKeys(src, open, close) {
  const out = [];
  let depth = 0;
  for (let i = open + 1; i < close; i++) {
    const ch = src[i];
    if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) { i = skipNoise(src, i) - 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = skipNoise(src, i);
      if (depth === 0 && ch !== '`') {
        let k = end;
        while (/\s/.test(src[k] ?? '')) k++;
        if (src[k] === ':') out.push({ name: src.slice(i + 1, end - 1), at: i });
      }
      i = end - 1;
      continue;
    }
    if (IDENT.test(ch)) {
      let k = i;
      while (k < close && IDENT.test(src[k])) k++;
      if (depth === 0 && !/^[0-9]/.test(ch)) {
        let m = k;
        while (/\s/.test(src[m] ?? '')) m++;
        if (src[m] === ':') out.push({ name: src.slice(i, k), at: i });
      }
      i = k - 1;
      continue;
    }
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
  }
  return out;
}

/** 결과가 파싱되는 JS 인지 node --check 로 본다(임시 파일). 문제없으면 null, 있으면 첫 줄 이유. */
function syntaxError(text) {
  const dir = mkdtempSync(join(tmpdir(), 'dtguide-check-'));
  try {
    const f = join(dir, 'capture.config.mjs');
    writeFileSync(f, text, 'utf8');
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.error) throw new Error(`NODE_CHECK_FAILED: node --check 를 돌리지 못했다 — ${r.error.message}`);
    if (r.status === 0) return null;
    return (r.stderr ?? '').split('\n').find((l) => /Error/.test(l)) ?? '문법 오류';
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * 기존 레시피를 다시 만들지 않는다 — 빠진 states 키만 TODO 줄로 끼우고, needs 에 없는 상태 위에는 경고 주석만 붙인다.
 * 그 밖의 모든 바이트(import·start·viewport·screens·주석)는 손대지 않는다.
 */
function mergeCaptureConfig(existing, needs) {
  const block = findStatesBlock(existing);
  if (!block) {
    const hint = findExportDefaultBrace(existing) === -1 ? '' : SCANNER_LIMIT;   // export default 자체가 없으면 스캐너 한계 얘기가 아니다
    throw new Error(`SCAFFOLD_CANNOT_MERGE: 기존 레시피에서 export default 의 states 블록을 찾지 못했다 — states: { … } 를 직접 유지하거나 파일을 옮기고 다시 돌려라${hint}`);
  }
  const keys = topLevelStateKeys(existing, block.open, block.close);
  const lineStartOf = (at) => existing.lastIndexOf('\n', at) + 1;
  const indentOf = (at) => existing.slice(lineStartOf(at), at).match(/^[ \t]*/)[0];
  const prevLineOf = (ls) => (ls === 0 ? '' : existing.slice(existing.lastIndexOf('\n', ls - 2) + 1, ls - 1));
  const statesLine = lineStartOf(block.open);
  const statesIndent = existing.slice(statesLine).match(/^[ \t]*/)[0];  // `states:` 가 있는 줄의 들여쓰기
  const ownLineKey = keys.find((k) => lineStartOf(k.at) !== statesLine);
  const indent = ownLineKey ? indentOf(ownLineKey.at) : `${statesIndent}  `;   // 한 줄·빈 블록이면 states 줄 + 2

  const edits = [];                                                // 뒤에서부터 끼워 넣으려고 위치만 모아 둔다
  for (const k of keys) {                                          // 안 쓰는 상태도 지우지 않는다 — 경고 한 줄만
    if (needs.includes(k.name)) continue;
    const ls = lineStartOf(k.at);
    if (prevLineOf(ls).trim() === UNUSED_WARN) continue;
    edits.push({ at: ls, text: `${indentOf(k.at)}${UNUSED_WARN}\n` });
  }
  const have = new Set(keys.map((k) => k.name));
  const missing = needs.filter((n) => !have.has(n));
  if (missing.length) {
    const stubs = missing.map((n) => STUB(indent, n)).join('\n');
    const ls = lineStartOf(block.close);
    const at = lastRealTokenEnd(existing, block.open, block.close);    // 마지막 **실제** 토큰 바로 뒤 — 꼬리 주석·공백 앞
    const last = existing[at - 1];
    const comma = last === ',' || last === '{' ? '' : ',';             // 앞 항목이 쉼표 없이 끝났으면 넣어 준다(주석에는 절대 안 붙는다)
    const tailNoise = existing.slice(at, block.close).trim() !== '';   // 마지막 토큰과 닫는 괄호 사이에 주석이 있다
    if (/^[ \t]*$/.test(existing.slice(ls, block.close))) {            // 닫는 괄호가 제 줄에 있는 파일
      if (comma) edits.push({ at, text: comma });
      edits.push({ at: ls, text: `${stubs}\n` });
    } else if (tailNoise) {                                            // 닫는 괄호가 붙어 있고 그 앞에 주석이 있다 — 주석은 그대로 두고 괄호 앞에만 끼운다
      if (comma) edits.push({ at, text: comma });
      edits.push({ at: block.close, text: `\n${stubs}\n${statesIndent}` });
    } else {                                                           // 닫는 괄호가 한 줄에 붙어 있는 파일 — 쉼표·줄바꿈을 손수 맞춘다
      edits.push({ at, end: block.close, text: `${comma}\n${stubs}\n${statesIndent}` });
    }
  }
  let out = existing;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.end ?? e.at);

  const bad = syntaxError(out);
  if (bad) throw new Error(`SCAFFOLD_WOULD_BREAK: 병합 결과가 문법 오류다 — ${bad}. 기존 파일은 그대로 두었다.${SCANNER_LIMIT}`);
  const lost = notInStates(out, missing);          // 문법은 맞아도 엉뚱한 곳에 끼웠을 수 있다 — 사후 검증
  if (lost.length) throw new Error(`SCAFFOLD_WOULD_BREAK: 병합 결과에서 새 상태 ${lost.join(', ')} 가 states 블록 안에 들어가지 않았다 — 스캐너가 정규식·중첩 템플릿에 헷갈렸을 수 있다. 그 줄을 단순하게 바꾸고 다시 돌려라. 기존 파일은 그대로 두었다.`);
  return out;
}

/** 병합 결과를 다시 훑어 `names` 중 states 깊이 1 에 없는 것을 돌려준다(경계가 어긋나면 전부 실패로 본다). */
function notInStates(text, names) {
  if (!names.length) return [];
  const open = findExportDefaultBrace(text);
  const outerClose = open === -1 ? -1 : matchBrace(text, open);
  const block = findStatesBlock(text);
  if (outerClose === -1 || !block || block.close >= outerClose) return [...names];   // export default 객체 안에 states 가 닫히지 않았다
  const have = new Set(topLevelStateKeys(text, block.open, block.close).map((k) => k.name));
  return names.filter((n) => !have.has(n));
}

export function scaffoldCaptureConfig({ inventory, existing }) {
  const needs = [...new Set(inventory.screens.flatMap((s) => s.capture?.needs ?? []))].sort();
  if (existing) return mergeCaptureConfig(existing, needs);

  const tmpl = readFileSync(join(PLUGIN_ROOT, 'templates', 'capture.config.mjs.tmpl'), 'utf8');
  const states = needs.map((n) => STUB('    ', n)).join('\n');
  const st = inventory.stack ?? {};
  const q = (v) => JSON.stringify(String(v));                      // 명령·URL 에 든 따옴표가 레시피를 깨뜨리지 않게
  const start = inventory.type === 'electron'
    ? `{ command: ${q(st.startCommand ?? 'npm start')}, mainEntry: ${q(st.mainEntry ?? 'dist/electron/main.js')} }`
    : `{ command: ${q(st.startCommand ?? 'npm run dev')}, url: ${q(st.url ?? 'http://localhost:5173')}, readySelector: ${q(st.readySelector ?? '#root')} }`;
  const screens = inventory.screens.filter((s) => s.capture?.mode === 'auto').map((s) => `    // '${s.id}': { beforeShot: async ({ page, driver }) => {}, selector: ${q(s.capture.selector ?? 'body')} },`).join('\n');
  return tmpl.replace('{{START}}', () => start).replace('{{STATES}}', () => states).replace('{{SCREENS}}', () => screens);
}

/**
 * 찍기 직전의 글자 대체 — **순수 함수**다(브라우저 안에서도 같은 규칙이 돌게
 * 문자열로 넘겨 실행한다). `doc` 는 선택자 → 요소 배열 맵이라 테스트가 DOM 없이
 * 같은 판정을 돌린다.
 *
 * `match` 가 있으면 **그 글자를 품은 요소만** 바꾼다. 남의 앱에서 선택자만으로
 * 겨누면 옆의 안내 문구까지 지우기 쉽다 — 가리려는 값 자체로 겨누는 편이 정확하다.
 */
export function applyRedactions(doc, items) {
  for (const { selector, match, text } of items) {
    for (const el of doc[selector] ?? []) {
      if (match !== undefined && !String(el.textContent ?? '').includes(match)) continue;
      el.textContent = text;
    }
  }
}

export function planCaptures({ inventory }) {
  return inventory.screens.filter((s) => s.publish).map((s) => {
    const c = s.capture;
    const base = { id: s.id, mode: c.mode, route: s.route, needs: c.needs ?? [], ...(c.selector ? { selector: c.selector } : {}) };
    if (c.mode === 'none') return { ...base, skipReason: c.reason };
    if (c.mode === 'manual') return { ...base, skipReason: `shots/manual/${s.id}.png 를 사람이 둔다` };
    return base;
  });
}

// ── 실행 ──────────────────────────────────────────────────────────────
function readProjectVersion(projectRoot) {
  try { const v = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version; return typeof v === 'string' ? v : null; } catch { return null; }
}

export async function runCaptures({ projectRoot, plan, config, driver }) {
  const shotsDir = join(projectRoot, 'docs', 'guide', 'shots');
  mkdirSync(shotsDir, { recursive: true });
  const results = [];
  try {
    await driver.start(config.start ?? {});                        // 실패해도 close 는 부른다(브라우저가 떠 있을 수 있다)
    for (const p of plan) {
      if (p.mode !== 'auto') { results.push({ id: p.id, mode: p.mode, status: 'skipped', reason: p.skipReason }); continue; }
      const missing = p.needs.filter((n) => typeof config.states?.[n] !== 'function');
      if (missing.length) { results.push({ id: p.id, mode: p.mode, status: 'skipped', reason: `capture.config states 에 ${missing.join(', ')} 이 없다(TODO 를 채워라)` }); continue; }
      try {
        for (const n of p.needs) await config.states[n]({ page: driver.page, env: process.env, driver });
        await driver.goto(p.route);
        const over = config.screens?.[p.id] ?? {};
        const selector = over.selector ?? p.selector;
        if (selector) await driver.waitFor(selector);
        if (typeof over.beforeShot === 'function') await over.beforeShot({ page: driver.page, driver });
        // 가린 뒤에 찍는다 — 순서가 뒤집히면 가리기 전 화면이 파일로 남는다.
        if (Array.isArray(over.redact) && over.redact.length && typeof driver.redact === 'function') {
          await driver.redact(over.redact);
        }
        const path = join(shotsDir, `${p.id}.png`);
        await driver.screenshot(path, { selector, fullPage: over.fullPage === true });
        // 찍는 순간의 글자를 같이 뜬다 — 스크린샷은 DOM 을 그린 것이라 이
        // 텍스트가 곧 그림에 보이는 글자다. G6 가 OCR 없이 이걸 읽는다.
        // **여기서 터져도 그림은 남긴다** — 검사 재료를 못 뜬 것이 캡처 실패는 아니다.
        try {
          if (typeof driver.text === 'function') {
            writeFileSync(join(shotsDir, `${p.id}.txt`), await driver.text(selector), 'utf8');
          }
        } catch { /* 글자를 못 읽었다 — G6 는 그 화면을 검사하지 못한다(빌드가 알린다) */ }
        results.push({ id: p.id, mode: p.mode, status: 'ok', path: `shots/${p.id}.png` });
      } catch (err) {
        results.push({ id: p.id, mode: p.mode, status: 'failed', reason: err.message });
      }
    }
  } finally {
    try { await driver.close(); } catch { /* 닫기 실패가 영수증을 막지 않는다 */ }
  }
  const receiptPath = join(shotsDir, 'capture-receipt.json');
  const receipt = { capturedAt: new Date().toISOString(), version: readProjectVersion(projectRoot), captured: results.filter((r) => r.status === 'ok').map((r) => r.id), results };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { results, receiptPath };
}

// ── 실제 드라이버 ─────────────────────────────────────────────────────
export function webDriver({ projectRoot, viewport }) {
  let browser, context;
  const d = {
    page: null,
    async start(start) {
      const chromium = loadChromium(projectRoot);
      browser = await chromium.launch();
      context = await browser.newContext({ viewport });          // 격리: 저장된 세션 없음
      d.page = await context.newPage();
      d.baseUrl = start.url ?? 'http://localhost:5173';
      d.readySelector = start.readySelector;
    },
    async goto(route) { await d.page.goto(new URL(route, d.baseUrl).toString(), { waitUntil: 'load' }); if (d.readySelector) await d.page.waitForSelector(d.readySelector); },
    async waitFor(sel) { await d.page.waitForSelector(sel); },
    async screenshot(path, { selector, fullPage } = {}) { if (selector && selector !== 'body') await d.page.locator(selector).first().screenshot({ path }); else await d.page.screenshot({ path, fullPage }); },
    /** 찍기 직전에 민감한 글자를 대체한다 — 선언형이라 매번 같은 결과가 나온다(G6). */
    async redact(list) {
      await d.page.evaluate(
        ({ items, src }) => {
          const doc = { };
          for (const it of items) doc[it.selector] ??= [...document.querySelectorAll(it.selector)];
          // 판정은 순수 함수(applyRedactions) 한 곳에만 둔다 — 브라우저 안에서도 같은 규칙이 돌아야 한다.
          new Function(`return ${src}`)()(doc, items);
        },
        { items: list, src: applyRedactions.toString() },
      );
    },
    /** 그림에 보이는 글자 — G6 가 OCR 없이 읽는 재료다. */
    async text(selector) {
      const target = selector && selector !== 'body' ? d.page.locator(selector).first() : d.page.locator('body');
      return target.innerText();
    },
    async close() { await browser?.close(); },
  };
  return d;
}

/** loadChromium 과 같은 후보 순서로 _electron 을 찾는다. */
export function loadElectron(fromRoot) {
  fromRoot = resolve(fromRoot);                                    // createRequire 는 절대 경로만 받는다
  const req = createRequire(join(fromRoot, 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try { const m = req(name); if (m._electron) return m._electron; } catch { /* 다음 후보 */ }
  }
  const err = new Error(`PLAYWRIGHT_MISSING: ${fromRoot} 에 playwright/@playwright/test 가 없다 — 대상 프로젝트에 devDependency 로 설치하라(/dt-guide capture 가 설치를 안내한다).`);
  err.code = 'PLAYWRIGHT_MISSING';
  throw err;
}

export function electronDriver({ projectRoot, viewport }) {
  let app;
  const d = {
    page: null,
    async start(start) {
      const _electron = loadElectron(projectRoot);
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;                             // 함정: 이 변수가 있으면 electron 이 Node 로 뜬다(Node 모드로 뜨면 창이 없다).
      const userData = mkdtempSync(join(tmpdir(), 'dtguide-electron-'));
      app = await _electron.launch({ args: [join(projectRoot, start.mainEntry), `--user-data-dir=${userData}`], env });   // 격리: 임시 userData
      d.page = await app.firstWindow();
      await d.page.setViewportSize(viewport);
    },
    async goto(route) {
      if (route.startsWith('view:') || route.startsWith('window:')) { process.stderr.write(`⚠ ${route}: 자동 이동 없음 — states/beforeShot 이 화면을 열어야 한다\n`); return; }
      if (route.startsWith('#') || route.startsWith('/')) await d.page.evaluate((r) => { window.location.hash = r.replace(/^#/, ''); }, route);
    },
    async waitFor(sel) { await d.page.waitForSelector(sel); },
    async screenshot(path, { selector } = {}) { if (selector && selector !== 'body') await d.page.locator(selector).first().screenshot({ path }); else await d.page.screenshot({ path }); },
    /** 찍기 직전에 민감한 글자를 대체한다 — 선언형이라 매번 같은 결과가 나온다(G6). */
    async redact(list) {
      await d.page.evaluate(
        ({ items, src }) => {
          const doc = { };
          for (const it of items) doc[it.selector] ??= [...document.querySelectorAll(it.selector)];
          // 판정은 순수 함수(applyRedactions) 한 곳에만 둔다 — 브라우저 안에서도 같은 규칙이 돌아야 한다.
          new Function(`return ${src}`)()(doc, items);
        },
        { items: list, src: applyRedactions.toString() },
      );
    },
    /** 그림에 보이는 글자 — G6 가 OCR 없이 읽는 재료다. */
    async text(selector) {
      const target = selector && selector !== 'body' ? d.page.locator(selector).first() : d.page.locator('body');
      return target.innerText();
    },
    async close() { await app?.close(); },
  };
  return d;
}

// ── CLI ───────────────────────────────────────────────────────────────
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const USAGE = 'Usage: node scripts/guide/capture.mjs <projectRoot> [--scaffold-only] [--json]\n';
  const positionals = [];
  const flags = new Set();
  for (const a of args) {                                          // 플래그가 루트 앞에 와도 되고, 모르는 플래그는 바로 usage
    if (a === '--scaffold-only' || a === '--json') flags.add(a);
    else if (a.startsWith('--')) { process.stderr.write(USAGE); process.exit(2); }
    else positionals.push(a);
  }
  const root = positionals[0] && resolve(process.cwd(), positionals[0]);   // '.' 로 줘도 절대 경로로 — loadChromium/loadElectron 이 상대 경로를 받으면 죽는다
  if (!root || !existsSync(root)) { process.stderr.write(USAGE); process.exit(2); }
  const guideDir = join(root, 'docs', 'guide');
  let invText;
  try { invText = readFileSync(join(guideDir, 'inventory.md'), 'utf8'); }   // 스택 트레이스 대신 다음 할 일 한 줄
  catch { process.stderr.write('❌ docs/guide/inventory.md 가 없다 — /dt-guide analyze 를 먼저 돌려라.\n'); process.exit(2); }
  const inv = parseInventory(invText);
  if (inv.kind === 'failed') { process.stderr.write(`❌ inventory.md: ${inv.reason}\n`); process.exit(1); }
  const cfgPath = join(guideDir, 'capture.config.mjs');
  const json = flags.has('--json');
  let scaffolded;
  try {
    scaffolded = scaffoldCaptureConfig({ inventory: inv.inventory, existing: existsSync(cfgPath) ? readFileSync(cfgPath, 'utf8') : undefined });
  } catch (err) { process.stderr.write(`❌ 레시피를 건드리지 않았다 — ${err.message}\n`); process.exit(2); }
  const unchanged = existsSync(cfgPath) && readFileSync(cfgPath, 'utf8') === scaffolded;
  if (!unchanged) writeFileSync(cfgPath, scaffolded, 'utf8');            // 바뀐 게 없으면 mtime 도 건드리지 않는다
  const todos = scaffolded.split(TODO_MARK).length - 1;                   // 끼운 스텁만 센다(사람이 쓴 다른 TODO 는 아니다)
  const progress = unchanged ? '· 레시피 변경 없음 — docs/guide/capture.config.mjs\n' : `· 레시피 갱신 — docs/guide/capture.config.mjs (TODO ${todos}개)\n`;
  (json ? process.stderr : process.stdout).write(progress);        // --json 이면 stdout 은 JSON 만
  if (flags.has('--scaffold-only')) process.exit(0);
  const config = (await import(pathToFileURL(cfgPath).href)).default;
  const driver = inv.inventory.type === 'electron' ? electronDriver({ projectRoot: root, viewport: config.viewport }) : webDriver({ projectRoot: root, viewport: config.viewport });
  await runCaptures({ projectRoot: root, plan: planCaptures({ inventory: inv.inventory }), config, driver })
    .then((r) => {
      if (json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
      else for (const x of r.results) process.stdout.write(`  ${x.status.padEnd(7)} ${x.id.padEnd(24)} ${x.mode}${x.reason ? '  — ' + x.reason : ''}\n`);
      process.exit(r.results.some((x) => x.status === 'failed') ? 1 : 0);
    })
    .catch((err) => { process.stderr.write(`❌ ${err.message}\n`); process.exit(2); });   // PLAYWRIGHT_MISSING 등은 한 줄로
}
