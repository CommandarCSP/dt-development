import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildDepGraph } from '../scripts/depGraph.mjs';

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'dep-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body, 'utf8');
  }
  return root;
}

test('상대 import 를 간선으로 만든다', () => {
  const root = project({ 'src/a.ts': "import { b } from './b';\n", 'src/b.ts': 'export const b = 1;\n' });
  assert.deepEqual(buildDepGraph(root).edges, [['src/a.ts', 'src/b.ts']]);
});

test('패키지 import 는 간선이 아니다', () => {
  const root = project({ 'src/a.ts': "import React from 'react';\n" });
  assert.equal(buildDepGraph(root).edges.length, 0);
});

test('디렉터리 index 로도 해석한다', () => {
  const root = project({ 'src/a.ts': "import './lib';\n", 'src/lib/index.ts': 'export const x = 1;\n' });
  assert.deepEqual(buildDepGraph(root).edges, [['src/a.ts', 'src/lib/index.ts']]);
});

test('디렉터리별 군집에 응집도가 붙는다', () => {
  const root = project({
    'src/core/a.ts': "import './b';\n",
    'src/core/b.ts': 'export const b = 1;\n',
    'src/ui/c.ts': "import '../core/a';\n",
  });
  const core = buildDepGraph(root).clusters.find((c) => c.dir === 'src/core');
  assert.equal(core.files.length, 2);
  assert.equal(core.internal, 1);
  assert.equal(core.inbound, 1);
  assert.equal(core.outbound, 0);
  assert.ok(core.cohesion > 0 && core.cohesion <= 1);
});

test('ESM 관례의 .js 확장자 import 를 .ts 파일로 푼다', () => {
  const root = project({ 'src/a.ts': "import { m } from './menu.js';\n", 'src/menu.ts': 'export const m = 1;\n' });
  assert.deepEqual(buildDepGraph(root).edges, [['src/a.ts', 'src/menu.ts']]);
});
