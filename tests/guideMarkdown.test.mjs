import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../scripts/guide/markdown.mjs';
const r = (md) => renderMarkdown(md).replace(/\n/g, '');

test('헤딩·문단·인라인', () => {
  assert.equal(r('# 제목\n\n본문 **굵게** *기울임* `코드` [링크](https://x.y) 끝.'), '<h1>제목</h1><p>본문 <strong>굵게</strong> <em>기울임</em> <code>코드</code> <a href="https://x.y">링크</a> 끝.</p>');
});
test('이미지는 p 안에 홀로 (테마의 p:has(>img) 캡션 규칙 전제)', () => {
  assert.equal(r('![작업 화면](shots/SCR-workbench.png)\n앱을 열면 보입니다.'), '<p><img alt="작업 화면" src="shots/SCR-workbench.png"></p><p>앱을 열면 보입니다.</p>');
});
test('불릿·번호·중첩', () => {
  assert.equal(r('- 하나\n- 둘\n  - 둘-하나\n\n1. 첫\n2. 둘'), '<ul><li>하나</li><li>둘<ul><li>둘-하나</li></ul></li></ul><ol><li>첫</li><li>둘</li></ol>');
});
test('GFM 표', () => {
  assert.equal(r('| 항목 | 값 |\n| --- | --- |\n| a | `b` |'), '<table><thead><tr><th>항목</th><th>값</th></tr></thead><tbody><tr><td>a</td><td><code>b</code></td></tr></tbody></table>');
});
test('인용·코드 펜스·수평선', () => {
  assert.equal(r('> **주의** — 한 줄\n> 두 줄'), '<blockquote><p><strong>주의</strong> — 한 줄두 줄</p></blockquote>');
  assert.equal(r('```\nnpm run x <y>\n```'), '<pre><code>npm run x &lt;y&gt;</code></pre>');
  assert.equal(r('위\n\n---\n\n아래'), '<p>위</p><hr><p>아래</p>');
});
test('raw HTML 줄은 그대로, 텍스트의 < & 는 이스케이프', () => {
  assert.equal(r('<div class="page-break"></div>\n\n<p class="cover-version">v1</p>\n\na < b & c'), '<div class="page-break"></div><p class="cover-version">v1</p><p>a &lt; b &amp; c</p>');
});
