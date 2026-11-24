// 테스트 파일 이름·자리 바꿔 끼우기(GEN-06) — 규칙은 `__tests__/*.unit.test.ts` 표준으로 적고,
// 엔진이 스택 설정 testing.{location,suffix}·paths.test 로 프로젝트 관례(NestJS `*.spec.ts` 등)에 맞춘다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  layoutFromConfig, rewriteTestGlob, rewriteTestPath, classifyTestGlob, applyLayout, testingFromConfig,
} from '../../scripts/review/lib/layout.mjs';
import { loadAllRules, STACK_RULE_LOCATIONS } from '../../scripts/review/lib/rule-loader.mjs';
const beRules = () => loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.backend);
const allRules = async () => [...await loadAllRules(PLUGIN_ROOT), ...await beRules()];

const PLUGIN_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REVIEW = fileURLToPath(new URL('../../scripts/review/review.mjs', import.meta.url));
const NEST = { location: 'colocated', suffix: { unit: '.spec', integration: '.integration.spec', e2e: '.e2e-spec', any: '.spec' } };

test('testing 설정이 없으면 테스트 경로를 바꾸지 않는다', async () => {
  const rules = await allRules();
  assert.equal(applyLayout(rules, { testing: {} }), rules);
  assert.equal(applyLayout(rules, { testing: { location: '__tests__' }, paths: { test: 'test' } }), rules);
});

test('NestJS 관례로 glob·testPath 를 바꾼다', () => {
  const lay = layoutFromConfig({ testing: NEST });
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.unit.test.ts', lay), ['src/**/*.spec.ts']);
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.repository.integration.test.ts', lay), ['src/**/*.repository.integration.spec.ts']);
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.ts', lay), ['src/**/*.spec.ts']);
  assert.deepEqual(rewriteTestGlob('test/**/*.e2e.test.ts', lay), ['test/**/*.e2e-spec.ts']);
  assert.equal(rewriteTestPath('__tests__/{basename}.unit.test.ts', lay), '{basename}.spec.ts');
  assert.equal(rewriteTestPath('__tests__/{basename}.integration.test.ts', lay), '{basename}.integration.spec.ts');
});

test('__tests__ 자리는 두고 꼬리만 바꿀 수 있다', () => {
  const lay = layoutFromConfig({ testing: { suffix: { unit: 'spec' } } }); // 앞 점은 붙여 준다
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.unit.test.ts', lay), ['src/**/__tests__/**/*.spec.ts']);
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.ts', lay), ['src/**/__tests__/**/*.ts']);
  assert.deepEqual(rewriteTestGlob('test/**/*.e2e.test.ts', lay), ['test/**/*.e2e.test.ts']); // 적지 않은 종류는 그대로
});

test('옆에 둘 때 "아무 테스트" glob 은 꼬리마다 하나씩, 덮이는 꼬리는 뺀다', () => {
  const lay = layoutFromConfig({ testing: { location: 'colocated' } });
  assert.deepEqual(rewriteTestGlob('src/components/view/**/__tests__/**/*.{ts,tsx}', lay), ['src/components/view/**/*.test.{ts,tsx}']);
  const it = layoutFromConfig({ testing: { location: 'colocated', suffix: { integration: '.it' } } });
  assert.deepEqual(rewriteTestGlob('src/**/__tests__/**/*.ts', it), ['src/**/*.test.ts', 'src/**/*.it.ts']);
});

test('꼬리가 겹치면 단위 규칙에서 통합 테스트를 뺀다', async () => {
  const rules = applyLayout(await beRules(), { testing: NEST });
  const unit = rules.find((r) => r.ruleId === 'service-unit-mocks-repository');
  assert.deepEqual(unit.appliesTo, ['src/**/*.spec.ts']);
  assert.ok(unit.excludePathPatterns.includes('src/**/*.integration.spec.ts'), unit.excludePathPatterns.join(', '));
  const integ = rules.find((r) => r.ruleId === 'repository-integration-real-db');
  assert.ok(!integ.excludePathPatterns.some((g) => g.includes('integration.spec')));
});

test('paths.test 로 BE e2e 폴더를 옮기고, 구조 규칙의 테스트 제외 목록에 설정한 꼬리를 더한다', async () => {
  const rules = applyLayout(await beRules(), { paths: { test: 'tests/e2e' }, testing: { suffix: { unit: '.it' } } });
  const e2e = rules.find((r) => r.ruleId === 'e2e-full-app');
  assert.deepEqual(e2e.appliesTo, ['tests/e2e/**/*.e2e.test.ts']);
  const arch = rules.find((r) => r.ruleId === 'service-no-http-context');
  assert.ok(arch.excludePathPatterns.includes('src/**/*.it.ts'), arch.excludePathPatterns.join(', '));
});

test('모르는 testing 값은 고칠 방법과 함께 막는다', () => {
  assert.throws(() => testingFromConfig({ testing: { location: 'nearby' } }), /__tests__ \| colocated/);
  assert.throws(() => testingFromConfig({ testing: { suffix: { smoke: '.smoke' } } }), /unit \| integration \| e2e \| any/);
});

test('구조: 테스트 규칙의 테스트 경로·testPath 는 모두 엔진이 아는 모양이다', async () => {
  const rules = await allRules();
  assert.ok(rules.some((r) => r.ruleId === 'service-unit-mocks-repository'), 'BE 규칙도 읽어야 한다');
  const bad = [];
  for (const r of rules) {
    const isTestingRule = r.source === 'testing';
    if (isTestingRule) for (const g of r.appliesTo) if (classifyTestGlob(g) === null) bad.push(`${r.ruleId} appliesTo ${g}`);
    for (const d of r.detection) {
      if (d.type === 'requires-sibling-test' && rewriteTestPath(d.testPath, layoutFromConfig({ testing: NEST })) === d.testPath) bad.push(`${r.ruleId} testPath ${d.testPath}`);
    }
  }
  assert.deepEqual(bad, [], '이 경로는 testing 설정으로 바뀌지 않는다 — scripts/review/lib/layout.mjs classifyTestGlob 모양으로 적는다');
});

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-testing-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}
const findings = (out, back) => [...out.matchAll(/^- ([\w./-]+\.tsx?):\d+ — ([a-z0-9-]+) — /gm)].map((m) => `${m[2]} ${back(m[1])}`).sort();
const run = (dir, stack) => spawnSync(process.execPath, [REVIEW, 'full', '--no-coverage', '--stack', stack, '--project', dir], { encoding: 'utf8' });

function compare(stack, std, other, back, mustFind) {
  const a = run(std, stack); const b = run(other, stack);
  const fa = findings(a.stdout, (p) => p); const fb = findings(b.stdout, back);
  for (const id of mustFind) assert.ok(fa.some((f) => f.startsWith(`${id} `)), `표준 예제에서 ${id} 를 못 찾았다:\n${a.stdout}`);
  assert.deepEqual(fb, fa, `표준:\n${a.stdout}\n관례:\n${b.stdout}`);
  assert.equal(b.status, a.status);
}

test('NestJS *.spec.ts 프로젝트에서 __tests__ 프로젝트와 같은 위반을 찾는다', () => {
  const be = (nest) => {
    const t = (base, kind) => (nest ? `src/posts/${base}${kind === 'unit' ? '.spec' : '.integration.spec'}.ts` : `src/posts/__tests__/${base}.${kind}.test.ts`);
    return project({
      'src/posts/posts.service.ts': 'export class PostsService { list() { return []; } }\n',
      'src/posts/posts.controller.ts': "import { Controller, Get } from '@nestjs/common';\n@Controller('posts') export class PostsController { @Get() list() { return []; } }\n",
      [t('posts.service', 'unit')]: "import { PostsService } from './posts.service';\ntest('x', async () => { await new Promise((r) => setTimeout(r, 100)); new PostsService(); });\n",
      [t('posts.repository', 'integration')]: "jest.mock('@prisma/client');\ntest('y', () => {});\n",
      [nest ? 'test/app.e2e-spec.ts' : 'test/app.e2e.test.ts']: "describe('app', () => { it('z', async () => { await sleep(10); }); });\n",
      '.dt-backend.json': nest ? { coverage: { mode: 'off' }, testing: NEST } : { coverage: { mode: 'off' } },
    });
  };
  const std = be(false); const nest = be(true);
  try {
    compare('backend', std, nest, (p) => p
      .replace(/^src\/posts\/(posts\.\w+)\.spec\.ts$/, 'src/posts/__tests__/$1.unit.test.ts')
      .replace(/^src\/posts\/(posts\.\w+)\.integration\.spec\.ts$/, 'src/posts/__tests__/$1.integration.test.ts')
      .replace('test/app.e2e-spec.ts', 'test/app.e2e.test.ts'),
    ['service-unit-mocks-repository', 'repository-integration-real-db', 'integration-no-db-mocking', 'flaky-test-prevention', 'e2e-full-app', 'controller-requires-integration-test']);
  } finally { rmSync(std, { recursive: true, force: true }); rmSync(nest, { recursive: true, force: true }); }
});

test('FE 테스트를 옆에 두는 프로젝트(Card.test.tsx)에서 __tests__ 프로젝트와 같은 위반을 찾는다', () => {
  const fe = (colocated) => {
    const t = (dir, name) => (colocated ? `${dir}/${name}` : `${dir}/__tests__/${name}`);
    return project({
      'src/components/view/Card.tsx': 'export function Card() { return null; }\n',
      [t('src/components/view', 'Card.test.tsx')]: "import { render } from '@testing-library/react';\ntest('c', async () => { await new Promise((r) => setTimeout(r, 50)); render(null); });\n",
      'src/pages/Home.tsx': 'export default function Home() { return null; }\n',
      [t('src/pages', 'Home.integration.test.tsx')]: "vi.mock('../business/hooks/useHome');\ntest('h', () => {});\n",
      '.dt-frontend.json': colocated ? { coverage: { mode: 'off' }, testing: { location: 'colocated' } } : { coverage: { mode: 'off' } },
    });
  };
  const std = fe(false); const col = fe(true);
  try {
    compare('frontend', std, col, (p) => p.replace(/^(src\/[\w/]+)\/(\w+\.(?:integration\.)?test\.tsx)$/, '$1/__tests__/$2'),
      ['flaky-test-prevention', 'integration-no-hook-mocking']);
  } finally { rmSync(std, { recursive: true, force: true }); rmSync(col, { recursive: true, force: true }); }
});
