import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGate, koReviewHash } from '../scripts/handbook/gate.mjs';

const FM = (over = {}) => {
  const f = { product: 'P', version: '1.2.3', audience: 'internal', generatedAt: '2026-09-14T00:00:00Z', baseCommit: 'abc1234', ...over };
  return `---\n${Object.entries(f).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`;
};

/** 게이트가 볼 수 있는 최소한의 온전한 프로젝트. */
function proj({ body = '## 1. 5분 요약\n\n내용이 있다.\n', version = '1.2.3', structure = {}, config = {}, review = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gate-'));
  const dir = join(root, 'docs', 'handbook');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'p', version }), 'utf8');
  writeFileSync(join(root, '.dt-handbook.json'),
    JSON.stringify({ product: 'P', pdfName: 'P-Handbook.pdf', audience: 'internal', ...config }), 'utf8');
  writeFileSync(join(dir, 'handbook.md'), FM() + body, 'utf8');
  writeFileSync(join(dir, 'structure.json'), JSON.stringify({
    baseCommit: 'abc1234', clusters: [], entrypoints: [], edges: [],
    hotspots: { available: false, files: [], coChange: [] },
    data: { byTarget: {}, multiOwner: [] }, flowCandidates: [], ...structure,
  }), 'utf8');
  if (review) {
    writeFileSync(join(dir, 'ko-review.json'),
      JSON.stringify({ verdict: 'OK', at: '2026-09-14T00:00:00Z',
        rounds: [{ n: 1, applied: 0, needsHuman: 0, lintAfter: 0 }], bodyHash: koReviewHash(body) }), 'utf8');
  }
  return root;
}

const ids = (r) => r.findings.map((f) => f.id);

test('G0: 산출물이 없으면 막는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-'));
  const r = runGate({ projectRoot: root });
  assert.equal(r.ok, false);
  assert.ok(ids(r).includes('G0'));
});

test('온전한 최소 문서는 통과한다', () => {
  const r = runGate({ projectRoot: proj() });
  assert.equal(r.ok, true, JSON.stringify(r.findings));
});

test('G1: front matter 버전이 package.json 과 다르면 막는다', () => {
  const r = runGate({ projectRoot: proj({ version: '9.9.9' }) });
  assert.ok(r.findings.some((f) => f.id === 'G1' && f.level === 'BLOCK'));
});

test('G1-b: 본문에 박힌 다른 버전을 잡는다', () => {
  const r = runGate({ projectRoot: proj({ body: '## 1. 5분 요약\n\n이 문서는 v0.9.0 기준이다.\n' }) });
  assert.ok(ids(r).includes('G1-b'));
});

test('G2: structure 의 군집이 문서에 없으면 막는다', () => {
  const r = runGate({ projectRoot: proj({
    body: '## 4. 빌딩블록과 계층\n\n내용 없음.\n',
    structure: { clusters: [{ id: 'cl:src/core', dir: 'src/core', files: ['src/core/a.ts'] }] },
  }) });
  assert.ok(r.findings.some((f) => f.id === 'G2' && /src\/core/.test(f.message)));
});

test('G3: 인라인 근거의 파일이 없으면 막는다', () => {
  const r = runGate({ projectRoot: proj({ body: '## 5. 데이터\n\n저장은 여기서 한다 (src/missing.ts:10).\n' }) });
  assert.ok(r.findings.some((f) => f.id === 'G3' && f.level === 'BLOCK'));
});

test('G3: 파일은 있는데 줄이 넘치면 경고만 한다', () => {
  const r = runGate({ projectRoot: proj({ body: '## 5. 데이터\n\n여기다 (package.json:9999).\n' }) });
  assert.ok(r.findings.some((f) => f.id === 'G3' && f.level === 'MINOR'));
});

test('G4: 6장에만 있는 모듈은 막는다', () => {
  const r = runGate({ projectRoot: proj({
    body: '## 4. 빌딩블록과 계층\n\nsrc/core 를 설명한다.\n\n## 6. 시나리오\n\nsrc/hidden 이 처리한다.\n',
    structure: { clusters: [
      { id: 'cl:src/core', dir: 'src/core', files: ['src/core/a.ts'] },
      { id: 'cl:src/hidden', dir: 'src/hidden', files: ['src/hidden/b.ts'] },
    ] },
  }) });
  assert.ok(r.findings.some((f) => f.id === 'G4' && /hidden/.test(f.message)));
});

test('G7: 한글 리뷰 영수증이 없으면 막는다', () => {
  const r = runGate({ projectRoot: proj({ review: false }) });
  assert.ok(r.findings.some((f) => f.id === 'G7'));
});

test('G7: 리뷰 뒤에 본문이 바뀌면 막는다', () => {
  const root = proj();
  const dir = join(root, 'docs', 'handbook');
  writeFileSync(join(dir, 'handbook.md'), FM() + '## 1. 5분 요약\n\n리뷰 뒤에 고친 문장이다.\n', 'utf8');
  const r = runGate({ projectRoot: root });
  assert.ok(r.findings.some((f) => f.id === 'G7' && /바뀌었다/.test(f.message)));
});

test('koReviewHash 는 front matter 를 뺀 본문만 본다', () => {
  const body = '## 1. 5분 요약\n\n내용이 있다.\n';
  assert.equal(koReviewHash(body), createHash('sha256').update(body, 'utf8').digest('hex'));
});

test('G5: 손 SVG 가 6장을 넘으면 막는다', () => {
  const one = '<figure>\n<svg viewBox="0 0 1 1"></svg>\n<figcaption>c</figcaption>\n</figure>\n\n';
  const r = runGate({ projectRoot: proj({ body: `## 1. 5분 요약\n\n${one.repeat(7)}` }) });
  assert.ok(r.findings.some((f) => f.id === 'G5' && /6장/.test(f.message)));
});

test('G5: 렌더에서 온 figureErrors 를 그대로 올린다', () => {
  const r = runGate({ projectRoot: proj(), figureErrors: [{ kind: 'mermaid', detail: 'parse error' }] });
  assert.ok(r.findings.some((f) => f.id === 'G5' && /parse error/.test(f.message)));
});

test('G5: SVG 안의 script 를 막는다', () => {
  const body = '## 1. 5분 요약\n\n<figure>\n<svg viewBox="0 0 1 1"><script>x</script></svg>\n<figcaption>c</figcaption>\n</figure>\n';
  assert.ok(runGate({ projectRoot: proj({ body }) }).findings.some((f) => f.id === 'G5' && /script/.test(f.message)));
});

test('G6: 이모지와 지시문을 막는다', () => {
  const r = runGate({ projectRoot: proj({ body: '## 1. 5분 요약\n\n근거는 🟢 코드다. 값을 바꾸세요.\n' }) });
  const g6 = r.findings.filter((f) => f.id === 'G6' && f.level === 'BLOCK');
  assert.ok(g6.some((f) => /D3/.test(f.message)));
  assert.ok(g6.some((f) => /D5/.test(f.message)));
});

test('G8: 토큰 모양 문자열을 막는다', () => {
  const r = runGate({ projectRoot: proj({ body: '## 2. 스택\n\n키는 sk-live-0123456789abcdefghij 다.\n' }) });
  assert.ok(r.findings.some((f) => f.id === 'G8'));
});

test('G8: audience external 이면 티켓 키도 막는다', () => {
  const body = '## 2. 스택\n\n결정은 ABC-123 에 있다.\n';
  assert.equal(runGate({ projectRoot: proj({ body }) }).findings.some((f) => f.id === 'G8'), false);
  const r = runGate({ projectRoot: proj({ body, config: { audience: 'external' } }) });
  assert.ok(r.findings.some((f) => f.id === 'G8' && /ABC-123/.test(f.message)));
});

test('G8: allowInQuotes 에 적은 값은 통과시킨다', () => {
  const body = '## 2. 스택\n\n예시 키는 sk-live-0123456789abcdefghij 다.\n';
  const r = runGate({ projectRoot: proj({ body, config: { allowInQuotes: ['sk-live-0123456789abcdefghij'] } }) });
  assert.equal(r.findings.some((f) => f.id === 'G8'), false);
});

test('G9: 기준 커밋 이후 근거 파일이 바뀌면 경고한다', () => {
  const r = runGate({
    projectRoot: proj({ body: '## 5. 데이터\n\n여기서 쓴다 (package.json:1).\n' }),
    runGit: () => 'package.json\n',
  });
  assert.ok(r.findings.some((f) => f.id === 'G9' && f.level === 'MINOR' && /package\.json/.test(f.message)));
});

test('G9: 인용하지 않은 파일이 바뀐 것은 조용히 넘긴다', () => {
  const r = runGate({ projectRoot: proj(), runGit: () => 'src/other.ts\n' });
  assert.equal(r.findings.some((f) => f.id === 'G9'), false);
});

test('G7: 회차 기록이 없으면 막는다 — 한 번 돌고 끝내면 고치다 만든 위반이 나간다', () => {
  const root = proj();
  const dir = join(root, 'docs', 'handbook');
  const body = '## 1. 5분 요약\n\n내용이 있다.\n';
  writeFileSync(join(dir, 'ko-review.json'),
    JSON.stringify({ verdict: 'OK', at: '2026-09-14T00:00:00Z', bodyHash: koReviewHash(body) }), 'utf8');
  assert.ok(runGate({ projectRoot: root }).findings.some((f) => f.id === 'G7' && /rounds/.test(f.message)));
});

test('G7: 마지막 회차의 기계 검사가 남아 있으면 막는다', () => {
  const root = proj();
  const dir = join(root, 'docs', 'handbook');
  const body = '## 1. 5분 요약\n\n내용이 있다.\n';
  writeFileSync(join(dir, 'ko-review.json'), JSON.stringify({
    verdict: 'NEEDS_REPAIR', at: '2026-09-14T00:00:00Z',
    rounds: [{ n: 1, applied: 3, needsHuman: 0, lintAfter: 2 }], bodyHash: koReviewHash(body),
  }), 'utf8');
  assert.ok(runGate({ projectRoot: root }).findings.some((f) => f.id === 'G7' && /2건 남았다/.test(f.message)));
});

test('G7: 회차가 여러 번이어도 마지막이 깨끗하면 통과한다', () => {
  const root = proj();
  const dir = join(root, 'docs', 'handbook');
  const body = '## 1. 5분 요약\n\n내용이 있다.\n';
  writeFileSync(join(dir, 'ko-review.json'), JSON.stringify({
    verdict: 'OK', at: '2026-09-14T00:00:00Z',
    rounds: [{ n: 1, applied: 5, needsHuman: 1, lintAfter: 2 }, { n: 2, applied: 2, needsHuman: 1, lintAfter: 0 }],
    bodyHash: koReviewHash(body),
  }), 'utf8');
  assert.equal(runGate({ projectRoot: root }).findings.some((f) => f.id === 'G7'), false);
});
