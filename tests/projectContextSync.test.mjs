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

// --- GEN-34: 절 단위 병합 — FE·BE 가 서로 덮어쓰지 않는다 ---
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mergeStackSections, migrateLegacy, detectLegacy, parseSections } from '../scripts/projectContextSync.mjs';

const tmpl = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const fill = (t, values) => t.replace(/\{\{([A-Z_]+)[^}]*\}\}/g, (_, k) => values[k] ?? `(${k.toLowerCase()})`);
const FE = (v = {}) => fill(tmpl('templates/project-context.md.tmpl'), { OVERVIEW: 'FE 개요', FRAMEWORK: 'react', DESIGN_TOKENS: '### 색\n- primary: #000', ...v });
const BE = (v = {}) => fill(tmpl('templates-backend/project-context.md.tmpl'), { OVERVIEW: 'BE 개요', FRAMEWORK: 'nestjs', ERROR_ENVELOPE: '{ code, message }', ...v });
const keys = (md) => parseSections(md).sections.map((s) => s.key);

test('merge: BE → FE 순서여도 BE 절(공유 규약)이 남는다', () => {
  let md = mergeStackSections('', 'backend', BE()).md;
  md = mergeStackSections(md, 'frontend', FE()).md;
  assert.ok(md.includes('{ code, message }'));
  assert.ok(md.includes('primary: #000'));
  assert.deepEqual(keys(md), ['개요', 'FE 기술 스택', 'FE 프로젝트 기술/라이브러리', '디자인 토큰', 'BE 기술 스택', 'BE 프로젝트 기술/라이브러리', '공유 규약', '제약사항', '도메인 용어']);
});

test('merge: FE → BE 순서여도 FE 절(디자인 토큰)이 남는다', () => {
  let md = mergeStackSections('', 'frontend', FE()).md;
  md = mergeStackSections(md, 'backend', BE()).md;
  assert.ok(md.includes('primary: #000') && md.includes('{ code, message }'));
});

test('merge: 공통 절은 먼저 쓴 쪽(사용자 편집)을 지키고, 자기 절만 바꾼다', () => {
  let md = mergeStackSections('', 'frontend', FE()).md.replace('FE 개요', '사람이 고친 개요');
  md = mergeStackSections(md, 'backend', BE()).md;
  md = mergeStackSections(md, 'frontend', FE({ FRAMEWORK: 'next' })).md;
  assert.ok(md.includes('사람이 고친 개요') && !md.includes('BE 개요'));
  assert.ok(md.includes('Framework: next') && md.includes('Framework: nestjs'));
  assert.equal((md.match(/^## 개요/gm) || []).length, 1);
});

test('merge: 모르는 절은 그대로 둔다', () => {
  const md = mergeStackSections(mergeStackSections('', 'frontend', FE()).md + '\n## 메모\n손으로 적은 것\n', 'backend', BE()).md;
  assert.ok(md.includes('## 메모\n손으로 적은 것'));
});

test('merge 결과의 디자인 토큰을 materialize-tokens 의 절 규칙(## 디자인 토큰 → ### 하위)으로 읽을 수 있다', () => {
  const md = mergeStackSections(mergeStackSections('', 'backend', BE()).md, 'frontend', FE()).md;
  const sec = md.match(/^##\s+디자인\s*토큰\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  assert.ok(sec && /### 색\n- primary: #000/.test(sec[1]));
});

test('옛 형식: 감지하고, merge 는 거절하며, migrate 는 절 이름만 바꾼다', () => {
  const oldBe = BE().replace('# Project Context', '# Project Context (Backend)').replace('## BE 기술 스택', '## 기술 스택').replace('## BE 프로젝트 기술/라이브러리', '## 프로젝트 기술/라이브러리');
  const oldFe = FE().replace('## FE 기술 스택', '## 기술 스택').replace('## FE 프로젝트 기술/라이브러리', '## 프로젝트 기술/라이브러리');
  assert.equal(detectLegacy(oldBe), 'backend');
  assert.equal(detectLegacy(oldFe), 'frontend');
  assert.equal(detectLegacy(FE()), null);
  assert.deepEqual(mergeStackSections(oldBe, 'frontend', FE()), { ok: false, reason: 'legacy', stack: 'backend' });
  const { md, stack } = migrateLegacy(oldBe);
  assert.equal(stack, 'backend');
  assert.equal(detectLegacy(md), null);
  assert.ok(md.includes('## BE 기술 스택') && md.includes('{ code, message }') && !md.includes('(Backend)'));
  assert.ok(mergeStackSections(md, 'frontend', FE()).md.includes('{ code, message }'));
});
