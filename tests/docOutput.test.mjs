// 가이드·핸드북 PDF 출력 설정(GEN-17) — 버전 출처·티켓 키 판정·테마·용지·언어·진입점 패턴.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAppVersion, resolveTicketKeyRule, findTicketKeys, resolveDocStyle, themeCss, contentWidthPx, docLabels,
} from '../scripts/lib/docOutput.mjs';
import { assembleGuideHtml } from '../scripts/guide/assemble.mjs';
import { renderMarkdown } from '../scripts/guide/markdown.mjs';
import { collectEntrypoints, compileExtraPatterns } from '../scripts/entrypoints.mjs';
import { buildHandbook } from '../scripts/handbook/build.mjs';
import { koReviewHash } from '../scripts/handbook/gate.mjs';

const tmp = (files = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'docout-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text, 'utf8');
  }
  return root;
};

test('버전 출처 — auto 는 package.json → Cargo.toml → pyproject.toml', () => {
  assert.deepEqual(readAppVersion(tmp({ 'package.json': '{"version":"1.2.3"}', 'Cargo.toml': '[package]\nversion = "9.9.9"\n' })), { version: '1.2.3', from: 'package.json' });
  assert.deepEqual(readAppVersion(tmp({ 'Cargo.toml': '[dependencies]\nversion = "0.0.1"\n\n[package]\nname = "x"\nversion = "0.4.0"\n' })), { version: '0.4.0', from: 'Cargo.toml' });
  assert.deepEqual(readAppVersion(tmp({ 'pyproject.toml': '[tool.poetry]\nversion = "2.0.1"\n' })), { version: '2.0.1', from: 'pyproject.toml' });
  const none = readAppVersion(tmp());
  assert.equal(none.version, null);
  assert.match(none.error, /versionSource/);
});

test('버전 출처 — file:<경로>, git-tag, 모르는 값', () => {
  assert.equal(readAppVersion(tmp({ VERSION: 'release 3.1.4\n' }), 'file:VERSION').version, '3.1.4');
  assert.match(readAppVersion(tmp(), 'file:VERSION').error, /파일이 없다/);
  assert.equal(readAppVersion(tmp(), 'git-tag', { runGit: () => 'v1.9.0\n' }).version, '1.9.0');
  assert.equal(readAppVersion(tmp(), 'git-tag', { runGit: () => { throw new Error('no tags'); } }).version, null);
  assert.match(readAppVersion(tmp(), 'setup.py').error, /모른다/);
});

test('티켓 키 — 기본은 끔, 설정 > 트래커 프로젝트 키 > issueKeyPattern', () => {
  const root = tmp();
  assert.equal(resolveTicketKeyRule(root, {}, { worklog: null }).re, null);
  const proj = resolveTicketKeyRule(root, {}, { worklog: { defaultProjectKey: 'SHOP', issueKeyPattern: '[A-Z]+-\\d+' } });
  assert.deepEqual(findTicketKeys('SHOP-12 와 OPS-3, ES-2015', proj.re), ['SHOP-12']);
  const pat = resolveTicketKeyRule(root, {}, { worklog: { issueKeyPattern: '[A-Z][A-Z0-9]+-\\d+' } });
  assert.deepEqual(findTicketKeys('OPS-3 과 UTF-8', pat.re), ['OPS-3'], '표준 약어 접두어는 어떤 패턴이든 넘긴다');
  const own = resolveTicketKeyRule(root, { ticketKeyPattern: 'OPS-\\d+' }, { worklog: { defaultProjectKey: 'SHOP' } });
  assert.deepEqual(findTicketKeys('SHOP-1 OPS-2', own.re), ['OPS-2']);
  assert.equal(resolveTicketKeyRule(root, { ticketKeyPattern: false }, { worklog: { defaultProjectKey: 'SHOP' } }).re, null);
  // 실제 파일(.dt-worklog.json)에서도 읽는다
  const withFile = tmp({ '.dt-worklog.json': JSON.stringify({ defaultProjectKey: 'ACME' }) });
  assert.deepEqual(findTicketKeys('ACME-7 PEP-8', resolveTicketKeyRule(withFile, {}).re), ['ACME-7']);
});

test('테마·용지 — 맞는 값은 받고 틀린 값은 경고', () => {
  const ok = resolveDocStyle({ theme: { accent: '#0a7f5a', font: 'Inter', logo: 'logo.png' }, pdf: { pageSize: 'Letter' } });
  assert.deepEqual(ok, { theme: { accent: '#0a7f5a', font: 'Inter', logo: 'logo.png' }, pageSize: 'Letter', warnings: [] });
  const bad = resolveDocStyle({ theme: { accent: 'url(x);}', font: '<b>', x: 1 }, pdf: { pageSize: 'B5' } });
  assert.equal(bad.pageSize, 'A4');
  assert.deepEqual(bad.theme, {});
  for (const k of ['theme.accent', 'theme.font', 'theme.x', 'pdf.pageSize']) assert.ok(bad.warnings.some((w) => w.includes(k)), k);
  assert.match(themeCss({ accent: 'teal', font: 'Inter' }), /--accent:teal;--hb-accent:teal;[\s\S]*font-family:Inter, Pretendard/);
  assert.equal(themeCss({}), '');
  assert.equal(contentWidthPx('A4'), 673);
  assert.ok(contentWidthPx('A5') < contentWidthPx('A4') && contentWidthPx('Letter') > contentWidthPx('A4'));
});

test('언어 — 틀 문구와 <html lang>, 테마 CSS·로고가 조립에 들어간다', () => {
  assert.equal(docLabels('ko').toc, '목차');
  assert.equal(docLabels('en-US').toc, 'Contents');
  const theme = readFileSync(new URL('../templates/guide-theme.html', import.meta.url), 'utf8');
  const html = assembleGuideHtml({
    markdown: '# T\n\n<div class="page-break"></div>\n\n## 1. Start', theme, version: '1.0.0', title: 'T', fontCss: '',
    renderMarkdown, resolveAsset: (p) => p, lang: 'en', tocTitle: 'Contents', themeCss: ':root{--accent:teal;}', logoHtml: '<img class="cover-logo">',
  });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h2 class="toc-title">Contents<\/h2>/);
  assert.match(html, /:root\{--accent:teal;\}\s*<\/style>/, '덮어쓰기 CSS 는 기본 규칙 뒤에');
  assert.ok(html.indexOf('cover-logo">') < html.indexOf('<h1'), '로고는 표지 맨 위');
  assert.doesNotMatch(html, /\{\{(LANG|THEME_CSS)\}\}/);
  // 기본값은 지금과 같다
  const ko = assembleGuideHtml({ markdown: '## 1. 시작', theme, version: '1', title: 't', fontCss: '', renderMarkdown, resolveAsset: (p) => p });
  assert.match(ko, /<html lang="ko">[\s\S]*>목차</);
});

test('진입점 — Express·Fastify·Koa router, 클라이언트 호출은 잡지 않는다', () => {
  const root = tmp({
    'src/server.ts': "app.get('/health', (req, res) => res.send('ok'));\nfastify.post('/orders', async () => {});\nconst ordersRouter = Router();\nordersRouter.delete('/orders/:id', h);\n",
    'src/client.ts': "axios.get('/api/x', { params });\nmap.get('key');\napp.getPath('home');\n",
  });
  const names = collectEntrypoints(root).entrypoints.filter((e) => e.kind === 'http').map((e) => e.name).sort();
  assert.deepEqual(names, ['DELETE /orders/:id', 'GET /health', 'POST /orders']);
});

test('진입점 — Next.js 는 next 의존이 있을 때만 파일 라우트를 본다', () => {
  const files = {
    'app/page.tsx': 'export default function P() {}',
    'app/(shop)/items/[id]/page.tsx': 'export default function P() {}',
    'app/api/orders/route.ts': 'export async function GET() {}\nexport const POST = () => {};\n',
    'pages/about.tsx': 'export default function A() {}',
    'pages/_app.tsx': 'export default function App() {}',
    'pages/api/ping.ts': 'export default function h() {}',
  };
  assert.deepEqual(collectEntrypoints(tmp(files)).entrypoints, [], 'next 가 없으면 폴더 이름만으로 라우트를 만들지 않는다');
  const { entrypoints } = collectEntrypoints(tmp({ ...files, 'package.json': '{"dependencies":{"next":"15.0.0"}}' }));
  const got = entrypoints.map((e) => `${e.kind} ${e.name}`).sort();
  assert.deepEqual(got, ['http ANY /api/ping', 'http GET /api/orders', 'http POST /api/orders', 'route /', 'route /about', 'route /items/[id]']);
});

test('진입점 — 설정 extraPatterns 는 다른 언어 파일도 읽고, 틀린 정규식은 경고만', () => {
  const root = tmp({
    'app/views.py': "@app.route('/login')\ndef login(): pass\n",
    'main.go': 'http.HandleFunc("/ping", ping)\n',
    'src/a.ts': "// @app.route('/not-python')\n",
  });
  const { patterns, warnings } = compileExtraPatterns([
    { kind: 'http', pattern: "@app\\.route\\(\\s*['\"]([^'\"]+)", ext: ['.py'] },
    { kind: 'http', pattern: 'HandleFunc\\(\\s*"([^"]+)"', ext: ['.go'] },
    { kind: 'http', pattern: '([' },
    { pattern: 'x' },
  ]);
  assert.equal(patterns.length, 2);
  assert.equal(warnings.length, 2);
  const got = collectEntrypoints(root, { extraPatterns: patterns }).entrypoints.map((e) => `${e.file} ${e.name}`).sort();
  assert.deepEqual(got, ['app/views.py /login', 'main.go /ping']);
  assert.deepEqual(compileExtraPatterns('x').warnings.length, 1);
});

test('핸드북 — 언어·테마 덮어쓰기·로고, versionSource', async () => {
  const body = '# P\n\n<div class="page-break"></div>\n\n## 1. Summary\n\n앱이다.\n';
  const root = tmp({
    'Cargo.toml': '[package]\nversion = "0.7.0"\n',
    '.dt-handbook.json': JSON.stringify({ product: 'P', pdfName: 'P-Handbook.pdf', audience: 'internal', language: 'en', theme: { accent: '#123456', logo: 'logo.svg' } }),
    'docs/handbook/handbook.md': `---\nproduct: P\nversion: 0.7.0\n---\n${body}`,
    'docs/handbook/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'docs/handbook/structure.json': JSON.stringify({ clusters: [], entrypoints: [], edges: [] }),
    'docs/handbook/ko-review.json': JSON.stringify({ rounds: [{ n: 1, lintAfter: 0 }], bodyHash: koReviewHash(body) }),
  });
  const r = await buildHandbook({ projectRoot: root, pdf: false });
  const html = readFileSync(r.htmlPath, 'utf8');
  assert.match(html, /<title>P 0\.7\.0 Developer Handbook<\/title>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /--hb-accent:#123456/);
  assert.match(html, /class="cover-logo"[^>]*src="data:image\/svg\+xml;base64,/);
  // 덮어쓰기 테마
  writeFileSync(join(root, 'docs/handbook/theme.override.html'), '<html lang="{{LANG}}"><title>{{TITLE}}</title><style>{{FIGURES_CSS}}</style><main>{{CONTENT}}</main>');
  const o = readFileSync((await buildHandbook({ projectRoot: root, pdf: false })).htmlPath, 'utf8');
  assert.match(o, /^<html lang="en"><title>P 0\.7\.0 Developer Handbook<\/title><style>[\s\S]*--hb-ink[\s\S]*<main>/);
});
