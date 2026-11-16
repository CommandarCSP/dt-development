// dt-adopt 기계 추출 — NestJS 엔드포인트, FE 호출, FE↔BE 대조, 결정 후보. 실제 프로젝트 모양을 줄인 예시로 검사한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { parseController, beEndpoints, endpointSuspects } from '../scripts/adopt/beEndpoints.mjs';
import { feApiCalls, matchCalls, normalizeCallPath } from '../scripts/adopt/feApiCalls.mjs';
import { prismaCandidates, decisionCandidates } from '../scripts/adopt/decisionCandidates.mjs';
import { extract } from '../scripts/adopt/extract.mjs';

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'dt-adopt-'));
  for (const [p, body] of Object.entries(files)) { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), typeof body === 'string' ? body : JSON.stringify(body)); }
  return root;
}

const CTRL = `import { Controller, Get, Post, Delete, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  @Get()
  list() {}

  @Post()
  create(@Body() dto: CreateOrderDto) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {}
}
`;
const AUTH = `@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {}

  @Post('logout')
  logout() {}
}
`;

test('parseController: prefix·경로·핸들러·가드·상태 코드(기본 POST 201, @HttpCode 우선)', () => {
  const eps = parseController(CTRL, 'src/orders/orders.controller.ts', 'api/v1');
  assert.deepEqual(eps.map((e) => [e.method, e.path, e.handler, e.status]), [
    ['GET', '/api/v1/orders', 'list', 200], ['POST', '/api/v1/orders', 'create', 201], ['DELETE', '/api/v1/orders/:id', 'remove', 204],
  ]);
  assert.ok(eps.every((e) => e.guards[0] === "AuthGuard('jwt')"));
  assert.match(eps[2].evidence, /orders\.controller\.ts:\d+/);
});

test('beEndpoints: main.ts 의 전역 prefix 를 붙이고, 가드 없는 변경 API 를 확인 후보로 낸다', () => {
  const root = project({ 'src/main.ts': "app.setGlobalPrefix('api/v1');", 'src/orders/orders.controller.ts': CTRL, 'src/auth/auth.controller.ts': AUTH,
    'src/misc/misc.controller.ts': "@UseGuards(G)\n@Controller('misc')\nexport class MiscController {\n  @Get('a')\n  a() {}\n}\n@Controller('open')\nexport class OpenController {\n  @Post('b')\n  b() {}\n}\n" });
  try {
    const eps = beEndpoints(root);
    assert.ok(eps.some((e) => e.path === '/api/v1/auth/login' && e.status === 200));
    const kinds = endpointSuspects(eps).map((s) => `${s.kind} ${s.endpoint}`);
    assert.ok(kinds.includes('unguarded-mutation POST /api/v1/open/b'));
    assert.ok(!kinds.some((k) => k.includes('/auth/')), '인증 엔드포인트는 가드가 없어도 정상');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('feApiCalls: 템플릿 리터럴 매개변수를 :param 으로 맞추고, mock·테스트는 뺀다', () => {
  assert.equal(normalizeCallPath('/feed/${postId}/comments?sort=new'), '/feed/:postId/comments');
  const root = project({
    'src/services/orders.ts': "await apiClient.get<OrderDto[]>(`/api/v1/orders`);\nawait apiClient.delete(`/api/v1/orders/${order.id}`);\nawait apiClient.get('/api/v1/stats');",
    'src/mocks/handlers.ts': "http.get(`/api/v1/secret`)",
    'src/services/__tests__/orders.test.ts': "apiClient.get('/api/v1/test-only')",
  });
  try {
    const calls = feApiCalls(root);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), ['GET /api/v1/orders', 'DELETE /api/v1/orders/:id', 'GET /api/v1/stats']);
    const eps = parseController(CTRL, 'x', 'api/v1');
    const r = matchCalls(calls, [...eps, { method: 'POST', path: '/api/v1/auth/login' }]);
    assert.deepEqual(r.unmatchedCalls.map((c) => c.path), ['/api/v1/stats']);
    assert.deepEqual(r.unusedEndpoints.map((e) => `${e.method} ${e.path}`), ['POST /api/v1/orders', 'POST /api/v1/auth/login']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('prismaCandidates: ID 생성 방식·soft delete·@@map 패턴', () => {
  const schema = 'model A {\n  id String @id @default(uuid())\n  deletedAt DateTime?\n  @@map("a")\n}\nmodel B {\n  id String @id @default(uuid())\n  deletedAt DateTime?\n  @@map("b")\n}\n';
  const topics = Object.fromEntries(prismaCandidates(schema).map((c) => [c.topic, c]));
  assert.match(topics['data.idStrategy'].title, /uuid/);
  assert.equal(topics['data.idStrategy'].confidence, 'code');
  assert.match(topics['data.deletion'].title, /soft delete/);
  assert.ok(topics['data.tableNaming']);
});

test('decisionCandidates: 플러그인 기본과 다른 스택 영역은 topic stack.* 후보가 된다', () => {
  const root = project({ 'package.json': { dependencies: { react: '19', swr: '2' } } });
  try {
    const c = decisionCandidates(root, { stack: 'frontend', runGit: false });
    assert.ok(c.some((x) => x.topic === 'stack.fe.serverState' && /swr/.test(x.title)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('extract: FE·BE 를 대조해 FE 가 안 부르는 엔드포인트(짝 없는 능력)와 BE 에 없는 호출을 확인 후보로 낸다', () => {
  const fe = project({ 'package.json': { dependencies: { react: '19' } }, 'src/App.tsx': "<Route path='/orders' element={<Orders/>} />", 'src/services/o.ts': "apiClient.get('/api/v1/orders');\napiClient.get('/api/v1/ghost');" });
  const be = project({ 'package.json': { dependencies: { '@nestjs/core': '11' } }, 'src/main.ts': "app.setGlobalPrefix('api/v1');", 'src/orders/orders.controller.ts': CTRL });
  try {
    const r = extract({ fe, be });
    const kinds = r.suspects.map((s) => `${s.kind} ${s.endpoint}`);
    assert.ok(kinds.includes('fe-call-without-endpoint GET /api/v1/ghost'));
    assert.ok(kinds.includes('endpoint-without-caller POST /api/v1/orders'));
    assert.deepEqual(r.stacks, ['frontend', 'backend']);
  } finally { rmSync(fe, { recursive: true, force: true }); rmSync(be, { recursive: true, force: true }); }
});

test('originOf: git 아님 → nogit-<날짜>, 깨끗한 커밋 → sha, 안 올린 변경 → sha-dirty', async () => {
  const { originOf } = await import('../scripts/adopt/extract.mjs');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'dt-adopt-origin-'));
  try {
    const plain = originOf(dir, '2026-01-02');
    assert.equal(plain.ref, 'nogit-2026-01-02');
    assert.equal(plain.commit, null);
    assert.match(plain.notice, /git 저장소가 아니다/);
    const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
    g('init', '-q'); writeFileSync(join(dir, 'a.txt'), '1');
    g('add', '.'); g('-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init');
    const clean = originOf(dir);
    assert.match(clean.ref, /^[0-9a-f]{7,}$/);
    assert.equal(clean.notice, null);
    writeFileSync(join(dir, 'a.txt'), '2');
    const dirty = originOf(dir);
    assert.equal(dirty.ref, `${clean.commit}-dirty`);
    assert.match(dirty.notice, /커밋하지 않은 변경/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
