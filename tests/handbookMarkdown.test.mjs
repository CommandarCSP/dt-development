import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../scripts/guide/markdown.mjs';

const FENCE = '```';

test('mermaid 펜스는 pre.mermaid 로 나온다', () => {
  const html = renderMarkdown(`${FENCE}mermaid\nsequenceDiagram\n  A->>B: hi\n${FENCE}`);
  assert.match(html, /<pre class="mermaid">sequenceDiagram\n {2}A-&gt;&gt;B: hi<\/pre>/);
});

test('일반 펜스는 그대로 pre>code 다', () => {
  const html = renderMarkdown(`${FENCE}js\nconst a = 1;\n${FENCE}`);
  assert.match(html, /<pre><code>const a = 1;<\/code><\/pre>/);
  assert.doesNotMatch(html, /class="mermaid"/);
});

test('figure 블록은 빈 줄이 있어도 닫는 태그까지 통과한다', () => {
  const md = '<figure>\n<svg viewBox="0 0 10 10">\n\n<rect x="1" y="1"/>\n</svg>\n<figcaption>설명</figcaption>\n</figure>';
  const html = renderMarkdown(md);
  assert.match(html, /<figcaption>설명<\/figcaption>/);
  assert.match(html, /<rect x="1" y="1"\/>/);
  assert.doesNotMatch(html, /<p>/);
});

test('한 줄짜리 raw HTML 은 예전대로 통과한다', () => {
  assert.match(renderMarkdown('<div class="page-break"></div>'), /<div class="page-break"><\/div>/);
});

test('근거 뱃지 span 은 글자가 아니라 HTML 로 나온다', () => {
  const html = renderMarkdown('근거는 <span class="ev ev-code">코드 a.ts:1</span> 이다.');
  assert.match(html, /<span class="ev ev-code">코드 a\.ts:1<\/span>/);
});

test('그 밖의 인라인 태그는 여전히 글자로 남는다', () => {
  assert.match(renderMarkdown('부등호 a < b 와 <script>x</script> 는 글자다.'), /&lt;script&gt;/);
});
