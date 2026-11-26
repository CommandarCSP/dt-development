// BE 스택 어댑터(GEN-05) — 규칙은 ORM 빈칸으로 적고, 엔진이 stack.orm(설정 → package.json → 기본 prisma)으로 채운다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBackendStack, applyStackAdapters, ORM_ADAPTERS, KNOWN_SLOTS, STYLING_ADAPTERS } from '../../scripts/stackAdapters.mjs';
import { loadAllRules, STACK_RULE_LOCATIONS } from '../../scripts/review/lib/rule-loader.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REVIEW = fileURLToPath(new URL('../../scripts/review/review.mjs', import.meta.url));
const CLI = fileURLToPath(new URL('../../scripts/stackAdapters.mjs', import.meta.url));
const beRules = () => loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.backend);

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-adapter-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

test('설정·의존성이 없으면 기본값(prisma·postgresql·redis·bullmq·passport-jwt)', () => {
  const dir = project({});
  try {
    const s = resolveBackendStack(dir, {});
    assert.deepEqual([s.orm, s.db, s.cache, s.queue, s.auth], ['prisma', 'postgresql', 'redis', 'bullmq', 'passport-jwt']);
    assert.equal(s.container.package, '@testcontainers/postgresql');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('package.json·schema.prisma 에서 고르고, 설정이 이긴다', () => {
  const dir = project({
    'package.json': { dependencies: { typeorm: '^0.3', mysql2: '^3', '@nestjs/bull': '^10' } },
  });
  const pr = project({
    'package.json': { dependencies: { '@prisma/client': '^5' } },
    'prisma/schema.prisma': 'datasource db {\n  provider = "mysql"\n  url = env("DATABASE_URL")\n}\n',
  });
  try {
    const s = resolveBackendStack(dir, {});
    assert.deepEqual([s.orm, s.db, s.queue], ['typeorm', 'mysql', 'bull']);
    assert.equal(s.from.orm, 'package.json');
    assert.equal(s.container.className, 'MySqlContainer');
    assert.equal(resolveBackendStack(pr, {}).db, 'mysql');
    assert.equal(resolveBackendStack(pr, {}).from.db, 'schema.prisma provider');
    const c = resolveBackendStack(dir, { stack: { orm: 'drizzle', cache: 'none' } });
    assert.deepEqual([c.orm, c.from.orm, c.cache], ['drizzle', '설정', 'none']);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(pr, { recursive: true, force: true }); }
});

test('ORM 이 여럿이면 기본값을 고르고 알린다 · 모르는 값은 막는다', () => {
  const dir = project({ 'package.json': { dependencies: { '@prisma/client': '^5', typeorm: '^0.3' } } });
  try {
    const s = resolveBackendStack(dir, {});
    assert.equal(s.orm, 'prisma');
    assert.match(s.notes.join('\n'), /stack\.orm/);
    assert.throws(() => resolveBackendStack(dir, { stack: { orm: 'sequelize' } }), /prisma \| typeorm \| drizzle \| none/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('prisma 로 채운 규칙은 예전 리터럴 그대로다', async () => {
  const { rules } = applyStackAdapters(await beRules(), resolveBackendStack('/nonexistent-dt', {}));
  const by = (id) => rules.find((r) => r.ruleId === id);
  assert.deepEqual(by('repository-only-orm').detection[0].matches, ['@prisma/client']);
  assert.deepEqual(by('service-no-direct-orm').detection[0].matches, ['@prisma/client', '**/prisma.service', '**/prisma/prisma.service']);
  assert.deepEqual(by('integration-no-db-mocking').detection[0].matchArguments, ['**/*.repository', '**/prisma**', '**/prisma.service', '@prisma/client']);
  assert.equal(by('service-unit-mocks-repository').detection[0].forbid, 'new\\s+PrismaClient\\s*\\(');
  assert.ok(by('repository-only-orm').excludePathPatterns.includes('src/prisma/**'));
  const raw = JSON.stringify(rules);
  assert.ok(!/\$orm\.|\{\{orm\./.test(raw), '채우지 못한 빈칸이 남았다');
});

test('none 이면 그 영역 규칙을 건너뛰고, 빈 정규식 인자는 뺀다', async () => {
  const st = resolveBackendStack('/nonexistent-dt', { stack: { orm: 'none', cache: 'none', queue: 'none' } });
  const { rules, skipped } = applyStackAdapters(await beRules(), st);
  assert.deepEqual(skipped.map((s) => s.ruleId).sort(), ['centralized-cache-keys', 'controller-no-direct-orm', 'queue-through-bull-module', 'redis-through-cache-service', 'repository-integration-real-db', 'repository-only-orm', 'service-no-direct-orm']);
  const unit = rules.find((r) => r.ruleId === 'service-unit-mocks-repository');
  assert.ok(!('forbid' in unit.detection[0]));
  assert.ok(unit.detection[0].require);
});

test('모든 어댑터가 모든 빈칸을 갖는다', () => {
  const tables = { orm: ORM_ADAPTERS, styling: STYLING_ADAPTERS };
  for (const slot of KNOWN_SLOTS) {
    const [area, key] = slot.split('.');
    for (const [name, a] of Object.entries(tables[area])) assert.ok(key in a, `${area} ${name} 에 ${slot} 가 없다`);
  }
});

test('CLI --json', () => {
  const dir = project({ 'package.json': { dependencies: { 'drizzle-orm': '^0.30', pg: '^8' } } });
  try {
    const r = spawnSync(process.execPath, [CLI, '--project', dir, '--json'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const j = JSON.parse(r.stdout);
    assert.deepEqual([j.orm, j.db, j.container.package], ['drizzle', 'postgresql', '@testcontainers/postgresql']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── 완료 기준 예제: 같은 계층 위반을 ORM 만 바꿔 만든다 ──────────────────────────
const ORM = {
  prisma: {
    deps: { '@prisma/client': '^5' },
    client: '@prisma/client', type: 'Order',
    allowed: {
      'src/prisma/prisma.service.ts': "import { PrismaClient } from '@prisma/client';\nexport class PrismaService extends PrismaClient {}\n",
      'src/prisma/prisma.module.ts': "import { Module } from '@nestjs/common';\nimport { PrismaService } from './prisma.service';\n@Module({ providers: [PrismaService], exports: [PrismaService] }) export class PrismaModule {}\n",
    },
    moduleImport: "import { PrismaModule } from '../prisma/prisma.module';",
    connect: 'new PrismaClient()',
  },
  typeorm: {
    deps: { typeorm: '^0.3', '@nestjs/typeorm': '^10' },
    client: 'typeorm', type: 'Repository',
    allowed: {
      'src/orders/order.entity.ts': "import { Entity, PrimaryGeneratedColumn } from 'typeorm';\n@Entity() export class Order { @PrimaryGeneratedColumn() id: number; }\n",
      'src/migrations/1700000000000-init.ts': "import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class Init1700000000000 implements MigrationInterface { async up(q: QueryRunner) {} async down(q: QueryRunner) {} }\n",
    },
    moduleImport: "import { TypeOrmModule } from '@nestjs/typeorm';",
    connect: 'new DataSource({ type: "postgres" })',
  },
  drizzle: {
    deps: { 'drizzle-orm': '^0.30' },
    client: 'drizzle-orm', type: 'eq',
    allowed: {
      'src/db/index.ts': "import { drizzle } from 'drizzle-orm/node-postgres';\nexport const db = drizzle(process.env.DATABASE_URL!);\n",
      'src/db/schema.ts': "import { pgTable, serial } from 'drizzle-orm/pg-core';\nexport const orders = pgTable('orders', { id: serial('id') });\n",
    },
    moduleImport: '',
    connect: 'drizzle(process.env.DATABASE_URL!)',
  },
};

function beProject(orm) {
  const o = ORM[orm];
  const imp = `import { ${o.type} } from '${o.client}';`;
  return project({
    'package.json': { dependencies: { '@nestjs/core': '^10', ...o.deps } },
    '.dt-backend.json': { coverage: { mode: 'off' } },
    ...o.allowed,
    'src/orders/orders.module.ts': `import { Module } from '@nestjs/common';\n${o.moduleImport}\nimport { OrdersService } from './orders.service';\nimport { OrdersController } from './orders.controller';\nimport { OrdersRepository } from './orders.repository';\n@Module({ controllers: [OrdersController], providers: [OrdersService, OrdersRepository] }) export class OrdersModule {}\n`,
    'src/orders/orders.repository.ts': `${imp}\nexport class OrdersRepository { find() { return []; } }\n`,
    'src/orders/orders.service.ts': `${imp}\nexport class OrdersService { list() { return []; } }\n`,
    'src/orders/orders.controller.ts': `import { Controller, Get } from '@nestjs/common';\n${imp}\n@Controller('orders') export class OrdersController { @Get() list() { return []; } }\n`,
    'src/orders/dto/order.dto.ts': `${imp}\nexport class OrderDto { id: string; }\n`,
    'src/orders/__tests__/orders.service.unit.test.ts': `import { OrdersService } from '../orders.service';\ntest('u', () => { const s = new OrdersService(); const c = ${o.connect}; expect(jest.fn()).toBeDefined(); });\n`,
    'src/orders/__tests__/orders.repository.integration.test.ts': `jest.mock('${o.client}');\ntest('i', () => {});\n`,
    'src/orders/__tests__/orders.controller.integration.test.ts': "import request from 'supertest';\ntest('c', () => { request; });\n",
  });
}
const findings = (out) => [...out.matchAll(/^- ([\w./-]+\.tsx?):\d+ — ([a-z0-9-]+) — /gm)].map((m) => `${m[2]} ${m[1]}`).sort();
const run = (dir) => spawnSync(process.execPath, [REVIEW, 'full', '--no-coverage', '--stack', 'backend', '--project', dir], { encoding: 'utf8' });

const MUST = ['repository-only-orm', 'service-no-direct-orm', 'controller-no-direct-orm', 'dto-no-orm-import', 'dto-vs-entity', 'integration-no-db-mocking', 'repository-integration-real-db', 'service-unit-mocks-repository'];

for (const orm of ['typeorm', 'drizzle']) {
  test(`${orm} 프로젝트가 같은 내용의 prisma 프로젝트와 같은 계층 위반을 찾는다`, () => {
    const a = beProject('prisma'); const b = beProject(orm);
    try {
      const ra = run(a); const rb = run(b);
      const fa = findings(ra.stdout); const fb = findings(rb.stdout);
      for (const id of MUST) assert.ok(fa.some((f) => f.startsWith(`${id} `)), `prisma 예제에서 ${id} 를 못 찾았다:\n${ra.stdout}`);
      assert.deepEqual(fb, fa, `prisma:\n${ra.stdout}\n${orm}:\n${rb.stdout}`);
      assert.equal(rb.status, ra.status);
      assert.match(rb.stdout, new RegExp(`스택: orm ${orm}\\(package\\.json\\)`));
    } finally { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); }
  });
}
