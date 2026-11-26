// GEN-40 — ast-rule 자리표로 남았던 규칙 8개를 기존 검출 방식으로 검사하거나 manual 로 정리했다.
// 규칙 문서의 검출 정의를 그대로 읽어 돌린다(엔진과 같은 정의).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadAllRules } from '../../scripts/review/lib/rule-loader.mjs';
import { resolveStack } from '../../scripts/review/lib/stacks.mjs';
import { applyStackAdapters, resolveBackendStack } from '../../scripts/stackAdapters.mjs';
import { detectForbiddenPattern } from '../../scripts/review/lib/detection/forbidden-pattern.mjs';
import { detectPatternPair } from '../../scripts/review/lib/detection/pattern-pair.mjs';
import { detectAstRule } from '../../scripts/review/lib/detection/ast-rule.mjs';
import { renderReport } from '../../scripts/review/lib/reporter.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FN = { 'forbidden-pattern': detectForbiddenPattern, 'pattern-pair': detectPatternPair };
const rules = {};
const fill = (st, list) => (st === 'backend' ? applyStackAdapters(list, resolveBackendStack('/nonexistent-dt', {})).rules : list);
for (const st of ['frontend', 'backend']) for (const r of fill(st, await loadAllRules(PLUGIN_ROOT, resolveStack(st).ruleLocations))) rules[`${st}:${r.ruleId}`] = r;

const run = (key, code) => {
  const rule = rules[key];
  assert.ok(rule, `규칙 ${key} 없음`);
  return rule.detection.flatMap((d) => (FN[d.type] ? FN[d.type](code, d) : [])).filter((f) => !f.manualReview);
};
const hits = (key, code) => run(key, code).length;

test('플러그인 규칙에 ast-rule 자리표가 남지 않는다 — 기계 검출이 있거나 manual 이다', () => {
  const left = Object.entries(rules).filter(([, r]) => r.detection.some((d) => d.type === 'ast-rule')).map(([k]) => k);
  assert.deepEqual(left, []);
  for (const key of ['frontend:unit-view-component']) {
    assert.deepEqual(rules[key].detection.map((d) => d.type), ['manual'], key);
  }
});

test('where-does-business-logic-go: Business Hook 이 JSX 를 돌려주거나 react-dom 을 쓰면 위반', () => {
  const K = 'frontend:where-does-business-logic-go';
  assert.deepEqual(rules[K].appliesTo, ['src/business/**/*.{ts,tsx}']);
  assert.equal(hits(K, 'export function usePostCard() {\n  return <PostCard />;\n}'), 1);
  assert.equal(hits(K, "import { createPortal } from 'react-dom';"), 1);
  assert.equal(hits(K, 'export const useX = () => (\n  <div>x</div>\n);'), 1);
  assert.equal(hits(K, 'export function usePosts() {\n  const { data } = usePostListQuery();\n  return { posts: data?.map((d) => ({ id: d.id })) ?? [], isEmpty: (data?.length ?? 0) < 1 };\n}'), 0);
  assert.equal(hits(K, 'return a < b ? x : y;'), 0);
});

test('adding-business-params: hook·store 안에 limit·sort 값을 직접 적으면 위반, 매개변수·타입은 통과', () => {
  const K = 'frontend:adding-business-params';
  assert.equal(hits(K, 'const { data } = usePostListQuery({ limit: 10 });'), 1);
  assert.equal(hits(K, "useQuery({ queryKey: postKeys.list({ sort: 'createdAt' }) })"), 1);
  assert.equal(hits(K, 'export function usePostListViewModel({ limit = 10 }: Params) {\n  return usePostListQuery({ limit });\n}'), 0);
  assert.equal(hits(K, "interface Params { limit: number; sort: 'asc' | 'desc' }"), 0);
});

test('fallback-escalation: 폴백에 throw 가 없으면 위반', () => {
  const K = 'frontend:fallback-escalation';
  assert.equal(hits(K, 'export function F({ error, resetErrorBoundary }: FallbackProps) {\n  return <Retry onRetry={resetErrorBoundary} />;\n}'), 1);
  assert.equal(hits(K, 'export function F({ error, resetErrorBoundary }: FallbackProps) {\n  if (!isDomainRecoverable(error)) throw error;\n  return <Retry onRetry={resetErrorBoundary} />;\n}'), 0);
  assert.equal(hits(K, 'export const ERROR_CODES = { AUTH: 401 };'), 0, '폴백이 아닌 파일은 보지 않는다');
});

test('sentry-breadcrumb-no-pii: data 에 개인정보 키가 있으면 위반, id 만이면 통과', () => {
  const K = 'frontend:sentry-breadcrumb-no-pii';
  assert.equal(hits(K, "Sentry.addBreadcrumb({ category: 'user-action', message: '댓글 작성', data: { email, body } });"), 1);
  assert.equal(hits(K, "Sentry.addBreadcrumb({\n  category: 'auth',\n  data: {\n    userName: user.name,\n  },\n});"), 1);
  assert.equal(hits(K, "Sentry.addBreadcrumb({ category: 'user-action', message: '댓글 작성 시도', level: 'info', data: { postId } });"), 0);
  assert.equal(hits(K, "Sentry.addBreadcrumb({ category: 'nav', data: { pageName: 'home' } });"), 0, 'pageName 은 name 이 아니다');
});

test('FE coverage-rules: thresholds 가 없거나 80 미만이면 위반', () => {
  const K = 'frontend:coverage-rules';
  assert.equal(hits(K, "export default defineConfig({ test: { coverage: { provider: 'v8' } } });"), 1);
  assert.equal(hits(K, 'coverage: { thresholds: { lines: 70, functions: 80, branches: 80, statements: 80 } }'), 1);
  assert.equal(hits(K, 'coverage: { thresholds: { lines: 80, functions: 85, branches: 100, statements: 80.5 } }'), 0);
  assert.equal(hits(K, 'export default defineConfig({ plugins: [react()] });'), 0, 'coverage 설정이 없는 파일은 보지 않는다');
});

test('BE coverage-rules: coverageThreshold 가 없거나 80 미만이면 위반(jest.config·package.json)', () => {
  const K = 'backend:coverage-rules';
  assert.equal(hits(K, "module.exports = { collectCoverageFrom: ['src/**/*.ts'] };"), 1);
  assert.equal(hits(K, '{ "jest": { "collectCoverageFrom": ["src/**/*.ts"], "coverageThreshold": { "global": { "lines": 60 } } } }'), 1);
  assert.equal(hits(K, "module.exports = { collectCoverageFrom: ['src/**/*.ts'], coverageThreshold: { global: { lines: 80, branches: 85 } } };"), 0);
  assert.equal(hits(K, '{ "devDependencies": { "jest": "^29.7.0" } }'), 0, 'jest 의존만 있는 package.json 은 보지 않는다');
});

test('controller-no-business-logic: 컨트롤러에 반복·누적 계산·switch 가 있으면 위반', () => {
  const K = 'backend:controller-no-business-logic';
  assert.equal(hits(K, '@Post()\nasync create(@Body() dto: CreateOrderDto) {\n  let total = 0;\n  for (const it of dto.items) total += it.price * it.qty;\n  return this.repo.create({ ...dto, total });\n}'), 1);
  assert.equal(hits(K, 'const total = dto.items.reduce((s, i) => s + i.price, 0);'), 1);
  assert.equal(hits(K, '@Post()\ncreate(@Body() dto: CreateOrderDto): Promise<OrderResponseDto> {\n  return this.orders.place(dto);\n}'), 0);
});

test('리포트 — 사람 확인 묶음 문구에 "AST 미구현" 이 없다, 외부 규칙의 ast-rule 은 사람 확인으로 다룬다', () => {
  const [f] = detectAstRule('', { description: '외부 규칙' });
  assert.equal(f.manualReview, true);
  const findings = [{ ...f, ruleId: 'ext-rule', file: 'src/a.ts' }];
  for (const verbose of [false, true]) {
    const out = renderReport({ findings, coverage: { findings: [] }, overrides: [] }, { verbose });
    assert.doesNotMatch(out, /AST|heuristic stub|휴리스틱/);
    assert.match(out, /사람 확인/);
  }
});
