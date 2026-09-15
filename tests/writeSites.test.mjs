import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { collectWriteSites } from '../scripts/writeSites.mjs';

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'ws-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body, 'utf8');
  }
  return root;
}

test('DB 쓰기를 모델별로 모은다', () => {
  const root = project({ 'src/repo.ts': 'await prisma.order.create({ data });\nawait prisma.order.update({ where });\n' });
  assert.deepEqual(collectWriteSites(root).byTarget['db:order'], ['src/repo.ts']);
});

test('파일 쓰기와 스토어 갱신을 가른다', () => {
  const root = project({ 'src/fs.ts': 'writeFileSync(path, data);\n', 'src/store.ts': 'set({ count: 1 });\n' });
  const { sites } = collectWriteSites(root);
  assert.ok(sites.some((s) => s.kind === 'file'));
  assert.ok(sites.some((s) => s.kind === 'store'));
});

test('읽기만 하는 코드는 쓰기 지점이 아니다', () => {
  const root = project({ 'src/read.ts': 'const rows = await prisma.order.findMany();\nreadFileSync(p);\n' });
  assert.equal(collectWriteSites(root).sites.length, 0);
});

test('쓰기 주체가 둘 이상이면 multiOwner 에 오른다', () => {
  const root = project({
    'src/a.ts': 'await prisma.order.create({});\n',
    'src/b.ts': 'await prisma.order.delete({});\n',
    'src/c.ts': 'await prisma.user.create({});\n',
  });
  assert.deepEqual(collectWriteSites(root).multiOwner, ['db:order']);
});

test('쓰기 지점에 파일과 줄이 붙는다', () => {
  const root = project({ 'src/a.ts': '// 주석\nawait prisma.order.create({});\n' });
  const s = collectWriteSites(root).sites[0];
  assert.equal(s.file, 'src/a.ts');
  assert.equal(s.line, 2);
});
