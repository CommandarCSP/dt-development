import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHandbook } from '../scripts/handbook/build.mjs';
import { koReviewHash } from '../scripts/handbook/gate.mjs';

const BODY = [
  '# P 개발 핸드북', '', '<div class="page-break"></div>', '',
  '## 1. 5분 요약', '', '문서를 만드는 앱이다.', '',
  '## 6. 시나리오별 런타임 뷰', '', '저장 흐름은 아래와 같다.', '',
  '```mermaid', 'sequenceDiagram', '  A->>B: 저장', '```', '',
].join('\n');

/** 게이트를 통과하는 최소 프로젝트. 헬퍼를 게이트 테스트와 공유하지 않는다 — 한쪽을 고치다 다른 쪽이 조용히 깨진다. */
function fullProject({ version = '1.2.3', body = BODY } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'build-'));
  const dir = join(root, 'docs', 'handbook');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', version }), 'utf8');
  writeFileSync(join(root, '.dt-handbook.json'),
    JSON.stringify({ product: 'P', pdfName: 'P-Handbook.pdf', audience: 'internal' }), 'utf8');
  const fm = `---\nproduct: P\nversion: 1.2.3\naudience: internal\ngeneratedAt: 2026-09-14T00:00:00Z\nbaseCommit: abc1234\n---\n`;
  writeFileSync(join(dir, 'handbook.md'), fm + body, 'utf8');
  writeFileSync(join(dir, 'structure.json'), JSON.stringify({
    baseCommit: 'abc1234', clusters: [], entrypoints: [], edges: [],
    hotspots: { available: false, files: [], coChange: [] },
    data: { byTarget: {}, multiOwner: [] }, flowCandidates: [],
  }), 'utf8');
  writeFileSync(join(dir, 'ko-review.json'),
    JSON.stringify({ verdict: 'OK', at: '2026-09-14T00:00:00Z',
      rounds: [{ n: 1, applied: 0, needsHuman: 0, lintAfter: 0 }], bodyHash: koReviewHash(body) }), 'utf8');
  return root;
}

test('--no-pdf 는 HTML 만 내고 게이트를 돈다', async () => {
  const r = await buildHandbook({ projectRoot: fullProject(), pdf: false });
  assert.ok(existsSync(r.htmlPath));
  assert.equal(r.pdfPath, undefined);
  assert.match(readFileSync(r.htmlPath, 'utf8'), /<pre class="mermaid">/);
});

test('게이트가 막으면 GATE_FAILED 를 던지고 findings 를 싣는다', async () => {
  await assert.rejects(() => buildHandbook({ projectRoot: fullProject({ version: '9.9.9' }), pdf: false }), (e) => {
    assert.equal(e.message, 'GATE_FAILED');
    assert.ok(e.findings.some((f) => f.id === 'G1'));
    return true;
  });
});

test('발췌본은 그 장만 담고 출처 표시가 박힌다', async () => {
  const r = await buildHandbook({ projectRoot: fullProject(), pdf: false, onlySection: 6 });
  const html = readFileSync(r.excerptPath, 'utf8');
  assert.match(html, /전권 1\.2\.3 에서 6장만 뽑음/);
  assert.match(html, /시나리오별 런타임 뷰/);
  assert.doesNotMatch(html, /5분 요약/);
});

test('없는 장을 뽑으라면 막는다', async () => {
  await assert.rejects(() => buildHandbook({ projectRoot: fullProject(), pdf: false, onlySection: 3 }), (e) => {
    assert.equal(e.message, 'SECTION_NOT_FOUND');
    return true;
  });
});

test('영수증에 기준 커밋과 그림 수가 남는다', async () => {
  const root = fullProject();
  const r = await buildHandbook({ projectRoot: root, pdf: false });
  assert.equal(r.receipt.baseCommit, 'abc1234');
  assert.equal(r.receipt.figures, 1);
  const onDisk = JSON.parse(readFileSync(join(root, 'docs', 'handbook', 'handbook-receipt.json'), 'utf8'));
  assert.equal(onDisk.version, '1.2.3');
});
