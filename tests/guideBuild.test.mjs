import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadGuideConfig } from '../scripts/guide/config.mjs';
import { runGate, buildGuide, loadChromium } from '../scripts/guide/build.mjs';
import { parseGuideSource, koReviewHash } from '../scripts/guide/gate.mjs';

const FIXTURE = fileURLToPath(new URL('./fixtures/guide/project-min/', import.meta.url));
const CLI = fileURLToPath(new URL('../scripts/guide/build.mjs', import.meta.url));
function tmpProject() { const dir = mkdtempSync(join(tmpdir(), 'dtguide-')); cpSync(FIXTURE, dir, { recursive: true }); return dir; }

/**
 * guide.md 본문을 고친 뒤 한글 리뷰 기록을 지금 본문으로 다시 찍는다.
 * G7 은 "리뷰가 지금 글을 봤는가" 를 보므로, G7 이 관심사가 아닌 테스트는
 * 이걸 불러 그 축을 중립으로 만든다(실제 흐름에서는 리뷰를 다시 돌리는 자리다).
 */
function stampReview(dir) {
  const p = join(dir, 'docs/guide/guide.md');
  const { body } = parseGuideSource(readFileSync(p, 'utf8'));
  const rec = { verdict: 'OK', at: new Date().toISOString(), bodyHash: koReviewHash(body) };
  writeFileSync(join(dir, 'docs/guide/ko-review.json'), `${JSON.stringify(rec, null, 2)}\n`, 'utf8');
}

// PDF smoke 는 playwright 패키지와 **내려받은 chromium 실행 파일**이 둘 다 있을 때만 돈다(없으면 skip — `npx playwright install chromium`).
const PLAYWRIGHT_FROM = process.env.DT_GUIDE_PW_FROM ?? fileURLToPath(new URL('../../sample-app/', import.meta.url));   // 레포 안 상대 경로 — 없으면 아래 chromiumReady 가 false 라 skip
const chromiumReady = (() => {
  try { return existsSync(loadChromium(PLAYWRIGHT_FROM).executablePath()); } catch { return false; }
})();

test('loadGuideConfig: .dt-guide.json + 기본값(금칙어는 기본 + 추가)', () => {
  const c = loadGuideConfig(FIXTURE);
  assert.equal(c.product, 'Demo');
  assert.equal(c.pdfName, 'Demo-User-Guide.pdf');
  assert.ok(c.forbiddenMarkers.includes('/Users/') && c.forbiddenMarkers.includes('internal.example.com'));
});
test('runGate: 픽스처는 통과', () => {
  const r = runGate({ projectRoot: FIXTURE });
  assert.equal(r.ok, true);
  assert.equal(r.meta.version, '1.0.0');
});
test('runGate: 인벤토리에 화면을 더하면 G2, 본문에 티켓 키를 넣으면 G5 — findings 를 모아 돌려준다', () => {
  const dir = tmpProject();
  const inv = join(dir, 'docs/guide/inventory.md');
  writeFileSync(inv, readFileSync(inv, 'utf8').replace('screens:\n', 'screens:\n  - id: SCR-extra\n    title: 추가\n    route: "/x"\n    capture: { mode: auto }\n    publish: true\n    source: [code:a.tsx:1]\n'));
  const g = join(dir, 'docs/guide/guide.md');
  writeFileSync(g, readFileSync(g, 'utf8').replace('데모입니다.', '데모입니다. PROJ-43 참고.'));
  stampReview(dir);
  const r = runGate({ projectRoot: dir });
  assert.equal(r.ok, false);
  assert.deepEqual([...new Set(r.findings.map((f) => f.gate))].sort(), ['G2', 'G5']);
});
test('runGate: 한글 리뷰 기록이 없으면 G7 로 막는다', () => {
  const dir = tmpProject();
  rmSync(join(dir, 'docs/guide/ko-review.json'), { force: true });
  const r = runGate({ projectRoot: dir });
  assert.equal(r.ok, false);
  assert.ok(r.findings.some((f) => f.gate === 'G7'), JSON.stringify(r.findings));
});
test('runGate: 리뷰 뒤에 본문을 고치면 G7 로 막는다', () => {
  const dir = tmpProject();
  const g = join(dir, 'docs/guide/guide.md');
  writeFileSync(g, `${readFileSync(g, 'utf8')}\n한 줄 더 붙였다.\n`);
  assert.ok(runGate({ projectRoot: dir }).findings?.some((f) => f.gate === 'G7'));
});
test('runGate: 그림 옆 .txt 에 개인정보가 있으면 G6 로 막는다 — 글 검사(G5)는 그림을 못 본다', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'docs/guide/shots/SCR-home.txt'), '연결됨  someone@example.com · ACME', 'utf8');
  const r = runGate({ projectRoot: dir });
  assert.equal(r.ok, false);
  const g6 = r.findings.filter((f) => f.gate === 'G6');
  assert.equal(g6.length, 1);
  assert.match(g6[0].message, /SCR-home/);
  assert.match(g6[0].message, /someone@example\.com/);
});
test('runGate: allowInShots 에 적으면 그 값은 통과한다', () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'docs/guide/shots/SCR-home.txt'), 'demo@example.com', 'utf8');
  const cfgPath = join(dir, '.dt-guide.json');
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.allowInShots = ['demo@example.com'];
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  assert.equal(runGate({ projectRoot: dir }).ok, true);
});
test('buildGuide --no-pdf: HTML 조립 + 영수증(shotsRefreshed 반영), 이미지 data URI', async () => {
  const dir = tmpProject();
  const r = await buildGuide({ projectRoot: dir, pdf: false, shotsRefreshed: true });
  assert.ok(existsSync(r.htmlPath));
  const html = readFileSync(r.htmlPath, 'utf8');
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('data:font/woff2;base64,'));
  assert.ok(html.includes('<title>Demo 1.0.0 사용 안내</title>'));
  const receipt = JSON.parse(readFileSync(join(dir, 'docs/guide/guide-receipt.json'), 'utf8'));
  assert.equal(receipt.version, '1.0.0');
  assert.equal(receipt.shotsRefreshed, true);
  assert.equal(typeof receipt.sourceHash, 'string');
});
test('CLI: --gate-only 통과 exit 0, 실패 exit 1 + findings 표', () => {
  assert.equal(spawnSync(process.execPath, [CLI, FIXTURE, '--gate-only'], { encoding: 'utf8' }).status, 0);
  const dir = tmpProject();
  const g = join(dir, 'docs/guide/guide.md');
  writeFileSync(g, readFileSync(g, 'utf8').replace('version: 1.0.0\nmanual', 'version: 2.0.0\nmanual'));
  const r = spawnSync(process.execPath, [CLI, dir, '--gate-only'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[G1\]/);
});
test('PDF smoke (대상 프로젝트에 playwright + chromium 이 있을 때만 — DT_GUIDE_PW_FROM)', { skip: !chromiumReady }, async () => {
  const dir = tmpProject();
  // 픽스처엔 playwright 가 없으니 다른 프로젝트의 node_modules 를 빌린다 — 실제 사용에서는 대상 프로젝트 것을 쓴다.
  const r = await buildGuide({ projectRoot: dir, pdf: true, shotsRefreshed: false, playwrightFrom: PLAYWRIGHT_FROM });
  assert.ok(existsSync(r.pdfPath));
  assert.equal(readFileSync(r.pdfPath).subarray(0, 5).toString('ascii'), '%PDF-');
});

// ── G0: 설정·버전을 못 읽으면 게이트가 한 줄로 잡는다(스택 트레이스 금지) ──
test('runGate: package.json 이 없거나 .dt-guide.json 이 깨졌으면 G0 로 실패한다', () => {
  const noPkg = tmpProject();
  rmSync(join(noPkg, 'package.json'));
  const a = runGate({ projectRoot: noPkg });
  assert.equal(a.ok, false);
  assert.deepEqual(a.findings.map((f) => f.gate), ['G0']);
  assert.match(a.findings[0].message, /package\.json 을 읽지 못했다/);

  const bad = tmpProject();
  writeFileSync(join(bad, '.dt-guide.json'), '{ "product": ', 'utf8');
  const b = runGate({ projectRoot: bad });
  assert.equal(b.ok, false);
  assert.match(b.findings[0].message, /\.dt-guide\.json 을 읽지 못했다/);
});

test('CLI --gate-only: 설정 오류도 [G0] 한 줄 + exit 1 (스택 없음)', () => {
  const dir = tmpProject();
  rmSync(join(dir, 'package.json'));
  const r = spawnSync(process.execPath, [CLI, dir, '--gate-only'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\[G0\]/);
  assert.ok(!/at .*build\.mjs/.test(r.stderr), r.stderr);
});

test('CLI: 모르는 플래그는 usage + exit 2, 플래그가 루트 앞에 와도 된다', () => {
  const r = spawnSync(process.execPath, [CLI, FIXTURE, '--nope'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage:/);
  assert.equal(spawnSync(process.execPath, [CLI, '--gate-only', FIXTURE], { encoding: 'utf8' }).status, 0);
});

test('buildGuide: 영수증의 pdf 는 이번 판에 PDF 를 실제로 만들었는지', async () => {
  const dir = tmpProject();
  const r = await buildGuide({ projectRoot: dir, pdf: false, shotsRefreshed: true });
  assert.equal(r.receipt.pdf, false);
});

test('resolveAsset: 확장자로 MIME 을 정한다(.jpg → image/jpeg)', async () => {
  const dir = tmpProject();
  writeFileSync(join(dir, 'docs/guide/shots/extra.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  const g = join(dir, 'docs/guide/guide.md');
  writeFileSync(g, `${readFileSync(g, 'utf8')}\n![추가](shots/extra.jpg)\n`, 'utf8');
  stampReview(dir);
  const r = await buildGuide({ projectRoot: dir, pdf: false, shotsRefreshed: true });
  assert.ok(readFileSync(r.htmlPath, 'utf8').includes('data:image/jpeg;base64,'));
});

// ── 순서: 인벤토리를 guide.md 보다 먼저 본다 — analyze 직후 --gate-only 가 스키마 위반을 잡게 ──
test('runGate: guide.md 가 없어도 인벤토리 스키마 위반을 먼저 알린다', () => {
  const dir = tmpProject();
  rmSync(join(dir, 'docs/guide/guide.md'));
  const inv = join(dir, 'docs/guide/inventory.md');
  writeFileSync(inv, readFileSync(inv, 'utf8').replace('id: SCR-home', 'id: home'), 'utf8');
  const r = runGate({ projectRoot: dir });
  assert.equal(r.ok, false);
  assert.ok(r.findings[0].message.startsWith('inventory.md:'), r.findings[0].message);
});

test('runGate: 인벤토리가 멀쩡하고 guide.md 만 없으면 G0 는 guide.md 한 줄', () => {
  const dir = tmpProject();
  rmSync(join(dir, 'docs/guide/guide.md'));
  const r = runGate({ projectRoot: dir });
  assert.equal(r.ok, false);
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].message, /guide\.md 가 없다/);
});

// ── 상대 경로 루트 ────────────────────────────────────────────────────
test('CLI: 프로젝트 폴더 안에서 루트를 . 로 줘도 게이트가 돈다', () => {
  const dir = tmpProject();
  const r = spawnSync(process.execPath, [CLI, '.', '--gate-only'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('loadChromium: 상대 경로 루트를 절대 경로로 바꿔 찾는다 — createRequire 가 죽지 않는다', () => {
  assert.throws(() => loadChromium('.'), (err) => err.code === 'PLAYWRIGHT_MISSING');
});
