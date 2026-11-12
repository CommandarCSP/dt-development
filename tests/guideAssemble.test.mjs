import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assembleGuideHtml, buildFontCss, buildToc } from '../scripts/guide/assemble.mjs';
import { renderMarkdown } from '../scripts/guide/markdown.mjs';

const theme = readFileSync(fileURLToPath(new URL('../templates/guide-theme.html', import.meta.url)), 'utf8');

test('테마 자리표시자 4개가 채워지고 이미지 src 가 data URI 로 바뀐다', () => {
  const html = assembleGuideHtml({ markdown: '# T\n\n![a](shots/x.png)\n\n![b](https://cdn/x.png)', theme, version: '1.2.3', title: 'P 1.2.3 사용 안내', fontCss: '/*F*/', renderMarkdown, resolveAsset: (p) => `data:image/png;base64,${Buffer.from(p).toString('base64')}` });
  assert.ok(html.includes('<title>P 1.2.3 사용 안내</title>'));
  assert.ok(html.includes('/*F*/'));
  assert.ok(html.includes(`src="data:image/png;base64,${Buffer.from('shots/x.png').toString('base64')}"`));
  assert.ok(html.includes('src="https://cdn/x.png"'));
  assert.ok(!html.includes('{{'));
});
test('본문 속 {{VERSION}} 문자열은 치환되지 않는다 (CONTENT 를 마지막에 끼우기 때문)', () => {
  const html = assembleGuideHtml({ markdown: '문자 그대로 {{VERSION}}', theme, version: '9.9.9', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.ok(html.includes('data-version="9.9.9"'));
  assert.ok(html.includes('문자 그대로 {{VERSION}}'));
});
test('테마에는 자리표시자가 각각 한 번씩만 있다 (헤더 주석에 중복 없음)', () => {
  for (const ph of ['{{TITLE}}', '{{VERSION}}', '{{FONT_CSS}}', '{{CONTENT}}']) {
    assert.equal(theme.split(ph).length - 1, 1, ph);
  }
});
test('본문 속 HTML 주석 닫기(-->)가 테마 구조를 깨지 않는다', () => {
  const html = assembleGuideHtml({ markdown: '<!-- 참고 -->\n\n본문', theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.ok(html.indexOf('<meta charset') < html.indexOf('<p>본문</p>'));
  assert.equal(html.split('<p>본문</p>').length - 1, 1);
});
test("본문의 $ 패턴($$ $& $' $`)이 치환에 해석되지 않는다", () => {
  const md = '```\necho "pid=$$" && sed "s/a/$&/" && printf $\'\\n\' && echo a$`b\n```';
  const html = assembleGuideHtml({ markdown: md, theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.ok(html.includes('pid=$$'));
  assert.ok(html.includes('s/a/$&amp;/'));
  assert.ok(html.includes('a$`b'), html);
  assert.equal(html.split('<meta charset').length - 1, 1);
});
test('인라인 대상은 <img> 뿐 — 다른 태그의 src 는 그대로 둔다', () => {
  const html = assembleGuideHtml({ markdown: '<video src="clip.mp4" controls></video>\n\n![a](x.png)', theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => `data:X/${p}` });
  assert.ok(html.includes('<video src="clip.mp4" controls></video>'));
  assert.ok(html.includes('<img alt="a" src="data:X/x.png">'));
});
test('buildFontCss: @font-face 2개, weight 400/700, data URI', () => {
  const css = buildFontCss((name) => Buffer.from(name));
  assert.equal((css.match(/@font-face/g) ?? []).length, 2);
  assert.ok(css.includes('font-weight:400') && css.includes('font-weight:700'));
  assert.ok(css.includes('data:font/woff2;base64,'));
});
test('목차 — 절(h2) 을 순서대로 뽑고 본문 제목에 앵커를 단다', () => {
  const md = '# 표지\n\n## 1. 시작하기\n\n본문\n\n## 2. 문제가 생기면\n\n본문';
  const toc = buildToc(renderMarkdown(md));
  assert.deepEqual(
    toc.entries.map((e) => e.text),
    ['1. 시작하기', '2. 문제가 생기면'],
  );
  assert.ok(toc.html.includes('<a href="#'), '목차 항목은 앵커 링크다');
  assert.ok(toc.body.includes(`id="${toc.entries[0].id}"`), '본문 h2 에 같은 id 가 붙는다');
});
test('목차 — 번호를 스스로 매기지 않는다 (절 제목이 이미 "0." 처럼 번호를 갖는다)', () => {
  const toc = buildToc(renderMarkdown('# 표지\n\n## 0. 이 문서에 대하여\n\n## 1. 무엇을 하는 도구인가'));
  assert.ok(!toc.html.includes('<ol'), `목차가 <ol> 이면 "1. 0. 이 문서에 대하여" 처럼 번호가 겹친다:\n${toc.html}`);
  assert.ok(toc.html.includes('0. 이 문서에 대하여'));
});
test('목차 — 표지(h1) 는 목차에 넣지 않는다', () => {
  const toc = buildToc(renderMarkdown('# Acme Notes\n\n## 1. 시작하기'));
  assert.equal(toc.entries.length, 1);
});
test('목차 — 같은 제목이 두 번 나와도 id 가 겹치지 않는다', () => {
  const toc = buildToc(renderMarkdown('## 설정\n\n## 설정'));
  assert.equal(new Set(toc.entries.map((e) => e.id)).size, 2);
});
test('목차 — 절이 없으면 빈 목차를 돌려준다(빈 상자를 만들지 않는다)', () => {
  const toc = buildToc(renderMarkdown('# 표지\n\n본문뿐'));
  assert.equal(toc.entries.length, 0);
  assert.equal(toc.html, '');
});
test('조립 — 목차는 표지 뒤에 온다 (표지가 1쪽이어야 한다)', () => {
  const md = '# 표지\n\n<div class="page-break"></div>\n\n## 1. 시작하기\n\n본문';
  const full = assembleGuideHtml({ markdown: md, theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  // 테마 CSS 주석에도 "표지" 가 나온다 — 본문(<main>) 안에서만 순서를 본다.
  const html = full.slice(full.indexOf('<main'));
  const cover = html.indexOf('<h1>표지</h1>');
  const toc = html.indexOf('<nav');
  const first = html.indexOf('<h2 id=');
  assert.notEqual(toc, -1, '목차가 없다');
  assert.ok(cover < toc, `표지가 목차보다 앞이어야 한다 (표지 ${cover} · 목차 ${toc})`);
  assert.ok(toc < first, '목차가 첫 절보다 앞이어야 한다');
});
test('조립 — 표지 구분(page-break)이 없으면 목차가 맨 앞에 온다', () => {
  const html = assembleGuideHtml({ markdown: '## 1. 시작하기\n\n본문', theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.ok(html.indexOf('<nav') < html.indexOf('1. 시작하기'));
});
test('조립 — {{TOC}} 자리에 목차가 들어가고 본문 제목에 앵커가 남는다', () => {
  const html = assembleGuideHtml({ markdown: '# T\n\n## 1. 시작하기\n\n본문', theme, version: '1.0.0', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.ok(html.includes('1. 시작하기'));
  assert.ok(html.includes('<nav'), '목차는 nav 로 감싼다');
  assert.ok(!html.includes('{{'), '자리표시자가 남지 않는다');
});

test('동봉 글꼴 파일이 실존하고 woff2 매직넘버로 시작한다', () => {
  for (const f of ['Pretendard-Regular.woff2', 'Pretendard-Bold.woff2']) {
    const buf = readFileSync(fileURLToPath(new URL(`../templates/fonts/${f}`, import.meta.url)));
    assert.equal(buf.subarray(0, 4).toString('ascii'), 'wOF2');
    assert.ok(buf.length > 500_000);
  }
});
