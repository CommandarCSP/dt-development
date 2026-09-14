/**
 * 가이드 빌드 CLI — 게이트(먼저!) → 조립 → Playwright PDF → 영수증. 기존 TS 구현(scripts/build-guide.mts) 이식.
 * 함정 ①②③④ 는 각 자리에 주석. Playwright 는 대상 프로젝트 node_modules 에서 로드한다(플러그인에 의존 없음).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGuideConfig } from './config.mjs';
import { parseInventory, publishedItems } from './inventory.mjs';
import { parseGuideSource, checkGuide, checkShotText, checkKoReview, extractChangelogItems } from './gate.mjs';
import { renderMarkdown } from './markdown.mjs';
import { assembleGuideHtml, buildFontCss } from './assemble.mjs';
import { collectGuideFiles, computeSourceHash } from './receipt.mjs';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUTPUTS = (pdfName) => [pdfName, 'guide-receipt.json', 'guide.html'];

function readVersion(projectRoot) {
  const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  if (typeof pkg.version !== 'string') throw new Error('package.json 의 version 을 읽지 못했다.');
  return pkg.version;
}

/** 파일 사실만 모아 순수 판정에 넘긴다(함정 ④: 조립 전에 게이트). */
export function runGate({ projectRoot }) {
  projectRoot = resolve(projectRoot);                              // 상대 루트('.')도 받는다 — createRequire 는 절대 경로만 안다
  const guideDir = join(projectRoot, 'docs', 'guide');
  const fail = (reason) => ({ ok: false, findings: [{ gate: 'G0', message: reason }] });
  let appVersion, config;                                          // 읽기 실패도 G0 로 — CLI 가 스택을 토하지 않게
  try { appVersion = readVersion(projectRoot); } catch (err) { return fail(`package.json 을 읽지 못했다 — ${err.message}`); }
  try { config = loadGuideConfig(projectRoot); } catch (err) { return fail(`.dt-guide.json 을 읽지 못했다 — ${err.message}`); }
  if (!existsSync(join(guideDir, 'inventory.md'))) return fail('docs/guide/inventory.md 가 없다 — /dt-guide analyze 를 먼저 돌려라.');
  const inv = parseInventory(readFileSync(join(guideDir, 'inventory.md'), 'utf8'));   // guide.md 보다 먼저 — analyze 직후 --gate-only 가 스키마 위반을 잡게
  if (inv.kind === 'failed') return fail(`inventory.md: ${inv.reason}`);
  if (!existsSync(join(guideDir, 'guide.md'))) return fail('docs/guide/guide.md 가 없다 — /dt-guide write 를 먼저 돌려라.');
  const parsed = parseGuideSource(readFileSync(join(guideDir, 'guide.md'), 'utf8'));
  if (parsed.kind === 'failed') return fail(`guide.md: ${parsed.reason}`);
  const changelogPath = ['CHANGELOG.md', 'CHANGELOG'].map((n) => join(projectRoot, n)).find(existsSync);
  const result = checkGuide({
    meta: parsed.meta, body: parsed.body, appVersion,
    inventoryItems: publishedItems(inv.inventory),
    changelogItems: changelogPath ? extractChangelogItems(readFileSync(changelogPath, 'utf8'), appVersion) : undefined,
    shotExists: (rel) => existsSync(join(guideDir, rel)),
    forbiddenMarkers: config.forbiddenMarkers,
  });
  // G6 — 그림 속 글자. `capture.mjs` 가 찍으면서 남긴 `shots/<id>.txt` 를 읽는다.
  // 그림이 아니라 그 그림을 그린 DOM 의 글자라, OCR 없이 검사할 수 있다.
  // 사람이 둔 manual 그림에는 .txt 가 없다 — 그 화면은 기계가 못 본다(사람 몫).
  const shotFindings = [];
  const shotsDir = join(guideDir, 'shots');
  if (existsSync(shotsDir)) {
    for (const name of readdirSync(shotsDir).filter((n) => n.endsWith('.txt')).sort()) {
      shotFindings.push(
        ...checkShotText({
          id: name.replace(/\.txt$/, ''),
          text: readFileSync(join(shotsDir, name), 'utf8'),
          forbiddenMarkers: config.forbiddenMarkers ?? [],
          allowInShots: config.allowInShots ?? [],
        }),
      );
    }
  }

  // G7 — 한글 리뷰가 지금 이 글을 봤는가. 기록은 리뷰 단계가 남긴다.
  const reviewPath = join(guideDir, 'ko-review.json');
  let review;
  if (existsSync(reviewPath)) {
    try {
      review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    } catch {
      return fail(`docs/guide/ko-review.json 을 읽을 수 없다(JSON 손상).`);
    }
  }
  const reviewFindings = checkKoReview({ review, body: parsed.body });

  const findings = [...(result.ok ? [] : result.findings), ...shotFindings, ...reviewFindings];
  if (findings.length) return { ok: false, findings };
  return { ok: true, meta: parsed.meta, body: parsed.body, inventory: inv.inventory, config, appVersion, guideDir };
}

export function loadChromium(fromRoot) {
  fromRoot = resolve(fromRoot);                                    // createRequire 는 절대 경로만 받는다
  const req = createRequire(join(fromRoot, 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    try { return req(name).chromium; } catch { /* 다음 후보 */ }
  }
  const err = new Error(`PLAYWRIGHT_MISSING: ${fromRoot} 에 playwright/@playwright/test 가 없다 — 대상 프로젝트에 devDependency 로 설치하라(/dt-guide capture 가 설치를 안내한다).`);
  err.code = 'PLAYWRIGHT_MISSING';
  throw err;
}

const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
/** 확장자로 MIME — 모르는 확장자는 octet-stream 으로 넣고 한 줄 알린다(PDF 에서 그림이 비면 여기부터 본다). */
export function assetMime(rel) {
  const ext = (rel.split('.').pop() ?? '').toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  process.stderr.write(`⚠ ${rel}: 그림 형식을 모르겠다(.${ext}) — application/octet-stream 으로 넣는다\n`);
  return 'application/octet-stream';
}

export async function buildGuide({ projectRoot, pdf = true, shotsRefreshed = false, playwrightFrom }) {
  projectRoot = resolve(projectRoot);
  const gate = runGate({ projectRoot });
  if (!gate.ok) { const e = new Error('GATE_FAILED'); e.findings = gate.findings; throw e; }
  const { meta, body, config, appVersion, guideDir } = gate;

  const themePath = existsSync(join(guideDir, 'theme.override.html')) ? join(guideDir, 'theme.override.html') : join(PLUGIN_ROOT, 'templates', 'guide-theme.html');
  const html = assembleGuideHtml({
    markdown: body,
    theme: readFileSync(themePath, 'utf8'),
    version: meta.version,
    title: `${config.product} ${meta.version} 사용 안내`,
    fontCss: buildFontCss((name) => readFileSync(join(PLUGIN_ROOT, 'templates', 'fonts', name))),
    renderMarkdown,
    resolveAsset: (rel) => {
      const full = join(guideDir, rel);
      if (!existsSync(full)) throw new Error(`본문이 참조한 그림이 없다: ${rel} (자동 캡처라면 /dt-guide capture 를 먼저 돌려라)`);
      return `data:${assetMime(rel)};base64,${readFileSync(full).toString('base64')}`;
    },
  });
  mkdirSync(guideDir, { recursive: true });
  const htmlPath = join(guideDir, 'guide.html');
  writeFileSync(htmlPath, html, 'utf8');

  let pdfPath;
  if (pdf) {
    const chromium = loadChromium(playwrightFrom ?? projectRoot);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });          // 함정 ②: file:// 아님 — 전부 인라인
      await page.emulateMedia({ media: 'print' });
      await page.evaluate('document.fonts.ready');                  // 함정 ①: 안 기다리면 조용히 폴백 글꼴
      pdfPath = join(guideDir, config.pdfName);
      await page.pdf({
        path: pdfPath, format: 'A4', printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: true, headerTemplate: '<div></div>',
        footerTemplate: `<div style="width:100%;font-size:8pt;color:#888;padding:0 16mm;font-family:-apple-system,sans-serif;display:flex;justify-content:space-between;"><span>${config.product} ${meta.version}</span><span class="pageNumber"></span></div>`,
      });
    } finally { await browser.close(); }
  }

  const receipt = {
    version: meta.version,
    sourceHash: computeSourceHash(collectGuideFiles(guideDir, OUTPUTS(config.pdfName))),
    shotsRefreshed, pdf: pdfPath !== undefined, builtAt: new Date().toISOString(),
  };
  writeFileSync(join(guideDir, 'guide-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { htmlPath, pdfPath, receipt, appVersion };
}

// ── CLI ───────────────────────────────────────────────────────────────
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const USAGE = 'Usage: node scripts/guide/build.mjs <projectRoot> [--gate-only] [--no-pdf] [--shots-refreshed]\n';
  const positionals = [];
  const flags = new Set();
  for (const a of args) {                                          // 플래그가 루트 앞에 와도 되고, 모르는 플래그는 바로 usage
    if (a === '--gate-only' || a === '--no-pdf' || a === '--shots-refreshed') flags.add(a);
    else if (a.startsWith('--')) { process.stderr.write(USAGE); process.exit(2); }
    else positionals.push(a);
  }
  const root = positionals[0] && resolve(process.cwd(), positionals[0]);   // '.' 로 줘도 절대 경로로
  if (!root || !existsSync(root)) { process.stderr.write(USAGE); process.exit(2); }
  if (flags.has('--gate-only')) {
    const g = runGate({ projectRoot: root });
    if (!g.ok) { process.stderr.write(`❌ 가이드 게이트 실패 ${g.findings.length}건\n` + g.findings.map((f) => `   [${f.gate}] ${f.message}`).join('\n') + '\n'); process.exit(1); }
    process.stdout.write(`✅ 가이드 게이트 통과 — ${g.appVersion} 판, covers ${g.meta.covers.length}건\n`); process.exit(0);
  }
  buildGuide({ projectRoot: root, pdf: !flags.has('--no-pdf'), shotsRefreshed: flags.has('--shots-refreshed') })
    .then((r) => { process.stdout.write(`✅ 가이드 ${r.receipt.version} 완성 — ${r.pdfPath ?? r.htmlPath} (캡처 갱신 ${r.receipt.shotsRefreshed ? '함' : '안 함'})\n`); })
    .catch((err) => {
      if (err.message === 'GATE_FAILED') process.stderr.write(`❌ 가이드 게이트 실패 ${err.findings.length}건\n` + err.findings.map((f) => `   [${f.gate}] ${f.message}`).join('\n') + '\n');
      else process.stderr.write(`❌ ${err.message}\n`);
      process.exit(1);
    });
}
