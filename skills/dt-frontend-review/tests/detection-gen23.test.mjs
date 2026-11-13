// GEN-23 — 검출이 비어 있거나 AST 껍데기였던 규칙을 실제로 검사하게 했다. 규칙 문서의 검출 정의를 그대로 읽어 돌린다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllRules } from '../scripts/lib/rule-loader.mjs';
import { resolveStack } from '../scripts/lib/stacks.mjs';
import { detectForbiddenPattern } from '../scripts/lib/detection/forbidden-pattern.mjs';
import { detectPatternPair } from '../scripts/lib/detection/pattern-pair.mjs';
import { detectJsxTagAttrs } from '../scripts/lib/detection/jsx-tag-attrs.mjs';
import { detectRegisteredInSiblingModule } from '../scripts/lib/detection/registered-in-sibling-module.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const FN = { 'forbidden-pattern': detectForbiddenPattern, 'pattern-pair': detectPatternPair, 'jsx-tag-attrs': detectJsxTagAttrs, 'registered-in-sibling-module': detectRegisteredInSiblingModule };
const rules = {};
for (const st of ['frontend', 'backend']) for (const r of await loadAllRules(PLUGIN_ROOT, resolveStack(st).ruleLocations)) rules[`${st}:${r.ruleId}`] = r;

function run(key, code, ctx) {
  const rule = rules[key];
  assert.ok(rule, `규칙 ${key} 없음`);
  return rule.detection.flatMap((d) => (FN[d.type] ? FN[d.type](code, d, ctx) : [])).filter((f) => !f.manualReview);
}
const hits = (key, code, ctx) => run(key, code, ctx).length;

test('list-empty-state: .map 목록에 빈 상태 분기가 없으면 위반', () => {
  assert.equal(hits('frontend:list-empty-state', 'return <ul>{items.map((i) => <li key={i.id}>{i.name}</li>)}</ul>'), 1);
  assert.equal(hits('frontend:list-empty-state', 'if (items.length === 0) return <p>게시글이 없습니다</p>;\nreturn <ul>{items.map((i) => <li>{i}</li>)}</ul>'), 0);
});

test('interactive-a11y: onClick 비인터랙티브 요소는 role·tabIndex·onKeyDown 을 모두 갖춘다 (화살표 함수 => 도 넘는다)', () => {
  assert.equal(hits('frontend:interactive-a11y', '<div className="card" onClick={() => go(id)}>{title}</div>'), 1);
  const ok = '<div role="button" tabIndex={0} onClick={() => go(id)} onKeyDown={(e) => { if (e.key === "Enter") go(id); }}>x</div>';
  assert.equal(hits('frontend:interactive-a11y', ok), 0);
  assert.equal(hits('frontend:interactive-a11y', '<button onClick={() => go()}>x</button>'), 0);
});

test('server-vs-client-state: Zustand store 가 fetcher·fetch 를 쓰면 위반', () => {
  assert.equal(hits('frontend:server-vs-client-state', "import { fetchPosts } from '../../services/post/postFetcher';\nexport const usePostStore = create(() => ({}));"), 1);
  assert.equal(hits('frontend:server-vs-client-state', "import { create } from 'zustand';\nexport const useUi = create((set) => ({ open: false }));"), 0);
});

test('avoid-effect-for-derived-state: setState 한 줄뿐인 useEffect 는 위반', () => {
  assert.equal(hits('frontend:avoid-effect-for-derived-state', 'useEffect(() => { setFullName(first + " " + last); }, [first, last]);'), 1);
  assert.equal(hits('frontend:avoid-effect-for-derived-state', 'useEffect(() => { const id = subscribe(); return () => unsubscribe(id); }, []);'), 0);
});

test('flaky-test-prevention: 고정 sleep 은 FE·BE 모두 위반', () => {
  assert.equal(hits('frontend:flaky-test-prevention', 'await new Promise((r) => setTimeout(r, 500));'), 1);
  assert.equal(hits('frontend:flaky-test-prevention', 'await page.waitForTimeout(1000);'), 1);
  assert.equal(hits('frontend:flaky-test-prevention', 'await screen.findByText("완료");'), 0);
  assert.equal(hits('backend:flaky-test-prevention', 'await sleep(2000);'), 1);
});

test('repository-integration-real-db: 통합 테스트의 Prisma mock 은 위반', () => {
  assert.equal(hits('backend:repository-integration-real-db', "jest.mock('@prisma/client');"), 1);
  assert.equal(hits('backend:repository-integration-real-db', 'const prisma = new PrismaClient({ datasourceUrl: container.getConnectionUri() });'), 0);
});

test('controller-integration-supertest: 컨트롤러 테스트는 supertest 로 HTTP 를 거친다', () => {
  assert.equal(hits('backend:controller-integration-supertest', 'const res = await ordersController.create(dto);'), 1);
  assert.equal(hits('backend:controller-integration-supertest', "import request from 'supertest';\n// OrdersController\nawait request(app.getHttpServer()).post('/orders');"), 0);
});

test('service-unit-mocks-repository: 서비스 단위 테스트는 repository 를 mock 하고 실 DB 를 쓰지 않는다', () => {
  assert.equal(hits('backend:service-unit-mocks-repository', 'const service = new OrdersService(new OrdersRepository(new PrismaClient()));'), 2);
  assert.equal(hits('backend:service-unit-mocks-repository', 'const repo = { create: jest.fn() };\nconst service = new OrdersService(repo);'), 0);
});

test('testcontainers-lifecycle: 컨테이너는 beforeAll 기동·afterAll stop', () => {
  assert.equal(hits('backend:testcontainers-lifecycle', 'beforeEach(async () => { c = await new PostgreSqlContainer().start(); });'), 1);
  assert.equal(hits('backend:testcontainers-lifecycle', 'beforeAll(async () => { c = await new PostgreSqlContainer().start(); });\nafterAll(async () => { await c.stop(); });'), 0);
});

test('e2e-full-app: e2e 는 AppModule 을 부팅한다', () => {
  assert.equal(hits('backend:e2e-full-app', "describe('orders', () => { Test.createTestingModule({ imports: [OrdersModule] }); });"), 1);
  assert.equal(hits('backend:e2e-full-app', "describe('orders', () => { Test.createTestingModule({ imports: [AppModule] }); });"), 0);
});

test('module-registration: @Injectable 클래스가 형제 *.module.ts 에 없으면 위반', () => {
  const root = mkdtempSync(join(tmpdir(), 'mr-'));
  try {
    mkdirSync(join(root, 'src/orders'), { recursive: true });
    writeFileSync(join(root, 'src/orders/orders.module.ts'), '@Module({ providers: [OrdersService] }) export class OrdersModule {}');
    const svc = '@Injectable()\nexport class OrdersService {}';
    const repo = '@Injectable()\nexport class OrdersRepository {}';
    assert.equal(hits('backend:module-registration', svc, { projectRoot: root, relPath: 'src/orders/orders.service.ts' }), 0);
    assert.equal(hits('backend:module-registration', repo, { projectRoot: root, relPath: 'src/orders/orders.repository.ts' }), 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
