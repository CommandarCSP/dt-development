/**
 * 핸드북 HTML → PDF. 머메이드를 동봉본으로 렌더한 뒤 인쇄한다.
 * 소비처: scripts/handbook/build.mjs. chromium 은 주입받는다(대상 프로젝트에서 해석).
 * 그림 오류는 그려 봐야 알 수 있어 figureErrors 로 모아 게이트에 넘긴다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MERMAID_FILE = 'mermaid-11.4.1.min.js';
const PLUGIN_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
// A4 210mm 에서 좌우 여백 32mm 를 뺀 본문 폭 178mm ≈ 673px(@96dpi).
// 뷰포트를 그 폭으로 잡아야 인쇄된 열과 같은 배치가 나온다. 판정은 여유를 둔 700px.
const A4_CONTENT_PX = 673;
const WIDTH_LIMIT_PX = 700;

export const readMermaidJs = () => readFileSync(join(PLUGIN_ROOT, 'templates', 'vendor', MERMAID_FILE), 'utf8');

export async function renderToPdf({ html, pdfPath, chromium, mermaidJs = readMermaidJs(), product = '', version = '' }) {
  const browser = await chromium.launch();
  try {
    // A4 인쇄 폭으로 재현해 둔다 — 기본 뷰포트(1280px)에서 재면 폭 검사가 무의미하다.
    const page = await browser.newPage({ viewport: { width: A4_CONTENT_PX, height: 1123 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.addScriptTag({ content: mermaidJs }); // 번들 끝줄이 globalThis.mermaid 를 채운다
    const figureErrors = await page.evaluate(async (maxWidth) => {
      const errors = [];
      if (document.querySelectorAll('pre.mermaid').length > 0) {
        window.mermaid.initialize({
          startOnLoad: false, theme: 'neutral', securityLevel: 'strict', fontFamily: 'Pretendard, sans-serif',
        });
        try { await window.mermaid.run({ querySelector: 'pre.mermaid' }); }
        catch (e) { errors.push({ kind: 'mermaid', detail: String((e && e.message) || e) }); }
        for (const el of document.querySelectorAll('pre.mermaid')) {
          if (!el.querySelector('svg')) errors.push({ kind: 'mermaid', detail: el.textContent.slice(0, 80) });
        }
      }
      // 그림 자체를 잰다 — figure 는 블록이라 늘 본문 폭이다.
      for (const fig of document.querySelectorAll('figure, pre.mermaid')) {
        const art = fig.querySelector('svg, img');
        if (!art) continue;
        const w = art.getBoundingClientRect().width;
        if (w > maxWidth) {
          const cap = fig.querySelector('figcaption');
          errors.push({ kind: 'width', detail: `${Math.round(w)}px > ${maxWidth}px`, caption: cap ? cap.textContent : '' });
        }
      }
      for (const fig of document.querySelectorAll('figure')) {
        if (!fig.querySelector('figcaption')) errors.push({ kind: 'caption', detail: fig.innerHTML.slice(0, 80) });
      }
      return errors;
    }, WIDTH_LIMIT_PX);

    await page.evaluate('document.fonts.ready'); // 안 기다리면 조용히 폴백 글꼴로 인쇄된다
    if (pdfPath) {
      await page.pdf({
        path: pdfPath, format: 'A4', printBackground: true,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: true, headerTemplate: '<div></div>',
        footerTemplate: `<div style="width:100%;font-size:8pt;color:#888;padding:0 16mm;font-family:-apple-system,sans-serif;display:flex;justify-content:space-between;"><span>${product} ${version}</span><span class="pageNumber"></span></div>`,
      });
    }
    return { pdfPath, figureErrors };
  } finally { await browser.close(); }
}
