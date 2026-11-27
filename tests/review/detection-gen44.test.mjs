// GEN-44 — 설명 문구로만 검사를 고르던 required-pattern 규칙 7개를 기존 검출 방식 + manual 로 정리했다.
// 규칙 문서의 검출 정의를 그대로 읽어 돌린다(엔진과 같은 정의).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadAllRules } from '../../scripts/review/lib/rule-loader.mjs';
import { resolveStack } from '../../scripts/review/lib/stacks.mjs';
import { applyStackAdapters, resolveBackendStack } from '../../scripts/stackAdapters.mjs';
import { detectForbiddenPattern } from '../../scripts/review/lib/detection/forbidden-pattern.mjs';
import { detectPatternPair } from '../../scripts/review/lib/detection/pattern-pair.mjs';
import { detectRequiredPattern } from '../../scripts/review/lib/detection/required-pattern.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FN = { 'forbidden-pattern': detectForbiddenPattern, 'pattern-pair': detectPatternPair, 'required-pattern': detectRequiredPattern };
const rules = {};
const fill = (st, list) => (st === 'backend' ? applyStackAdapters(list, resolveBackendStack('/nonexistent-dt', {})).rules : list);
for (const st of ['frontend', 'backend']) for (const r of fill(st, await loadAllRules(PLUGIN_ROOT, resolveStack(st).ruleLocations))) rules[`${st}:${r.ruleId}`] = r;

const all = (key, code) => rules[key].detection.flatMap((d) => (FN[d.type] ? FN[d.type](code, d) : []));
const hits = (key, code) => all(key, code).filter((f) => !f.manualReview).length;

test('플러그인 규칙은 설명 문구로 검사를 고르다 "사람 확인"으로 떨어지지 않는다', () => {
  const stubs = [];
  for (const [key, r] of Object.entries(rules)) {
    for (const d of r.detection) if (d.type === 'required-pattern' && detectRequiredPattern('', d).some((f) => f.manualReview)) stubs.push(key);
  }
  assert.deepEqual(stubs, []);
  assert.deepEqual(rules['frontend:unit-ui-store'].detection.map((d) => d.type), ['manual']);
});

test('규칙 머리말 정규식에 이중 백슬래시가 없다 — 파서가 이스케이프를 풀지 않아 글자 그대로 \\ 를 찾게 된다', () => {
  const bad = [];
  for (const r of Object.values(rules)) {
    const fm = readFileSync(r.filepath, 'utf8').split('\n---')[0];
    for (const line of fm.split('\n')) if (/^\s+(pattern|when|require|requireAll|forbid):/.test(line) && line.includes('\\\\')) bad.push(`${r.ruleId}: ${line.trim()}`);
  }
  assert.deepEqual(bad, []);
});

test('modal-management: NiceModal.register 를 실제로 잡는다(예전에는 \\\\. 라 못 잡았다)', () => {
  assert.equal(hits('frontend:modal-management', "NiceModal.register('confirm', ConfirmModal);"), 1);
});

test('decision-log-format: 제목 줄 없이 항목으로 시작하는 블록은 위반(FE·BE)', () => {
  const bad = '/**\n * - PROJ-108: 취소 한도 수정\n * - 2026-01 · 초기: 24시간 전까지\n */\nexport function useReservationCancel() { }';
  const bad2 = '/**\n * - 2026-01 · 초기: 24시간 전까지. 경쟁사 기준을 따름\n */';
  const good = '/**\n * 무료 취소 한도: 출발 48시간 전까지\n * - 2026-01 · 초기: 24시간 전까지. 경쟁사 기준을 따름\n * - 2026-05 · PROJ-108(CS팀): 48시간으로 늘림.\n *   24시간 기준에서 취소 분쟁 문의가 전체 인입의 3할을 차지했음.\n */';
  const plain = '/**\n * - 옵션 a 를 받는다\n * - 옵션 b 를 받는다\n */';
  for (const k of ['frontend:decision-log-format', 'backend:decision-log-format']) {
    assert.ok(hits(k, bad) >= 1, k);
    assert.ok(hits(k, bad2) >= 1, k);
    assert.equal(hits(k, good), 0, k);
    assert.equal(hits(k, plain), 0, `${k}: 결정 로그가 아닌 일반 목록 주석은 보지 않는다`);
  }
});

test('integration-page: createMemoryRouter·RouterProvider·MSW 가 다 있어야 한다', () => {
  const K = 'frontend:integration-page';
  const ok = "server.use(http.get('/api/posts', () => HttpResponse.json([])));\nconst router = createMemoryRouter(routes, { initialEntries: ['/posts'] });\ntest('목록', () => { render(<RouterProvider router={router} />); });";
  assert.equal(hits(K, ok), 0);
  assert.equal(hits(K, "test('목록', () => { render(<MemoryRouter><PostsPage /></MemoryRouter>); });"), 1);
});

test('integration-domain: MSW + 에러 응답 분기, business·store 를 vi.mock 하면 위반', () => {
  const K = 'frontend:integration-domain';
  const ok = "test('에러', async () => {\n  server.use(http.get('/api/posts', () => HttpResponse.json({}, { status: 500 })));\n  render(<PostList />);\n});";
  assert.equal(hits(K, ok), 0);
  assert.equal(hits(K, "test('목록', async () => {\n  server.use(http.get('/api/posts', () => HttpResponse.json([])));\n});"), 1, '에러 분기 없음');
  assert.equal(hits(K, `vi.mock('@/business/hooks/usePosts');\n${ok}`), 1, 'hook 을 가짜로 바꿈');
});

test('unit-store-query: 에러 케이스가 없으면 위반', () => {
  const K = 'frontend:unit-store-query';
  assert.equal(hits(K, "it('가져온다', async () => { server.use(http.get('/api/x', () => HttpResponse.json([]))); });"), 1);
  assert.equal(hits(K, "it('실패', async () => { server.use(http.get('/api/x', () => HttpResponse.error())); await waitFor(() => expect(result.current.isError).toBe(true)); });"), 0);
});

test('e2e-playwright: page.goto 와 expect 가 있어야 한다, 고정 대기는 그대로 막는다', () => {
  const K = 'frontend:e2e-playwright';
  assert.equal(hits(K, "test('흐름', async ({ page }) => { await page.goto('/'); await expect(page.getByText('홈')).toBeVisible(); });"), 0);
  assert.equal(hits(K, "test('흐름', async ({ page }) => { await page.click('text=시작'); });"), 1);
  assert.equal(hits(K, "test('흐름', async ({ page }) => { await page.goto('/'); await page.waitForTimeout(500); await expect(page).toHaveURL('/'); });"), 1);
});
