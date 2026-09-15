import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { collectEntrypoints } from '../scripts/entrypoints.mjs';

const FIX = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'entrypoints-project');

test('IPC 핸들러를 찾는다', () => {
  const names = collectEntrypoints(FIX).entrypoints.filter((e) => e.kind === 'ipc').map((e) => e.name).sort();
  assert.deepEqual(names, ['app:quit', 'doc:save']);
});

test('HTTP 엔드포인트를 컨트롤러 접두어와 합쳐 찾는다', () => {
  const names = collectEntrypoints(FIX).entrypoints.filter((e) => e.kind === 'http').map((e) => e.name).sort();
  assert.deepEqual(names, ['GET orders/:id', 'POST orders']);
});

test('라우트를 찾는다', () => {
  const names = collectEntrypoints(FIX).entrypoints.filter((e) => e.kind === 'route').map((e) => e.name).sort();
  assert.deepEqual(names, ['/docs/:id', '/login']);
});

test('id 는 유일하고 파일·줄이 붙는다', () => {
  const { entrypoints } = collectEntrypoints(FIX);
  assert.equal(new Set(entrypoints.map((e) => e.id)).size, entrypoints.length);
  for (const e of entrypoints) {
    assert.ok(e.file && !e.file.startsWith('/'), `${e.id}: 파일은 상대경로여야 한다`);
    assert.ok(e.line > 0, `${e.id}: 줄 번호가 없다`);
  }
});

test('종류별 개수를 센다', () => {
  const { counts } = collectEntrypoints(FIX);
  assert.equal(counts.ipc, 2);
  assert.equal(counts.http, 2);
  assert.equal(counts.route, 2);
});

test('채널을 상수로 넘긴 IPC 등록도 찾는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'ep-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'ipc.ts'),
    'ipcMain.handle(CH.shellPickFiles, async () => {});\nipcMain.handle(channel, h);\n', 'utf8');
  const names = collectEntrypoints(root).entrypoints.filter((e) => e.kind === 'ipc').map((e) => e.name).sort();
  assert.deepEqual(names, ['CH.shellPickFiles', 'channel']);
});
