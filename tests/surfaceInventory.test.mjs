import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { surfaceInventory } from '../scripts/surfaceInventory.mjs';

const fx = (name) => fileURLToPath(new URL(`./fixtures/guide/surface/${name}/`, import.meta.url));
const routes = (r) => r.screens.map((s) => s.route);
const cli = fileURLToPath(new URL('../scripts/surfaceInventory.mjs', import.meta.url));
const runCli = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('react-router: createBrowserRouter path 리터럴 → 화면, RequireAuth 감싼 라우트는 guard', () => {
  const r = surfaceInventory({ projectRoot: fx('react-router') });
  assert.equal(r.type, 'web');
  assert.equal(r.router, 'react-router');
  assert.deepEqual(routes(r), ['/', '/feed/:id', '/users/me/edit']);
  assert.ok(!routes(r).includes('/should-not-appear')); // src/test-utils/** 는 테스트 파일이라 화면이 아니다
  const edit = r.screens.find((s) => s.route === '/users/me/edit');
  assert.equal(edit.authHint, 'guard');
  assert.equal(edit.kind, 'route');
  assert.equal(edit.file, 'src/App.tsx');
  assert.equal(r.screens[0].line, 3);
});

test('next-app: app/**/page.* → 디렉터리 경로, api/route.ts·layout 제외, 라우트 그룹은 경로에서 빠진다', () => {
  const r = surfaceInventory({ projectRoot: fx('next-app') });
  assert.equal(r.router, 'next-app');
  // app/(marketing)/page.tsx 는 그룹만 벗기면 빈 문자열 — 루트 '/' 여야 한다. app/page.tsx 와 같은 '/' 로 겹치는 건 실제 프로젝트에서도 나는 충돌이라 둘 다 낸다(file 로 구분).
  assert.deepEqual(routes(r), ['/', '/', '/feed/[id]', '/pricing']);
  assert.ok(!routes(r).includes(''));
  assert.deepEqual(r.screens.filter((s) => s.route === '/').map((s) => s.file), ['app/(marketing)/page.tsx', 'app/page.tsx']);
});

test('next-pages: pages/** → 경로, _app·api 제외, getServerSession → guard', () => {
  const r = surfaceInventory({ projectRoot: fx('next-pages') });
  assert.equal(r.router, 'next-pages');
  assert.deepEqual(routes(r), ['/', '/users/[id]']);
  assert.equal(r.screens.find((s) => s.route === '/users/[id]').authHint, 'guard');
});

test('electron: 라우터 없음 → BrowserWindow·메뉴 label·*Page|*View 컴포넌트가 화면, ipc 채널·외부 URL 수집', () => {
  const r = surfaceInventory({ projectRoot: fx('electron') });
  assert.equal(r.type, 'electron');
  assert.equal(r.router, 'none');
  const kinds = Object.fromEntries(r.screens.map((s) => [s.route, s.kind]));
  assert.equal(kinds['window:main'], 'window');
  assert.equal(kinds['menu:설정'], 'menu');
  assert.equal(kinds['menu:업데이트 확인…'], 'menu');
  assert.equal(kinds['view:ProjectListPage'], 'view');
  assert.equal(kinds['view:SettingsPage'], 'view');
  assert.equal(kinds['view:Button'], undefined);
  assert.deepEqual(r.ipcChannels, ['guide:open', 'project:list']);
  assert.equal(r.externalRedirects.length, 2);
  assert.ok(r.externalRedirects.some((e) => e.file === 'electron/auth.ts' && /accounts\.example\.com/.test(e.match)));
  assert.ok(r.externalRedirects.some((e) => e.file === 'electron/menu.ts' && /openExternal/.test(e.match)));
});

test('type 강제: web 프로젝트를 electron 으로 지정하면 라우트 + view 폴백을 함께 낸다 (힌트는 최대한 — D13)', () => {
  const r = surfaceInventory({ projectRoot: fx('react-router'), type: 'electron' });
  assert.equal(r.type, 'electron');
  assert.deepEqual(routes(r), ['/', '/feed/:id', '/users/me/edit', 'view:AdminPage']);
  assert.equal(r.router, 'react-router');
  assert.equal(r.confidence, 'detected');
});

test('모르는 프로젝트(vue-router): router unknown + hints 로 모른다고 말하고, 화면은 비어도 예외 없이 반환 (D13)', () => {
  const r = surfaceInventory({ projectRoot: fx('vue-unknown') });
  assert.equal(r.type, 'web');
  assert.equal(r.router, 'unknown');
  assert.deepEqual(r.hints, ['vue', 'vue-router']);
  assert.deepEqual(r.screens, []);
  assert.equal(r.confidence, 'fallback');
});

test('detected 라우터에서도 hints 는 채워진다 (react-router-dom·next·next-auth)', () => {
  assert.deepEqual(surfaceInventory({ projectRoot: fx('react-router') }).hints, ['react-router-dom']);
  assert.equal(surfaceInventory({ projectRoot: fx('react-router') }).confidence, 'detected');
  assert.deepEqual(surfaceInventory({ projectRoot: fx('next-pages') }).hints, ['next', 'next-auth']);
});

test('electron 이 최상위가 아니어도(src/electron/**) 타입·창·ipc 를 잡는다', () => {
  const r = surfaceInventory({ projectRoot: fx('electron-nested') });
  assert.equal(r.type, 'electron');
  assert.ok(routes(r).includes('window:main'));
  assert.deepEqual(r.ipcChannels, ['x:y']);
});

test('망가진 package.json 은 힌트만 비우고 나머지는 그대로 낸다 (예외 없음 — D13)', () => {
  const r = surfaceInventory({ projectRoot: fx('bad-pkg') });
  assert.deepEqual(r.hints, []);
  assert.equal(r.router, 'react-router');
});

test('CLI: --type 은 web|electron 만 받고, 플래그가 앞서도 projectRoot 를 찾는다', () => {
  const bad = runCli(fx('react-router'), '--type', 'vue');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Usage:/);
  const ok = runCli('--type', 'electron', fx('react-router'));
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /^type electron · router react-router/);
});

test('CLI: 라우터를 모르거나 화면이 적으면 "직접 따라가라" 힌트 줄을 덧붙인다 (D13)', () => {
  const unknown = runCli(fx('vue-unknown'));
  assert.equal(unknown.status, 0);
  assert.match(unknown.stdout, /^힌트: 이 스크립트는 아는 패턴만 뽑는다/m);
  assert.match(unknown.stdout, /\(hints: vue, vue-router\)$/m);
  assert.doesNotMatch(runCli(fx('react-router')).stdout, /^힌트:/m);
});

test('CLI: 프로젝트 폴더 안에서 루트를 . 로 줘도 인벤토리를 낸다', () => {
  const r = spawnSync(process.execPath, [cli, '.', '--json'], { cwd: fx('react-router'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).type, 'web');
});
