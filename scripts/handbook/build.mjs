/**
 * 핸드북 빌드 — 게이트 → HTML 조립 → 머메이드 렌더 → 그림 게이트 → PDF.
 * 소비처: /dt-handbook build.
 * 게이트를 두 번 돈다: 그림 오류는 그려 봐야 알 수 있다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown } from '../guide/markdown.mjs';
import { assembleGuideHtml, buildFontCss } from '../guide/assemble.mjs';
import { loadChromium, assetMime } from '../guide/build.mjs';
import { renderToPdf } from './render.mjs';
import { runGate, splitSections } from './gate.mjs';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const readTemplate = () =>
  readFileSync(join(PLUGIN_ROOT, 'templates', 'handbook-theme.html'), 'utf8')
    .replace('{{FIGURES_CSS}}', () => readFileSync(join(PLUGIN_ROOT, 'templates', 'handbook-figures.css'), 'utf8'));

export async function buildHandbook({ projectRoot, pdf = true, onlySection, figures = true, playwrightFrom }) {
  projectRoot = resolve(projectRoot);
  const first = runGate({ projectRoot });
  if (!first.ok) { const e = new Error('GATE_FAILED'); e.findings = first.findings; throw e; }
  const { meta, body, config, structure, handbookDir } = first;

  const excerpt = onlySection !== undefined && onlySection !== null;
  const sections = splitSections(body);
  if (excerpt && !sections[onlySection]) {
    const e = new Error('SECTION_NOT_FOUND');
    e.findings = [{ id: 'G0', level: 'BLOCK', message: `${onlySection}장이 본문에 없다` }];
    throw e;
  }
  // 발췌본은 어느 판에서 뽑았는지 스스로 밝힌다 — 한 달 뒤에 어느 게 최신인지 알아야 한다.
  const content = excerpt
    ? `> 이 문서는 전권 ${meta.version} 에서 ${onlySection}장만 뽑음 (${new Date().toISOString().slice(0, 10)})\n\n${sections[onlySection]}`
    : body;

  const html = assembleGuideHtml({
    markdown: content,
    theme: readTemplate(),
    version: meta.version,
    title: `${config.product} ${meta.version} 개발 핸드북`,
    fontCss: buildFontCss((name) => readFileSync(join(PLUGIN_ROOT, 'templates', 'fonts', name))),
    renderMarkdown,
    resolveAsset: (rel) => {
      const full = join(handbookDir, rel);
      if (!existsSync(full)) throw new Error(`본문이 참조한 그림이 없다: ${rel}`);
      return `data:${assetMime(rel)};base64,${readFileSync(full).toString('base64')}`;
    },
  });

  mkdirSync(handbookDir, { recursive: true });
  const htmlPath = join(handbookDir, excerpt ? `handbook-s${onlySection}.html` : 'handbook.html');
  writeFileSync(htmlPath, html, 'utf8');

  let pdfPath;
  let figureErrors = [];
  if (pdf) {
    const chromium = loadChromium(playwrightFrom ?? projectRoot);
    const suffix = `${excerpt ? `-s${onlySection}` : ''}${figures ? '' : '-draft'}`;
    const out = join(handbookDir, config.pdfName.replace(/\.pdf$/, `${suffix}.pdf`));
    ({ figureErrors } = await renderToPdf({
      html, pdfPath: out, chromium, product: config.product, version: meta.version,
    }));
    if (figures && figureErrors.length > 0) {
      const second = runGate({ projectRoot, figureErrors });
      if (!second.ok) { const e = new Error('GATE_FAILED'); e.findings = second.findings; throw e; }
    }
    pdfPath = out;
  }

  const receipt = {
    version: meta.version,
    baseCommit: structure.baseCommit ?? null,
    figures: (content.match(/<figure>/g) ?? []).length + (content.match(/<pre class="mermaid">|```mermaid/g) ?? []).length,
    excerptOfSection: excerpt ? onlySection : undefined,
    figuresChecked: figures,
    pdf: pdfPath !== undefined,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(handbookDir, 'handbook-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { htmlPath, pdfPath, excerptPath: excerpt ? htmlPath : undefined, receipt, figureErrors };
}

// ── CLI ───────────────────────────────────────────────────────────────
const USAGE = 'Usage: node scripts/handbook/build.mjs <projectRoot> [--gate-only] [--no-pdf] [--no-figures] [--pdf-only-section N] [--playwright-from <dir>]\n';
const isMain = (() => {
  try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  const VALUE_FLAGS = new Set(['--pdf-only-section', '--playwright-from']);
  const root = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(args[i - 1]));
  if (!root) { process.stderr.write(USAGE); process.exit(2); }
  const si = args.indexOf('--pdf-only-section');
  const pi = args.indexOf('--playwright-from');
  const opts = {
    projectRoot: root,
    pdf: !args.includes('--no-pdf') && !args.includes('--gate-only'),
    figures: !args.includes('--no-figures'),
    onlySection: si === -1 ? undefined : Number(args[si + 1]),
    // 대상 프로젝트에 Playwright 가 없을 때 다른 프로젝트의 것을 빌려 쓴다(점검용).
    playwrightFrom: pi === -1 ? undefined : args[pi + 1],
  };

  if (args.includes('--gate-only')) {
    const g = runGate({ projectRoot: resolve(root) });
    for (const f of g.findings) process.stdout.write(`${f.level === 'BLOCK' ? '❌' : '⚠'} [${f.id}] ${f.message}\n`);
    process.stdout.write(g.ok ? '✅ 게이트 통과\n' : `❌ 핸드북 게이트 실패 ${g.findings.filter((f) => f.level === 'BLOCK').length}건\n`);
    process.exit(g.ok ? 0 : 1);
  }

  buildHandbook(opts)
    .then((r) => {
      process.stdout.write(`✅ 핸드북 ${r.receipt.version} — ${r.pdfPath ?? r.htmlPath} (그림 ${r.receipt.figures})\n`);
    })
    .catch((e) => {
      if (e.findings) {
        for (const f of e.findings) process.stdout.write(`${f.level === 'BLOCK' ? '❌' : '⚠'} [${f.id}] ${f.message}\n`);
        process.stdout.write(`❌ 핸드북 게이트 실패 ${e.findings.filter((f) => f.level === 'BLOCK').length}건\n`);
      } else {
        process.stderr.write(`${e.message}\n`);
      }
      process.exit(1);
    });
}
