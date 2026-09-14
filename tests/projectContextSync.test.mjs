import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMetaHeader,
  serializeMetaHeader,
  needsSync
} from '../scripts/projectContextSync.mjs';

test('parseMetaHeader: 표준 메타 추출', () => {
  const md = `<!-- Synced from package.json -->
<!-- lastSyncedAt: 2026-05-27T10:00:00Z, packageJsonMtime: 2026-05-27T09:55:00Z -->

# Project Context
...`;
  const meta = parseMetaHeader(md);
  assert.equal(meta.lastSyncedAt, '2026-05-27T10:00:00Z');
  assert.equal(meta.packageJsonMtime, '2026-05-27T09:55:00Z');
});

test('parseMetaHeader: 메타 없으면 null 필드', () => {
  const md = `# Project Context\nno meta header`;
  const meta = parseMetaHeader(md);
  assert.equal(meta.lastSyncedAt, null);
  assert.equal(meta.packageJsonMtime, null);
});

test('serializeMetaHeader: 정확한 형식', () => {
  const out = serializeMetaHeader({
    lastSyncedAt: '2026-05-27T10:00:00Z',
    packageJsonMtime: '2026-05-27T09:55:00Z'
  });
  assert.equal(
    out,
    '<!-- Synced from package.json -->\n<!-- lastSyncedAt: 2026-05-27T10:00:00Z, packageJsonMtime: 2026-05-27T09:55:00Z -->'
  );
});

test('needsSync: package.json mtime이 메타보다 새로우면 true', () => {
  assert.equal(needsSync({
    currentPkgMtime: new Date('2026-05-27T10:00:00Z'),
    storedPkgMtime: new Date('2026-05-27T09:00:00Z')
  }), true);
});

test('needsSync: 동일 mtime이면 false', () => {
  assert.equal(needsSync({
    currentPkgMtime: new Date('2026-05-27T10:00:00Z'),
    storedPkgMtime: new Date('2026-05-27T10:00:00Z')
  }), false);
});

test('needsSync: storedPkgMtime이 null이면 true (최초)', () => {
  assert.equal(needsSync({
    currentPkgMtime: new Date('2026-05-27T10:00:00Z'),
    storedPkgMtime: null
  }), true);
});
