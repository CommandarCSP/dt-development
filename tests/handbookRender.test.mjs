import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

test('머메이드를 동봉했고 버전이 render.mjs 와 맞다', async () => {
  const { MERMAID_FILE } = await import('../scripts/handbook/render.mjs');
  const p = join(ROOT, 'templates', 'vendor', MERMAID_FILE);
  assert.ok(existsSync(p), `${MERMAID_FILE} 이 없다`);
  assert.ok(statSync(p).size > 1_000_000, '받다 만 파일이다');
  assert.match(readFileSync(join(ROOT, 'templates', 'vendor', 'README.md'), 'utf8'), new RegExp(MERMAID_FILE));
});

test('번들이 globalThis.mermaid 를 채운다', async () => {
  const { MERMAID_FILE } = await import('../scripts/handbook/render.mjs');
  const js = readFileSync(join(ROOT, 'templates', 'vendor', MERMAID_FILE), 'utf8');
  assert.match(js.slice(-500), /globalThis\.mermaid\s*=/);
});

test('테마에 자리표시자 다섯이 있다', () => {
  const theme = readFileSync(join(ROOT, 'templates', 'handbook-theme.html'), 'utf8');
  for (const k of ['{{TITLE}}', '{{VERSION}}', '{{FONT_CSS}}', '{{CONTENT}}', '{{FIGURES_CSS}}']) {
    assert.ok(theme.includes(k), `${k} 가 없다`);
  }
});

test('도형 키트에 어휘 8종과 뱃지 3종이 있다', () => {
  const css = readFileSync(join(ROOT, 'templates', 'handbook-figures.css'), 'utf8');
  for (const c of ['.hb-box', '.hb-store', '.hb-ext', '.hb-boundary', '.hb-lane', '.hb-arrow', '.hb-badge', '.hb-note',
                   '.ev-code', '.ev-doc', '.ev-guess']) {
    assert.ok(css.includes(c), `${c} 가 없다`);
  }
});

test('표본이 렌더되면 mermaid 와 figcaption 이 살아 있다', async () => {
  const { renderMarkdown } = await import('../scripts/guide/markdown.mjs');
  const html = renderMarkdown(readFileSync(join(ROOT, 'tests', 'fixtures', 'handbook-sample.md'), 'utf8'));
  assert.match(html, /<pre class="mermaid">/);
  assert.match(html, /<figcaption>/);
  assert.match(html, /<rect class="hb-box"/);
});
