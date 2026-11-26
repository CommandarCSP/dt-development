// 스캐폴드 스택 프리셋(GEN-07) — 새 프로젝트 명령·파일을 프리셋 + 패키지 관리자로 낸다.
// 기본 프리셋은 GEN-07 전 체크리스트의 고정 명령과 같은 결과를 낸다(아래 OLD_* 는 그 체크리스트에서 옮긴 값).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPresets, loadPreset, planScaffold, presetProblems } from '../scripts/scaffoldPreset.mjs';
import { resolveBackendStack, resolveFrontendStack, applyStackAdapters } from '../scripts/stackAdapters.mjs';
import { loadAllRules, STACK_RULE_LOCATIONS } from '../scripts/review/lib/rule-loader.mjs';
import { renderThemeBlock, mergeIntoGlobals, materialize } from '../skills/dt-frontend-scaffold/scripts/materialize-tokens.mjs';
import { pickPrismaGate } from '../skills/dt-frontend-scaffold/scripts/gate.mjs';

const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = fileURLToPath(new URL('../scripts/scaffoldPreset.mjs', import.meta.url));
const REVIEW = fileURLToPath(new URL('../scripts/review/review.mjs', import.meta.url));
const TOKENS = fileURLToPath(new URL('../skills/dt-frontend-scaffold/scripts/materialize-tokens.mjs', import.meta.url));

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-preset-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}
const cmd = (plan, id) => plan.steps.filter((s) => s.id === id).map((s) => s.command);
// 설치할 패키지만(pnpm 의 --allow-build 는 빼고 본다)
const pkgSet = (line, prefix) => { assert.ok(line.startsWith(prefix), `${line} 은 ${prefix} 로 시작해야 한다`); return new Set(line.slice(prefix.length).trim().split(/\s+/).filter((x) => !x.startsWith('--allow-build='))); };

// --- GEN-07 전 체크리스트의 값 ---
const OLD_FE_DEPS = ['react@^19', 'react-dom@^19', '@tanstack/react-query@^5', 'zustand@^5', 'react-router@^7', 'axios@^1', 'react-error-boundary@^6'];
const OLD_FE_DEV = ['vite@^7', 'tailwindcss@^4', '@tailwindcss/vite@^4', 'typescript@^5', 'vitest@^3', '@vitest/coverage-v8@^3', 'jsdom@^31', '@testing-library/react@^16', '@testing-library/user-event@^14', 'msw@^2', '@playwright/test@^1', 'eslint-plugin-jsx-a11y@^6'];
const FIXED_FE_DEPS = ['react-router-dom@^7', '@ebay/nice-modal-react@^1']; // 고침: 에러 키트·modal-management 가 쓰는데 깔지 않던 것
const OLD_BE_DEPS = ['@nestjs/core@^11', '@nestjs/common@^11', '@nestjs/config@^4', '@prisma/client@^6', 'class-validator@^0.14', 'class-transformer@^0.5'];
const OLD_BE_DEV = ['prisma@^6', '@nestjs/testing@^11', 'jest@^29', 'supertest@^7', '@types/supertest@^6', '@testcontainers/postgresql@^10', 'typescript@^5'];
const OLD_PLAYWRIGHT = `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 기본은 MSW 격리. 실연동은 E2E_LIVE=1로 VITE_USE_MOCKS를 끈다.
    command: process.env.E2E_LIVE ? 'VITE_USE_MOCKS=false pnpm dev' : 'VITE_USE_MOCKS=true pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false, // 실연동 dev 서버 재사용 방지
  },
});
`;

test('프리셋 모양: 문제 없고, 스택마다 기본 프리셋이 하나다', () => {
  for (const stack of ['frontend', 'backend']) {
    const all = listPresets(stack);
    assert.ok(all.length >= 2, `${stack} 프리셋이 2개 이상이어야 한다(기본 + 대체)`);
    assert.equal(all.filter((p) => p.default).length, 1);
    for (const p of all) {
      assert.deepEqual(presetProblems(p), []);
      assert.equal(p.stack, stack);
    }
  }
});

test('FE 기본 프리셋(vite-tailwind)은 예전 체크리스트와 같은 명령을 낸다 — 고친 패키지 2개만 더해진다', () => {
  const plan = planScaffold({ stack: 'frontend' });
  assert.equal(plan.preset, 'vite-tailwind');
  assert.equal(plan.packageManager, 'pnpm');
  assert.deepEqual(cmd(plan, 'create'), ['pnpm create vite@7 <project-root> --template react-ts']);
  assert.deepEqual(pkgSet(cmd(plan, 'deps')[0], 'pnpm add '), new Set([...OLD_FE_DEPS, ...FIXED_FE_DEPS]));
  assert.deepEqual(pkgSet(cmd(plan, 'devDeps')[0], 'pnpm add -D '), new Set(OLD_FE_DEV));
  // 고침: pnpm 10+ 가 설치 스크립트 패키지를 막아 add 가 실패하던 것 — 허용 목록을 넘긴다
  for (const id of ['deps', 'devDeps']) for (const p of ['esbuild', 'msw']) assert.ok(cmd(plan, id)[0].includes(`--allow-build=${p}`), cmd(plan, id)[0]);
  assert.deepEqual(cmd(plan, 'install'), ['pnpm install']);
  assert.deepEqual(cmd(plan, 'browsers'), ['pnpm exec playwright install chromium']);
  assert.equal(plan.files.playwright, OLD_PLAYWRIGHT);
  assert.deepEqual(plan.config, { preset: 'vite-tailwind', packageManager: 'pnpm', stack: { styling: 'tailwind' } });
});

test('BE 기본 프리셋(nest-prisma-postgres)은 예전 체크리스트와 같은 명령을 낸다', () => {
  const plan = planScaffold({ stack: 'backend', root: '<project>', with: ['auth'] });
  assert.equal(plan.preset, 'nest-prisma-postgres');
  assert.deepEqual(cmd(plan, 'create'), ['npx @nestjs/cli@11 new <project> --skip-git --package-manager npm']);
  assert.deepEqual(pkgSet(cmd(plan, 'deps')[0], 'npm i '), new Set(OLD_BE_DEPS));
  assert.deepEqual(pkgSet(cmd(plan, 'devDeps')[0], 'npm i -D '), new Set(OLD_BE_DEV));
  // 고침: `prisma init`(6.19+)은 Prisma 7 모양 스키마를 써서 캐논 import 가 깨진다 → 고정 스키마 파일을 쓴다
  assert.deepEqual(cmd(plan, 'init'), []);
  assert.equal(cmd(plan, 'prismaSchema')[0], 'mkdir -p prisma');
  assert.match(cmd(plan, 'prismaSchema')[1], /scaffoldPreset\.mjs" backend --preset nest-prisma-postgres --file schema > prisma\/schema\.prisma$/);
  assert.match(plan.files.schema, /provider = "prisma-client-js"\n\}/);
  assert.ok(!/output\s*=/.test(plan.files.schema), 'output 을 두면 @prisma/client 에서 못 가져온다');
  assert.match(plan.files.schema, /provider = "postgresql"\n  url      = env\("DATABASE_URL"\)/);
  assert.deepEqual(cmd(plan, 'authDeps'), ['npm i @nestjs/jwt@^11 @nestjs/passport@^11 passport@^0.7 passport-jwt@^4 bcrypt@^5']);
  assert.deepEqual(cmd(plan, 'authDevDeps'), ['npm i -D @types/passport-jwt@^4 @types/bcrypt@^5']);
  assert.deepEqual(cmd(plan, 'install'), [], 'nest new 가 이미 설치한다 — 예전에도 따로 설치하지 않았다');
  // 순서: 생성 → 의존성 → Prisma 스키마 → 인증
  assert.deepEqual(plan.steps.map((s) => s.id), ['create', 'cd', 'deps', 'devDeps', 'prismaSchema', 'prismaSchema', 'authDeps', 'authDevDeps']);
  // compose: Postgres 16 + healthcheck + named volume, .env 와 같은 값
  assert.match(plan.files.compose, /image: postgres:16/);
  assert.match(plan.files.compose, /healthcheck:\n\s+test: \["CMD-SHELL", "pg_isready/);
  assert.match(plan.files.compose, /- db-data:\/var\/lib\/postgresql\/data/);
  assert.match(plan.files.compose, /"\$\{POSTGRES_PORT\}:5432"/);
  assert.match(plan.files.env, /^DATABASE_URL="postgresql:\/\/app:app@localhost:5432\/app\?schema=public"$/m);
  for (const k of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_PORT']) assert.match(plan.files.env, new RegExp(`^${k}=`, 'm'));
});

test('패키지 관리자에 맞춰 명령 모양이 바뀐다', () => {
  const fe = planScaffold({ stack: 'frontend', pm: 'npm', root: 'web' });
  assert.deepEqual(cmd(fe, 'create'), ['npm create vite@7 web -- --template react-ts']);
  assert.ok(cmd(fe, 'devDeps')[0].startsWith('npm i -D '));
  assert.ok(!cmd(fe, 'devDeps')[0].includes('--allow-build'), 'npm 에는 허용 목록을 넘기지 않는다');
  assert.match(fe.files.playwright, /VITE_USE_MOCKS=true npm run dev/);
  const be = planScaffold({ stack: 'backend', pm: 'pnpm', root: 'api' });
  assert.deepEqual(cmd(be, 'create'), ['pnpm dlx @nestjs/cli@11 new api --skip-git --package-manager pnpm']);
  assert.ok(cmd(be, 'deps')[0].startsWith('pnpm add '));
  assert.ok(cmd(be, 'deps')[0].includes('--allow-build=@prisma/client'));
  const y = planScaffold({ stack: 'backend', pm: 'yarn' });
  assert.ok(cmd(y, 'devDeps')[0].startsWith('yarn add -D '));
  assert.equal(be.config.packageManager, 'pnpm');
});

test('대체 BE 프리셋(nest-prisma-mysql): MySQL compose·env·컨테이너가 서로 맞다', () => {
  const plan = planScaffold({ stack: 'backend', preset: 'nest-prisma-mysql' });
  assert.match(plan.files.schema, /provider = "mysql"/);
  const dev = pkgSet(cmd(plan, 'devDeps')[0], 'npm i -D ');
  assert.ok(dev.has('@testcontainers/mysql@^10') && !dev.has('@testcontainers/postgresql@^10'));
  assert.match(plan.files.compose, /image: mysql:8\.4/);
  assert.match(plan.files.compose, /mysqladmin ping/);
  assert.match(plan.files.compose, /"\$\{MYSQL_PORT\}:3306"/);
  assert.match(plan.files.env, /^DATABASE_URL="mysql:\/\/root:app@localhost:3306\/app"$/m);
  assert.deepEqual(plan.config.stack, { orm: 'prisma', db: 'mysql' });
  // 설정 조각을 넣은 프로젝트는 스택 어댑터가 MySQL 컨테이너를 고른다(GEN-05)
  const dir = project({ '.dt-backend.json': plan.config, 'package.json': { dependencies: { '@prisma/client': '^6' } } });
  try {
    const st = resolveBackendStack(dir);
    assert.equal(st.db, 'mysql');
    assert.equal(st.container.package, '@testcontainers/mysql');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('대체 FE 프리셋(vite-css-vars): Tailwind 를 깔지 않고 styling 을 css-vars 로 적는다', () => {
  const plan = planScaffold({ stack: 'frontend', preset: 'vite-css-vars' });
  const all = [...pkgSet(cmd(plan, 'deps')[0], 'pnpm add '), ...pkgSet(cmd(plan, 'devDeps')[0], 'pnpm add -D ')];
  assert.ok(!all.some((p) => p.startsWith('tailwindcss') || p.startsWith('@tailwindcss/')), all.join(' '));
  assert.ok(all.includes('clsx@^2'));
  assert.deepEqual(plan.config.stack, { styling: 'css-vars' });
  assert.equal(plan.devUrl, 'http://localhost:5173');
});

test('선택 묶음과 잘못된 입력', () => {
  const plan = planScaffold({ stack: 'frontend', with: ['sentry'] });
  assert.ok(cmd(plan, 'sentryDeps')[0].startsWith('pnpm add @sentry/react@^11'));
  assert.throws(() => planScaffold({ stack: 'frontend', preset: 'next-app' }), /프리셋 'next-app' 은 없다/);
  assert.throws(() => planScaffold({ stack: 'frontend', pm: 'bun' }), /패키지 관리자 'bun'/);
  assert.throws(() => planScaffold({ stack: 'backend', with: ['sentry'] }), /--with 'sentry'/);
  assert.throws(() => loadPreset('mobile'), /frontend \| backend/);
});

test('CLI: --list · 명령 · --file', () => {
  const list = spawnSync(process.execPath, [CLI, 'backend', '--list'], { encoding: 'utf8' });
  assert.equal(list.status, 0);
  assert.match(list.stdout, /^\* nest-prisma-postgres/m);
  const cmds = spawnSync(process.execPath, [CLI, 'frontend', '--pm', 'yarn', '--root', 'web'], { encoding: 'utf8' });
  assert.match(cmds.stdout, /^yarn create vite@7 web --template react-ts$/m);
  const cfg = spawnSync(process.execPath, [CLI, 'backend', '--preset', 'nest-prisma-mysql', '--file', 'config'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(cfg.stdout).stack, { orm: 'prisma', db: 'mysql' });
  const bad = spawnSync(process.execPath, [CLI, 'backend', '--file', 'playwright'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

// --- FE 스타일(stack.styling) ---
test('stack.styling: 설정 → package.json → tailwind', () => {
  const cases = [
    [{}, {}, 'tailwind', '기본값'],
    [{}, { devDependencies: { tailwindcss: '^4' } }, 'tailwind', 'package.json'],
    [{}, { devDependencies: { sass: '^1' } }, 'scss', 'package.json'],
    [{ stack: { styling: 'css-vars' } }, { devDependencies: { tailwindcss: '^4' } }, 'css-vars', '설정'],
  ];
  for (const [cfg, pkg, want, from] of cases) {
    const dir = project({ 'package.json': pkg });
    try {
      const st = resolveFrontendStack(dir, cfg);
      assert.equal(st.styling, want); assert.equal(st.from.styling, from); assert.equal(st.tokenEmit, want);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  assert.throws(() => resolveFrontendStack(tmpdir(), { stack: { styling: 'less' } }), /stack\.styling 'less'/);
});

test('view-styling: tailwind 는 지금 규칙 그대로, css-vars 는 SCSS 만, scss 는 건너뛴다', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.frontend);
  const pick = (styling) => applyStackAdapters(rules, { styling });
  const vs = (r) => r.rules.find((x) => x.ruleId === 'view-styling');
  assert.deepEqual(vs(pick('tailwind')).detection[0].matches, ['**/*.scss', '**/*.sass', '**/*.css']); // GEN-07 전 리터럴
  assert.deepEqual(vs(pick('css-vars')).detection[0].matches, ['**/*.scss', '**/*.sass']);
  const scss = pick('scss');
  assert.equal(vs(scss), undefined);
  assert.deepEqual(scss.skipped, [{ ruleId: 'view-styling', area: 'styling', value: 'scss' }]);
  // 빈칸이 없는 규칙은 그대로 같은 객체다
  assert.equal(pick('tailwind').rules.find((x) => x.ruleId === 'design-fidelity'), rules.find((x) => x.ruleId === 'design-fidelity'));
});

const VIEW = `import s from './Card.module.css';\nexport function Card() { return <div className={s.card} />; }\n`;
const runFe = (dir) => spawnSync(process.execPath, [REVIEW, 'full', '--no-coverage', '--stack', 'frontend', '--project', dir], { encoding: 'utf8' });

for (const [styling, hit] of [['tailwind', true], ['css-vars', false], ['scss', false]]) {
  test(`리뷰: CSS 모듈을 import 한 View — stack.styling ${styling} 이면 view-styling ${hit ? '위반' : '없음'}`, () => {
    const dir = project({
      '.dt-frontend.json': { stack: { styling }, coverage: { mode: 'off' } },
      'package.json': { name: 'x' },
      'src/components/view/Card.tsx': VIEW,
      'src/components/view/Card.module.css': '.card { color: var(--color-primary); }\n',
    });
    try {
      const r = runFe(dir);
      assert.ok([0, 1].includes(r.status), r.stderr);
      assert.equal(/view-styling/.test(r.stdout.split('\n').filter((l) => l.startsWith('- ')).join('\n')), hit, r.stdout);
      assert.match(r.stdout, new RegExp(`스택: styling ${styling}\\(설정\\)`));
      if (styling === 'scss') assert.match(r.stdout, /건너뛴 규칙\(스택에 맞지 않음\): view-styling\(stack\.styling = scss\)/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

// --- 토큰 출력 ---
const TOK = { colors: [{ name: 'Primary', value: '#123456' }], typography: [{ name: 'Body', family: 'Pretendard', weight: 400, size: 14 }], spacing: [4], radius: [6] };

test('토큰 출력: 세 방식이 같은 변수 이름을 쓰고, 감싸기만 다르다', () => {
  const tw = renderThemeBlock(TOK, 'tailwind'); const css = renderThemeBlock(TOK, 'css-vars'); const scss = renderThemeBlock(TOK, 'scss');
  assert.match(tw, /@theme \{\n[\s\S]*--color-primary: #123456;/);
  assert.match(css, /:root \{\n[\s\S]*--color-primary: #123456;/);
  assert.match(scss, /^\$color-primary: #123456;$/m);
  assert.match(scss, /^\$radius-6: 6px;$/m);
  assert.ok(!/bg-background|rounded-\*/.test(css + scss), 'Tailwind 클래스 예시는 Tailwind 방식에만');
  assert.equal(renderThemeBlock(TOK), tw, '기본은 tailwind');
  assert.match(mergeIntoGlobals('', tw, 'tailwind'), /^@import "tailwindcss";/);
  assert.ok(!mergeIntoGlobals('', css, 'css-vars').includes('tailwindcss'));
  assert.throws(() => renderThemeBlock(TOK, 'less'), /모르는 토큰 출력 방식/);
});

test('토큰 CLI: --emit 이 없으면 stack.styling 을 따르고, scss 는 _tokens.scss 에 쓴다', () => {
  const ctx = '## 디자인 토큰\n\n### 색\n- Primary: #123456\n';
  const dir = project({ '.dt-frontend.json': { stack: { styling: 'scss' } }, 'docs/project-context.md': ctx });
  try {
    const r = spawnSync(process.execPath, [TOKENS, '--project', dir], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /출력 방식 scss \[stack\.styling scss\(설정\)\]/);
    assert.match(readFileSync(join(dir, 'src/styles/_tokens.scss'), 'utf8'), /^\$color-primary: #123456;$/m);
    assert.ok(!existsSync(join(dir, 'src/styles/globals.css')));
    // 다시 돌려도 마커 블록만 바뀐다
    const r2 = materialize({ contextPath: join(dir, 'docs/project-context.md'), outPath: join(dir, 'src/styles/_tokens.scss'), emit: 'scss' });
    assert.equal(r2.changed, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --- 게이트 ---
test('게이트: Prisma 검사는 --prisma 가 없으면 BE stack.orm 이 prisma 일 때만', () => {
  const prisma = project({ 'package.json': { dependencies: { '@prisma/client': '^6' } } });
  const typeorm = project({ 'package.json': { dependencies: { typeorm: '^0.3' } } });
  try {
    assert.deepEqual(pickPrismaGate(prisma, 'backend', undefined), { run: true, from: 'stack.orm prisma(package.json)' });
    assert.equal(pickPrismaGate(typeorm, 'backend', undefined).run, false);
    assert.equal(pickPrismaGate(typeorm, 'backend', 'true').run, true, '--prisma true 로 덮어쓴다');
    assert.equal(pickPrismaGate(prisma, 'backend', 'false').run, false);
    assert.equal(pickPrismaGate(prisma, 'frontend', undefined).run, false);
  } finally { rmSync(prisma, { recursive: true, force: true }); rmSync(typeorm, { recursive: true, force: true }); }
});
