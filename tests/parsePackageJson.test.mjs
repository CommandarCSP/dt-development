import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePackageJson } from '../scripts/parsePackageJson.mjs';

test('parsePackageJson: dependencies + devDependencies를 병합해 단일 객체로 반환', () => {
  const pkg = {
    dependencies: { 'react': '^19.0.0', '@tanstack/react-query': '^5.0.0' },
    devDependencies: { 'vite': '^6.0.0', 'vitest': '^3.0.0' },
    packageManager: 'pnpm@10.0.0',
    engines: { node: '>=20' }
  };
  const result = parsePackageJson(pkg);
  assert.deepEqual(result.dependencies, {
    'react': '^19.0.0',
    '@tanstack/react-query': '^5.0.0',
    'vite': '^6.0.0',
    'vitest': '^3.0.0'
  });
  assert.equal(result.packageManager, 'pnpm@10.0.0');
  assert.equal(result.nodeVersion, '>=20');
});

test('parsePackageJson: packageManager/engines.node 누락 시 null', () => {
  const pkg = {
    dependencies: { 'astro': '^5.0.0' }
  };
  const result = parsePackageJson(pkg);
  assert.deepEqual(result.dependencies, { 'astro': '^5.0.0' });
  assert.equal(result.packageManager, null);
  assert.equal(result.nodeVersion, null);
});

test('parsePackageJson: dependencies/devDependencies 모두 부재', () => {
  const result = parsePackageJson({});
  assert.deepEqual(result.dependencies, {});
  assert.equal(result.packageManager, null);
  assert.equal(result.nodeVersion, null);
});

test('parsePackageJson: dependencies와 devDependencies에 동일 이름 있을 때 devDependencies가 덮어씀', () => {
  const pkg = {
    dependencies: { 'typescript': '^5.0.0' },
    devDependencies: { 'typescript': '^5.5.0' }
  };
  const result = parsePackageJson(pkg);
  assert.equal(result.dependencies.typescript, '^5.5.0');
});
