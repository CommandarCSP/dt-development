// 커버리지 명령 고르기(GEN-08) — 설정 → package.json → lockfile → 스택 기본값.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveCoverageCommands } from '../../scripts/review/lib/stacks.mjs';

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-cov-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  return dir;
}
const flat = ([cmd, args]) => [cmd, ...args].join(' ');

test('설정·lockfile 이 없으면 지금까지의 기본 명령과 같다', () => {
  const fe = project({ 'package.json': { scripts: { test: 'vitest' } } });
  const be = project({});
  try {
    const f = resolveCoverageCommands('frontend', fe);
    assert.equal(flat(f.testCommand), 'pnpm test --run --coverage --coverage.reporter=json-summary');
    assert.equal(flat(f.installCommand), 'pnpm install --prefer-frozen-lockfile');
    const b = resolveCoverageCommands('backend', be);
    assert.equal(flat(b.testCommand), 'npx jest --coverage --coverageReporters=json-summary');
    assert.equal(flat(b.installCommand), 'npm ci');
  } finally { rmSync(fe, { recursive: true, force: true }); rmSync(be, { recursive: true, force: true }); }
});

test('npm + jest 를 쓰는 FE 는 lockfile·의존성을 보고 npx jest 로 잰다', () => {
  const dir = project({ 'package-lock.json': '{}', 'package.json': { devDependencies: { jest: '^29' } } });
  try {
    const r = resolveCoverageCommands('frontend', dir);
    assert.equal(r.packageManager, 'npm');
    assert.equal(r.runner, 'jest');
    assert.equal(flat(r.testCommand), 'npx jest --coverage --coverageReporters=json-summary');
    assert.equal(flat(r.installCommand), 'npm ci');
    assert.match(r.describe, /package-lock\.json/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('vitest 를 쓰는 BE 는 vitest run 으로 잰다', () => {
  const dir = project({ 'package-lock.json': '{}', 'package.json': { devDependencies: { vitest: '^2' } } });
  try {
    const r = resolveCoverageCommands('backend', dir);
    assert.equal(flat(r.testCommand), 'npx vitest run --coverage --coverage.reporter=json-summary');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pnpm·yarn lockfile 과 package.json packageManager 를 읽는다', () => {
  const pn = project({ 'pnpm-lock.yaml': '', 'package.json': { devDependencies: { jest: '^29' } } });
  const yn = project({ 'yarn.lock': '', 'package.json': { devDependencies: { vitest: '^2' } } });
  const decl = project({ 'package-lock.json': '{}', 'package.json': { packageManager: 'yarn@4.1.0', devDependencies: { jest: '^29' } } });
  try {
    assert.equal(flat(resolveCoverageCommands('backend', pn).testCommand), 'pnpm exec jest --coverage --coverageReporters=json-summary');
    const y = resolveCoverageCommands('frontend', yn);
    assert.equal(flat(y.testCommand), 'yarn vitest run --coverage --coverage.reporter=json-summary');
    assert.equal(flat(y.installCommand), 'yarn install --frozen-lockfile');
    assert.equal(resolveCoverageCommands('backend', decl).packageManager, 'yarn');
  } finally { for (const d of [pn, yn, decl]) rmSync(d, { recursive: true, force: true }); }
});

test('설정 coverage.runner·packageManager 가 프로젝트 추측보다 앞선다', () => {
  const dir = project({ 'package-lock.json': '{}', 'package.json': { devDependencies: { jest: '^29', vitest: '^2' } } });
  try {
    const r = resolveCoverageCommands('backend', dir, { runner: 'vitest', packageManager: 'pnpm' });
    assert.equal(flat(r.testCommand), 'pnpm exec vitest run --coverage --coverage.reporter=json-summary');
    assert.match(r.describe, /설정/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('두 도구가 다 있으면 scripts.test 로 가린다', () => {
  const dir = project({ 'package.json': { scripts: { test: 'jest --runInBand' }, devDependencies: { jest: '^29', vitest: '^2' } } });
  try { assert.equal(resolveCoverageCommands('frontend', dir).runner, 'jest'); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('coverage.command·installCommand 는 그대로 쓴다(문자열은 셸, 배열은 인자)', () => {
  const dir = project({});
  try {
    const r = resolveCoverageCommands('frontend', dir, { command: 'make coverage', installCommand: ['bun', 'install'] });
    assert.deepEqual(r.testCommand, ['sh', ['-c', 'make coverage']]);
    assert.deepEqual(r.installCommand, ['bun', ['install']]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('모르는 runner·packageManager 는 고칠 방법과 함께 막는다', () => {
  assert.throws(() => resolveCoverageCommands('frontend', tmpdir(), { runner: 'mocha' }), /vitest \| jest.*coverage\.command/);
  assert.throws(() => resolveCoverageCommands('frontend', tmpdir(), { packageManager: 'bun' }), /pnpm \| npm \| yarn/);
});

test('옛 경로 skills/dt-frontend-review/scripts/review.mjs 는 새 엔진을 부르고 경고한다', () => {
  const shim = fileURLToPath(new URL('../../skills/dt-frontend-review/scripts/review.mjs', import.meta.url));
  const engine = fileURLToPath(new URL('../../scripts/review/review.mjs', import.meta.url));
  const dir = project({});
  try {
    const args = ['partial', '--paths', 'none.ts', '--project', dir];
    const old = spawnSync(process.execPath, [shim, ...args], { encoding: 'utf8' });
    const neu = spawnSync(process.execPath, [engine, ...args], { encoding: 'utf8' });
    assert.equal(old.status, neu.status);
    assert.equal(old.stdout, neu.stdout);
    assert.match(old.stderr, /옛 경로.*scripts\/review\/review\.mjs/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
