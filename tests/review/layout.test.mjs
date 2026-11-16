// 폴더 구조 바꿔 끼우기(GEN-04) — 규칙은 표준 경로로, 엔진이 스택 설정(paths.src·paths.e2e·layout)으로 바꾼다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { layoutFromConfig, rewriteGlob, rewriteImportPattern, applyLayout } from '../../scripts/review/lib/layout.mjs';
import { loadAllRules } from '../../scripts/review/lib/rule-loader.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REVIEW = fileURLToPath(new URL('../../scripts/review/review.mjs', import.meta.url));

test('설정이 없거나 기본값이면 규칙을 그대로 둔다', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  assert.equal(applyLayout(rules, {}), rules);
  assert.equal(applyLayout(rules, { paths: { src: 'src' } }), rules);
  assert.equal(applyLayout(rules, { paths: ['src/'] }), rules); // 옛 배열 형식도 기본 구조로
});

test('paths.src·paths.e2e·layout 으로 glob 을 바꾼다', () => {
  const lay = layoutFromConfig({ paths: { src: 'packages/web/app/', e2e: 'tests/e2e' }, layout: { business: 'features', components: 'ui', 'components/domain': 'widgets' } });
  assert.equal(rewriteGlob('src/business/hooks/**/*.ts', lay), 'packages/web/app/features/hooks/**/*.ts');
  assert.equal(rewriteGlob('src/components/domain/**/*.tsx', lay), 'packages/web/app/widgets/**/*.tsx'); // 긴 키 먼저
  assert.equal(rewriteGlob('src/components/view/**', lay), 'packages/web/app/ui/view/**');
  assert.equal(rewriteGlob('src/**/__tests__/**/*.ts', lay), 'packages/web/app/**/__tests__/**/*.ts');
  assert.equal(rewriteGlob('e2e/**/*.spec.ts', lay), 'tests/e2e/**/*.spec.ts');
  assert.equal(rewriteGlob('vitest.config.*', lay), 'vitest.config.*');
  assert.equal(rewriteGlob('src/pages/*.tsx', layoutFromConfig({ paths: { src: '.' } })), 'pages/*.tsx');
});

test('import 패턴 안의 층 이름을 바꾸고, 패키지 이름은 건드리지 않는다', () => {
  const lay = layoutFromConfig({ layout: { business: 'features', store: 'state' } });
  assert.equal(rewriteImportPattern('**/business/**', lay), '**/features/**');
  assert.equal(rewriteImportPattern('../../store/**', lay), '../../state/**');
  assert.equal(rewriteImportPattern('zustand', lay), 'zustand');
  assert.equal(rewriteImportPattern('**/businessCard', lay), '**/businessCard');
});

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-layout-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}
const files = (src, biz) => ({
  [`${src}/components/domain/Bad.tsx`]: "import axios from 'axios';\nexport function Bad() { axios.get('/x'); return null; }\n",
  [`${src}/components/view/Card.tsx`]: `import { useFoo } from '../../${biz}/hooks/useFoo';\nexport function Card() { useFoo(); return null; }\n`,
  [`${src}/pages/__tests__/Home.integration.test.tsx`]: `jest.mock('../../${biz}/hooks/useFoo');\ntest('x', () => {});\n`,
});
/** 보고서에서 [ruleId, 파일] 쌍만 — 경로는 표준 이름으로 되돌려 비교한다. */
const findings = (out, back) => [...out.matchAll(/^- ([\w./-]+\.tsx?):\d+ — ([a-z0-9-]+) — /gm)]
  .map((m) => `${m[2]} ${back(m[1])}`).sort();

test('app/ 구조·npm·jest 프로젝트에서 src/ 프로젝트와 같은 위반을 찾는다', () => {
  const std = project({ ...files('src', 'business'), '.dt-frontend.json': { coverage: { mode: 'off' } } });
  const app = project({
    ...files('app', 'features'),
    'package-lock.json': '{}',
    'package.json': { devDependencies: { jest: '^29' } },
    '.dt-frontend.json': { paths: { src: 'app' }, layout: { business: 'features' }, coverage: { mode: 'off' } },
  });
  try {
    const run = (dir) => spawnSync(process.execPath, [REVIEW, 'full', '--no-coverage', '--project', dir], { encoding: 'utf8' });
    const a = run(std); const b = run(app);
    const fa = findings(a.stdout, (p) => p);
    const fb = findings(b.stdout, (p) => p.replace(/^app\//, 'src/').replace('/features/', '/business/'));
    for (const id of ['domain-no-direct-api', 'pure-view-component', 'integration-no-hook-mocking']) {
      assert.ok(fa.some((f) => f.startsWith(`${id} `)), `src 예제에서 ${id} 를 못 찾았다:\n${a.stdout}`);
    }
    assert.deepEqual(fb, fa);
    assert.equal(b.status, a.status);
  } finally { rmSync(std, { recursive: true, force: true }); rmSync(app, { recursive: true, force: true }); }
});
