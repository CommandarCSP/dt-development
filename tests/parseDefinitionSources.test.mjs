import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDefinitionSources, discoverLeafSpecs, discoverDefinitions } from '../scripts/parseDefinitionSources.mjs';

test('parseDefinitionSources: figma 페이지 여러 개 허용 (프로젝트 단위)', () => {
  const { sources } = parseDefinitionSources(['0:1', '5:2', './notes.md']);
  assert.equal(sources.length, 3);
  assert.deepEqual(sources[0], { type: 'figma', locator: '0:1' });
  assert.deepEqual(sources[1], { type: 'figma', locator: '5:2' });
  assert.deepEqual(sources[2], { type: 'markdown', locator: './notes.md' });
});

test('parseDefinitionSources: --source 플래그 지원', () => {
  const { sources } = parseDefinitionSources(['--source', '0:1', '--source', 'https://notion.so/x']);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].type, 'figma');
  assert.equal(sources[1].type, 'web');
});

test('parseDefinitionSources: 소스 0개면 에러', () => {
  assert.throws(() => parseDefinitionSources([]), /소스가 없습니다/);
});

test('discoverLeafSpecs: pages·resources 하위 디렉터리를 leaf-spec으로 발견·태그', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-leaf-'));
  mkdirSync(join(root, 'docs', 'specs', 'pages', 'login'), { recursive: true });
  mkdirSync(join(root, 'docs', 'specs', 'resources', 'orders'), { recursive: true });
  const found = discoverLeafSpecs({ projectRoot: root });
  assert.equal(found.length, 2);
  assert.ok(found.every(s => s.role === 'leaf-spec'));
  assert.ok(found.some(s => s.locator.endsWith(join('pages', 'login'))));
  assert.ok(found.some(s => s.locator.endsWith(join('resources', 'orders'))));
  rmSync(root, { recursive: true, force: true });
});

test('discoverLeafSpecs: pages/resources 없으면 빈 배열(에러 아님)', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-leaf-'));
  assert.deepEqual(discoverLeafSpecs({ projectRoot: root }), []);
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: 정의서 없으면 빈 배열', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  assert.deepEqual(discoverDefinitions({ projectRoot: root }), []);
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: bare definition.md → scope null', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'definition.md'), '# x');
  const found = discoverDefinitions({ projectRoot: root });
  assert.equal(found.length, 1);
  assert.equal(found[0].scope, null);
  assert.ok(found[0].path.endsWith('definition.md'));
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: scoped definition.backoffice.md → scope backoffice', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'definition.backoffice.md'), '# x');
  const found = discoverDefinitions({ projectRoot: root });
  assert.equal(found.length, 1);
  assert.equal(found[0].scope, 'backoffice');
  assert.ok(found[0].path.endsWith('definition.backoffice.md'));
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: bare + 다중 scoped 공존', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'definition.md'), '# x');
  writeFileSync(join(root, 'docs', 'specs', 'definition.backoffice.md'), '# x');
  writeFileSync(join(root, 'docs', 'specs', 'definition.front-service.md'), '# x');
  const found = discoverDefinitions({ projectRoot: root });
  assert.equal(found.length, 3);
  // WHY: null이 섞인 배열을 sort()하면 'null' 문자열 강제 변환에 의존하므로 집합 비교로 검증.
  const scopes = found.map(d => d.scope);
  assert.ok(scopes.includes(null), 'bare definition.md → scope null 포함');
  assert.ok(scopes.includes('backoffice'));
  assert.ok(scopes.includes('front-service'));
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: docs/specs 있으나 definition* 없으면 빈 배열', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'spec.md'), '# x');
  assert.deepEqual(discoverDefinitions({ projectRoot: root }), []);
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: 후행 대시 슬러그(definition.x-.md)는 제외', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'definition.x-.md'), '# x');
  writeFileSync(join(root, 'docs', 'specs', 'definition.a.md'), '# x'); // 단일 문자 슬러그는 유효
  const found = discoverDefinitions({ projectRoot: root });
  const scopes = found.map(d => d.scope);
  assert.ok(scopes.includes('a'), '단일 문자 슬러그는 유효');
  assert.ok(!scopes.includes('x-'), '후행 대시 슬러그는 제외');
  rmSync(root, { recursive: true, force: true });
});

test('discoverDefinitions: 비대상 파일(.bak·다른 md) 제외', () => {
  const root = mkdtempSync(join(tmpdir(), 'def-src-'));
  mkdirSync(join(root, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(root, 'docs', 'specs', 'definition.md'), '# x');
  writeFileSync(join(root, 'docs', 'specs', 'definition.md.bak'), '# x');
  writeFileSync(join(root, 'docs', 'specs', 'readme.md'), '# x');
  const found = discoverDefinitions({ projectRoot: root });
  assert.equal(found.length, 1);
  assert.equal(found[0].scope, null);
  rmSync(root, { recursive: true, force: true });
});
