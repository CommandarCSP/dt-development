import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, statSync, utimesSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseInventory } from '../scripts/guide/inventory.mjs';
import { scaffoldCaptureConfig, planCaptures, runCaptures, applyRedactions, electronDriver, loadElectron } from '../scripts/guide/capture.mjs';

const CLI = fileURLToPath(new URL('../scripts/guide/capture.mjs', import.meta.url));
const nodeCheck = (text) => {
  const dir = mkdtempSync(join(tmpdir(), 'dtcap-check-'));
  const f = join(dir, 'capture.config.mjs');
  writeFileSync(f, text, 'utf8');
  return spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
};

const INV = parseInventory(`---
version: 1.0.0
type: web
product: Demo
stack: { startCommand: "pnpm dev", url: "http://localhost:5173" }
scenarios: []
screens:
  - id: SCR-home
    title: 홈
    route: "/"
    capture: { mode: auto, selector: main }
    publish: true
    source: [code:a.tsx:1]
  - id: SCR-edit
    title: 편집
    route: "/users/me/edit"
    capture: { mode: auto, needs: [logged-in] }
    publish: true
    source: [code:b.tsx:1]
  - id: SCR-oauth
    title: 외부 로그인
    route: external
    capture: { mode: none, reason: 서드파티 }
    publish: true
    source: [user-confirmed]
  - id: SCR-pay
    title: 결제
    route: "/pay"
    capture: { mode: manual }
    publish: true
    source: [user-confirmed]
---
`).inventory;

test('scaffoldCaptureConfig: 새로 만들 때 states 키 = needs 합집합(TODO), start 는 stack 에서', () => {
  const src = scaffoldCaptureConfig({ inventory: INV });
  assert.match(src, /'logged-in':\s*async \(\{ page, env \}\) => \{ \/\* TODO/);
  assert.match(src, /command: "pnpm dev"/);
  assert.match(src, /url: "http:\/\/localhost:5173"/);
  assert.equal(nodeCheck(src).status, 0, nodeCheck(src).stderr);
});

test('planCaptures: auto 만 실행 대상, manual|none 은 skipReason', () => {
  const plan = planCaptures({ inventory: INV });
  assert.deepEqual(plan.map((p) => [p.id, p.mode, p.skipReason ?? null]), [
    ['SCR-home', 'auto', null], ['SCR-edit', 'auto', null], ['SCR-oauth', 'none', '서드파티'], ['SCR-pay', 'manual', 'shots/manual/SCR-pay.png 를 사람이 둔다'],
  ]);
});

test('runCaptures(가짜 드라이버): states 실행 순서, 비어 있는 state 는 skipped, 실패는 그 화면만 failed, 영수증 기록', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dtcap-'));
  mkdirSync(join(dir, 'docs/guide'), { recursive: true });
  const calls = [];
  const driver = {
    async start() { calls.push('start'); },
    async goto(route) { calls.push(`goto ${route}`); if (route === '/boom') throw new Error('nav failed'); },
    async waitFor(sel) { calls.push(`wait ${sel}`); },
    async screenshot(path) { calls.push(`shot ${path}`); writeFileSync(path, 'png'); },
    async close() { calls.push('close'); },
  };
  const config = { start: {}, states: { 'logged-in': async ({ page }) => { calls.push('state logged-in'); } }, screens: {} };
  const plan = [
    { id: 'SCR-home', mode: 'auto', route: '/', needs: [], selector: 'main' },
    { id: 'SCR-edit', mode: 'auto', route: '/users/me/edit', needs: ['logged-in'] },
    { id: 'SCR-x', mode: 'auto', route: '/x', needs: ['seeded'] },          // config.states 에 없음 → skipped
    { id: 'SCR-boom', mode: 'auto', route: '/boom', needs: [] },
    { id: 'SCR-oauth', mode: 'none', route: 'external', needs: [], skipReason: '서드파티' },
  ];
  const r = await runCaptures({ projectRoot: dir, plan, config, driver });
  assert.deepEqual(r.results.map((x) => [x.id, x.status]), [['SCR-home', 'ok'], ['SCR-edit', 'ok'], ['SCR-x', 'skipped'], ['SCR-boom', 'failed'], ['SCR-oauth', 'skipped']]);
  assert.ok(existsSync(join(dir, 'docs/guide/shots/SCR-home.png')));
  assert.ok(calls.indexOf('state logged-in') < calls.indexOf('goto /users/me/edit'));
  assert.equal(calls.filter((c) => c === 'start').length, 1);
  assert.equal(calls.at(-1), 'close');
  const receipt = JSON.parse(readFileSync(r.receiptPath, 'utf8'));
  assert.equal(receipt.captured.length, 2);
  assert.ok(receipt.capturedAt);
});

// ── 병합(재생성 없음) ─────────────────────────────────────────────────
const INV3 = parseInventory(`---
version: 1.0.0
type: web
product: Demo
stack: { startCommand: "pnpm dev", url: "http://localhost:5173" }
scenarios: []
screens:
  - id: SCR-a
    title: 가
    route: "/"
    capture: { mode: auto, needs: [logged-in, seeded] }
    publish: true
    source: [code:a.tsx:1]
  - id: SCR-b
    title: 나
    route: "/b"
    capture: { mode: auto, needs: [has-post] }
    publish: true
    source: [code:b.tsx:1]
---
`).inventory;

const EXISTING = [
  "import { seedDb } from './helpers.mjs';",
  '',
  'export default {',
  '  start: { command: "pnpm dev", url: "http://localhost:5173", readySelector: "#root" },',
  '  viewport: { width: 1280, height: 720 },',
  '  states: {',
  "    'logged-in': async ({ page, env }) => {",
  "      await page.request.post('/api/login', {",
  '        data: { user: env.GUIDE_TEST_USER },   /* TODO: env 이름 확정 */',
  '      });',
  '      // 주석에 닫는 괄호 } 가 있어도 된다',
  '      await page.reload();',
  '    },',
  "    'seeded': async function ({ page }) {",
  '      await seedDb(`$${1}`);',
  "      const a = '$&';",
  "      const b = '$`';",
  '    },',
  '  },',
  '  screens: {',
  "    'SCR-a': { beforeShot: async ({ page }) => { await page.waitForTimeout(50); }, selector: 'main' },",
  '  },',
  '};',
  '',
].join('\n');

test('scaffoldCaptureConfig: 기존 레시피는 재생성하지 않는다 — 빠진 states 키 한 줄만 끼운다', () => {
  const out = scaffoldCaptureConfig({ inventory: INV3, existing: EXISTING });
  const stub = "    'has-post': async ({ page, env }) => { /* TODO: 상태를 만든다 */ },";
  const lines = out.split('\n');
  assert.equal(lines.filter((l) => l === stub).length, 1, out);
  assert.equal(lines.filter((l) => l !== stub).join('\n'), EXISTING, out);
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
});

test('scaffoldCaptureConfig: needs 에 없는 기존 상태는 지우지 않고 경고 주석만 한 번 붙인다', () => {
  const existing = [
    'export default {',
    '  states: {',
    "    'logged-in': async ({ page, env }) => { await page.goto('/login'); },",
    "    'old-thing': async ({ page }) => { await page.goto('/old'); },",
    '  },',
    '};',
    '',
  ].join('\n');
  const once = scaffoldCaptureConfig({ inventory: INV, existing });
  const warn = '// ⚠ 인벤토리 needs 에 없는 상태 — 안 쓰면 직접 지워라';
  assert.equal(once.split('\n').filter((l) => l.trim() === warn).length, 1, once);
  assert.match(once, new RegExp(`    ${warn}\\n    'old-thing': async \\(\\{ page \\}\\) => \\{ await page\\.goto\\('/old'\\); \\},`));
  assert.ok(once.includes("'old-thing': async ({ page }) => { await page.goto('/old'); },"));
  assert.equal(scaffoldCaptureConfig({ inventory: INV, existing: once }), once);        // 두 번 돌려도 주석이 늘지 않는다
  assert.equal(nodeCheck(once).status, 0, nodeCheck(once).stderr);
});

test('scaffoldCaptureConfig: 끼우는 TODO 줄은 기존 파일의 들여쓰기 폭을 따른다', () => {
  const twoSpace = ['export default {', '  states: {', "  'seeded': async ({ page }) => { await page.goto('/seed'); },", '  },', '};', ''].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV, existing: twoSpace });
  assert.match(out, /^ {2}'logged-in': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.ok(out.includes("'seeded': async ({ page }) => { await page.goto('/seed'); },"));
});

test('scaffoldCaptureConfig: states 블록이 없으면 SCAFFOLD_CANNOT_MERGE 로 던진다', () => {
  const existing = 'export default {\n  start: { command: "pnpm dev" },\n};\n';
  assert.throws(() => scaffoldCaptureConfig({ inventory: INV, existing }), (err) => /^SCAFFOLD_CANNOT_MERGE:/.test(err.message));
});

test('scaffoldCaptureConfig: 병합 결과가 문법 오류면 SCAFFOLD_WOULD_BREAK 로 던진다', () => {
  const existing = ['export default {', '  states: {', "    'logged-in': async ({ page, env }) => { const x = (1; },", '  },', '};', ''].join('\n');
  assert.throws(() => scaffoldCaptureConfig({ inventory: INV, existing }), (err) => /^SCAFFOLD_WOULD_BREAK:/.test(err.message) && /그대로 두었다/.test(err.message));
});

test('scaffoldCaptureConfig: 따옴표가 든 startCommand 도 유효한 JS 가 된다', () => {
  const inv = { ...INV, stack: { startCommand: "sh -c 'pnpm dev'", url: 'http://localhost:5173' } };
  const r = nodeCheck(scaffoldCaptureConfig({ inventory: inv }));
  assert.equal(r.status, 0, r.stderr);
});

// ── CLI ───────────────────────────────────────────────────────────────
const INV_MD = `---
version: 1.0.0
type: web
product: Demo
stack: { startCommand: "pnpm dev", url: "http://localhost:5173" }
scenarios: []
screens:
  - id: SCR-edit
    title: 편집
    route: "/e"
    capture: { mode: auto, needs: [logged-in] }
    publish: true
    source: [code:b.tsx:1]
---
`;
function cliProject() {
  const dir = mkdtempSync(join(tmpdir(), 'dtcapcli-'));
  mkdirSync(join(dir, 'docs/guide'), { recursive: true });
  writeFileSync(join(dir, 'docs/guide/inventory.md'), INV_MD, 'utf8');
  writeFileSync(join(dir, 'package.json'), '{ "name": "demo", "version": "2.3.4" }\n', 'utf8');
  return dir;
}

test('CLI: 병합할 수 없으면 레시피를 그대로 두고 exit 2', () => {
  const dir = cliProject();
  const cfg = join(dir, 'docs/guide/capture.config.mjs');
  const before = 'export default {\n  start: { command: "pnpm dev" },\n};\n';
  writeFileSync(cfg, before, 'utf8');
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /레시피를 건드리지 않았다 — SCAFFOLD_CANNOT_MERGE/);
  assert.equal(readFileSync(cfg, 'utf8'), before);
});

test('CLI --json: 진행 줄은 stderr 로 간다(stdout 은 JSON 만)', () => {
  const dir = cliProject();
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only', '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /레시피 갱신/);
  const plain = spawnSync(process.execPath, [CLI, cliProject(), '--scaffold-only'], { encoding: 'utf8' });
  assert.match(plain.stdout, /레시피 갱신/);
});

// ── A5·A6 실행 ────────────────────────────────────────────────────────
test('runCaptures: 영수증에 version(package.json) 이 들어가고, close 가 던져도 영수증은 남는다', async () => {
  const dir = cliProject();
  const driver = {
    async start() {}, async goto() {}, async waitFor() {},
    async screenshot(path) { writeFileSync(path, 'png'); },
    async close() { throw new Error('닫기 실패'); },
  };
  const plan = [{ id: 'SCR-home', mode: 'auto', route: '/', needs: [] }];
  const r = await runCaptures({ projectRoot: dir, plan, config: { start: {}, states: {}, screens: {} }, driver });
  const receipt = JSON.parse(readFileSync(r.receiptPath, 'utf8'));
  assert.equal(receipt.version, '2.3.4');
  assert.equal(receipt.captured.length, 1);

  const noPkg = mkdtempSync(join(tmpdir(), 'dtcap-nopkg-'));
  const r2 = await runCaptures({ projectRoot: noPkg, plan: [], config: { start: {} }, driver: { ...driver, async close() {} } });
  assert.equal(JSON.parse(readFileSync(r2.receiptPath, 'utf8')).version, null);
});

test('runCaptures: start 가 던지면 close 를 부르고 그대로 던진다', async () => {
  const dir = cliProject();
  const calls = [];
  const driver = {
    async start() { calls.push('start'); const e = new Error('PLAYWRIGHT_MISSING: 없다'); throw e; },
    async close() { calls.push('close'); },
  };
  await assert.rejects(runCaptures({ projectRoot: dir, plan: [], config: { start: {} }, driver }), /PLAYWRIGHT_MISSING/);
  assert.deepEqual(calls, ['start', 'close']);
});

// ── A7·A9 드라이버 ────────────────────────────────────────────────────
test('electronDriver.start: playwright 가 없으면 PLAYWRIGHT_MISSING 코드로 던진다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dtcap-el-'));
  writeFileSync(join(dir, 'package.json'), '{ "name": "x", "version": "0.0.0" }\n', 'utf8');
  const d = electronDriver({ projectRoot: dir, viewport: { width: 800, height: 600 } });
  await assert.rejects(d.start({ mainEntry: 'main.js' }), (err) => err.code === 'PLAYWRIGHT_MISSING' && /devDependency/.test(err.message));
});

test('electronDriver.goto: view:/window: 라우트는 자동 이동이 없다고 한 줄 알린다', async () => {
  const d = electronDriver({ projectRoot: '/nowhere', viewport: { width: 800, height: 600 } });
  const out = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { out.push(String(s)); return true; };
  try { await d.goto('view:settings'); } finally { process.stderr.write = orig; }
  assert.match(out.join(''), /view:settings.*자동 이동 없음/);
});

// ── 병합 정밀도(스캐너·닫힘 꼴) ────────────────────────────────────────
test('scaffoldCaptureConfig: export default 앞의 도우미 객체 states 는 건드리지 않는다', () => {
  const existing = [
    "const fixtures = { states: { 'demo-user': { name: 'kim' } } };",
    '',
    'export default {',
    '  start: { command: "pnpm dev" },',
    '  states: {',
    "    'logged-in': async ({ page, env }) => { await page.goto('/login'); },",
    '  },',
    '};',
    '',
  ].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.ok(out.includes("const fixtures = { states: { 'demo-user': { name: 'kim' } } };"), out);
  assert.ok(!out.includes('⚠'), out);                                   // demo-user 는 states 키가 아니다
  const stub = "    'seeded': async ({ page, env }) => { /* TODO: 상태를 만든다 */ },";
  assert.ok(out.includes(stub), out);
  assert.ok(out.indexOf(stub) > out.indexOf('export default'), out);    // export default 블록 안에 들어갔다
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
});

test('scaffoldCaptureConfig: 한 줄로 닫힌 states 도 쉼표·줄바꿈을 맞춰 끼운다', () => {
  const existing = ['export default {', "  states: { 'logged-in': async () => {} },", '};', ''].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.match(out, /^ {4}'has-post': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.match(out, /^ {4}'seeded': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.match(out, /^ {2}states: \{ 'logged-in': async \(\) => \{\},$/m);
  assert.match(out, /^ {2}\},$/m);                                      // 닫는 괄호는 states 줄 들여쓰기로 제자리
});

test('scaffoldCaptureConfig: 빈 states 블록에도 states 줄 들여쓰기 + 2 로 끼운다', () => {
  const existing = ['export default {', '  states: {},', '};', ''].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.match(out, /^ {4}'logged-in': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.match(out, /^ {2}states: \{$/m);
  assert.match(out, /^ {2}\},$/m);
});

test('scaffoldCaptureConfig: 병합 실패 메시지는 흔한 원인을 함께 알린다', () => {
  const noStates = 'export default {\n  start: { command: "pnpm dev" },\n};\n';
  assert.throws(() => scaffoldCaptureConfig({ inventory: INV, existing: noStates }), /흔한 원인: 마지막 항목의 쉼표 누락, 정규식 리터럴·중첩 템플릿 리터럴/);
  const broken = ['export default {', '  states: {', "    'logged-in': async ({ page, env }) => { const x = (1; },", '  },', '};', ''].join('\n');
  assert.throws(() => scaffoldCaptureConfig({ inventory: INV, existing: broken }), /정규식 리터럴·중첩 템플릿 리터럴/);
});

test('CLI: TODO 개수는 끼운 스텁만 센다(사람이 쓴 다른 TODO 는 안 센다)', () => {
  const dir = cliProject();
  writeFileSync(join(dir, 'docs/guide/capture.config.mjs'), [
    'export default {',
    '  states: {',
    "    'seeded': async ({ page }) => { /* TODO: env 이름 확정 */ },",
    '  },',
    '};',
    '',
  ].join('\n'), 'utf8');
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /TODO 1개/);
});

test('CLI: 병합해도 그대로면 레시피를 다시 쓰지 않는다', () => {
  const dir = cliProject();
  const cfg = join(dir, 'docs/guide/capture.config.mjs');
  const before = ['export default {', '  states: {', "    'logged-in': async ({ page }) => { await page.goto('/login'); },", '  },', '};', ''].join('\n');
  writeFileSync(cfg, before, 'utf8');
  utimesSync(cfg, new Date(6e11), new Date(6e11));
  const mtime = statSync(cfg).mtimeMs;
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /· 레시피 변경 없음/);
  assert.equal(readFileSync(cfg, 'utf8'), before);
  assert.equal(statSync(cfg).mtimeMs, mtime);
});

// ── 상대 경로 루트 ────────────────────────────────────────────────────
test('CLI: 프로젝트 폴더 안에서 루트를 . 로 줘도 레시피가 만들어진다', () => {
  const dir = cliProject();
  const r = spawnSync(process.execPath, [CLI, '.', '--scaffold-only'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'docs/guide/capture.config.mjs')));
});

test('loadElectron: 상대 경로 루트를 절대 경로로 바꿔 찾는다 — createRequire 가 죽지 않는다', () => {
  assert.throws(() => loadElectron('.'), (err) => err.code === 'PLAYWRIGHT_MISSING');
});

test('scaffoldCaptureConfig: 닫는 괄호가 제 줄에 있어도 마지막 항목의 쉼표 누락을 채워 준다', () => {
  const existing = ['export default {', '  states: {', "    'logged-in': async () => {}", '  },', '};', ''].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.match(out, /^ {4}'logged-in': async \(\) => \{\},$/m);            // 쉼표를 붙여 준다
  assert.match(out, /^ {4}'seeded': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.match(out, /^ {4}'has-post': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
  assert.match(out, /^ {2}\},$/m);                                        // 닫는 괄호는 제자리
});

test('scaffoldCaptureConfig: export default 와 { 사이의 주석을 넘어간다', () => {
  const block = ['export default /* 캡처 레시피 */ {', '  states: {', "    'logged-in': async ({ page }) => { await page.goto('/login'); },", '  },', '};', ''].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing: block });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.match(out, /^ {4}'seeded': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);

  const line = ['export default   // 캡처 레시피', '{', '  states: {', "    'logged-in': async ({ page }) => { await page.goto('/login'); },", '  },', '};', ''].join('\n');
  const out2 = scaffoldCaptureConfig({ inventory: INV3, existing: line });
  assert.equal(nodeCheck(out2).status, 0, nodeCheck(out2).stderr);
  assert.match(out2, /^ {4}'has-post': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/m);
});

// ── 닫는 괄호 앞 주석 ─────────────────────────────────────────────────
const STUB_RE = /^ {4}'(has-post|seeded)': async \(\{ page, env \}\) => \{ \/\* TODO: 상태를 만든다 \*\/ \},$/;

test('scaffoldCaptureConfig: 마지막 항목 뒤 줄 주석에는 쉼표를 붙이지 않는다(쉼표는 코드 뒤에)', () => {
  const existing = [
    'export default {',
    "  states: { 'logged-in': async ({ page }) => {}   // 설명",
    '  },',
    '};',
    '',
  ].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.match(out, /\{\},   \/\/ 설명\n/);                                  // 쉼표는 코드 뒤, 주석은 그대로
  assert.ok(!/\/\/ 설명,/.test(out), out);
  assert.equal(out.split('\n').filter((l) => STUB_RE.test(l)).length, 2, out);
});

test('scaffoldCaptureConfig: 닫는 괄호 앞 블록 주석이 있어도 병합된다', () => {
  const existing = [
    'export default {',
    "  states: { 'logged-in': async ({ page }) => {},",
    '    /* 다음 판 */',
    '  },',
    '};',
    '',
  ].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.ok(out.includes('    /* 다음 판 */\n'), out);
  assert.equal(out.split('\n').filter((l) => STUB_RE.test(l)).length, 2, out);
});

test('scaffoldCaptureConfig: 쉼표가 이미 있으면 꼬리 줄 주석은 한 글자도 바뀌지 않는다', () => {
  const existing = [
    'export default {',
    '  states: {',
    "    'logged-in': async ({ page }) => {},   // 로그인시킨다",
    '  },',
    '};',
    '',
  ].join('\n');
  const out = scaffoldCaptureConfig({ inventory: INV3, existing });
  assert.equal(nodeCheck(out).status, 0, nodeCheck(out).stderr);
  assert.ok(out.includes("    'logged-in': async ({ page }) => {},   // 로그인시킨다\n"), out);
  assert.equal(out.split('\n').filter((l) => STUB_RE.test(l)).length, 2, out);
});

// ── 사후 검증: 새 키가 정말 states 안에 들어갔나 ──────────────────────
const REGEX_TRAP = [
  'export default {',
  '  states: {',
  "    'logged-in': async ({ page }) => { if (/[{]/.test('x')) return; },",
  '  },',
  '};',
  '',
].join('\n');

test('scaffoldCaptureConfig: 새 키가 states 밖으로 나가면 SCAFFOLD_WOULD_BREAK 로 던진다(정규식 속 여는 괄호)', () => {
  assert.throws(
    () => scaffoldCaptureConfig({ inventory: INV3, existing: REGEX_TRAP }),
    (err) => /^SCAFFOLD_WOULD_BREAK: 병합 결과에서 새 상태 /.test(err.message) && /states 블록 안에 들어가지 않았다/.test(err.message),
  );
});

test('CLI: 새 키가 states 밖으로 나가면 레시피를 그대로 두고 exit 2', () => {
  const dir = cliProject();
  const inv = join(dir, 'docs/guide/inventory.md');
  writeFileSync(inv, readFileSync(inv, 'utf8').replace('needs: [logged-in]', 'needs: [logged-in, seeded]'), 'utf8');
  const cfg = join(dir, 'docs/guide/capture.config.mjs');
  writeFileSync(cfg, REGEX_TRAP, 'utf8');
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /레시피를 건드리지 않았다 — SCAFFOLD_WOULD_BREAK/);
  assert.equal(readFileSync(cfg, 'utf8'), REGEX_TRAP);
});

test('CLI: 인벤토리가 없으면 한 줄로 안내하고 exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dtcapcli-noinv-'));
  const r = spawnSync(process.execPath, [CLI, dir, '--scaffold-only'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^❌ docs\/guide\/inventory\.md 가 없다 — \/dt-guide analyze 를 먼저 돌려라\.\n$/);
});

// ── G6 재료 — 찍은 화면의 글자 ─────────────────────────────────────────

function shotTextFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'dtcap-text-'));
  mkdirSync(join(dir, 'docs/guide'), { recursive: true });
  const calls = [];
  const driver = {
    async start() {},
    async goto() {},
    async waitFor() {},
    async redact(list) { calls.push(`redact ${JSON.stringify(list)}`); },
    async text() { calls.push('text'); return '연결됨 a@b.com'; },
    async screenshot(path) { calls.push('shot'); writeFileSync(path, 'png'); },
    async close() {},
  };
  return { dir, calls, driver };
}

test('캡처 — 찍은 화면의 글자를 .txt 로 남긴다 (G6 가 OCR 없이 읽는 재료)', async () => {
  const { dir, driver } = shotTextFixture();
  await runCaptures({ projectRoot: dir, plan: planCaptures({ inventory: INV }), config: { states: {} }, driver });
  assert.equal(readFileSync(join(dir, 'docs/guide/shots/SCR-home.txt'), 'utf8'), '연결됨 a@b.com');
});

test('캡처 — redact 는 찍기 전에 적용된다 (가린 뒤의 화면이 찍혀야 한다)', async () => {
  const { dir, calls, driver } = shotTextFixture();
  const redact = [{ selector: '[data-identity]', text: '사용자 계정' }];
  await runCaptures({
    projectRoot: dir,
    plan: planCaptures({ inventory: INV }),
    config: { states: {}, screens: { 'SCR-home': { redact } } },
    driver,
  });
  const at = calls.indexOf(`redact ${JSON.stringify(redact)}`);
  assert.notEqual(at, -1, `redact 가 불리지 않았다: ${calls.join(' → ')}`);
  assert.ok(at < calls.indexOf('shot'), calls.join(' → '));
});

test('redact 스크립트 — match 가 있으면 그 글자를 품은 요소만 바꾼다 (다른 안내 문구를 지우지 않는다)', () => {
  const doc = {
    'span.muted': [
      { textContent: 'someone@example.com · ACME' },
      { textContent: '여기서 바꾸면 모든 프로젝트에 적용됩니다.' },
    ],
  };
  applyRedactions(doc, [{ selector: 'span.muted', match: '@', text: '사용자 계정 · 조직' }]);
  assert.equal(doc['span.muted'][0].textContent, '사용자 계정 · 조직');
  assert.equal(doc['span.muted'][1].textContent, '여기서 바꾸면 모든 프로젝트에 적용됩니다.');
});

test('redact 스크립트 — match 가 없으면 선택자에 걸린 것을 전부 바꾼다', () => {
  const doc = { p: [{ textContent: 'a' }, { textContent: 'b' }] };
  applyRedactions(doc, [{ selector: 'p', text: 'X' }]);
  assert.deepEqual(doc.p.map((e) => e.textContent), ['X', 'X']);
});

test('캡처 — 글자를 못 읽어도 그림은 남긴다 (텍스트 덤프가 캡처를 죽이지 않는다)', async () => {
  const { dir, driver } = shotTextFixture();
  driver.text = async () => { throw new Error('detached'); };
  const r = await runCaptures({ projectRoot: dir, plan: planCaptures({ inventory: INV }), config: { states: {} }, driver });
  assert.equal(r.results[0].status, 'ok');
  assert.ok(existsSync(join(dir, 'docs/guide/shots/SCR-home.png')));
});

test('CLI: 모르는 플래그는 usage 와 exit 2', () => {
  const r = spawnSync(process.execPath, [CLI, cliProject(), '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^Usage: node scripts\/guide\/capture\.mjs/);
  assert.equal(r.stdout, '');
});
