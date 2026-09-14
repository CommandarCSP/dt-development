import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectRequiresAcceptanceLedger } from '../scripts/lib/detection/requires-acceptance-ledger.mjs';

function makeProject() {
  return mkdtempSync(join(tmpdir(), 'dt-ledger-'));
}
function pageDir(root, dir) {
  const abs = join(root, 'docs/specs/pages', dir);
  mkdirSync(abs, { recursive: true });
  return abs;
}
const cfg = { description: '스펙은 있는데 수용 e2e 원장이 없는 페이지 디렉토리' };

test('flags a spec dir that has requirements.md but no *.e2e-scenarios.md', () => {
  const root = makeProject();
  try {
    const dir = pageDir(root, 'feed-detail');
    writeFileSync(join(dir, 'requirements.md'), '# FR-1');
    const findings = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedPostDetailPage.tsx',
      projectRoot: root,
    });
    assert.equal(findings.length, 1);
    assert.match(findings[0].matched, /feed-detail/);
    assert.match(findings[0].matched, /수용 e2e 원장 없음/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no flag when the spec dir also has an e2e-scenarios ledger', () => {
  const root = makeProject();
  try {
    const dir = pageDir(root, 'feed-detail');
    writeFileSync(join(dir, 'requirements.md'), '# FR-1');
    writeFileSync(join(dir, 'feed-detail.e2e-scenarios.md'), '# scenarios');
    const findings = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedPostDetailPage.tsx',
      projectRoot: root,
    });
    assert.equal(findings.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no flag when the spec itself is absent (no requirements.md)', () => {
  const root = makeProject();
  try {
    pageDir(root, 'feed-detail'); // empty dir, no requirements.md
    const findings = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedPostDetailPage.tsx',
      projectRoot: root,
    });
    assert.equal(findings.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no flag when docs/specs/pages does not exist at all', () => {
  const root = makeProject();
  try {
    const findings = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedPostDetailPage.tsx',
      projectRoot: root,
    });
    assert.equal(findings.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('dedupes across calls in a shared run cache (ctx.cache)', () => {
  const root = makeProject();
  try {
    const dir = pageDir(root, 'feed-detail');
    writeFileSync(join(dir, 'requirements.md'), '# FR-1');
    const cache = {};
    const first = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedPostDetailPage.tsx', projectRoot: root, cache,
    });
    const second = detectRequiresAcceptanceLedger('', cfg, {
      relPath: 'src/pages/FeedListPage.tsx', projectRoot: root, cache,
    });
    assert.equal(first.length, 1);
    assert.equal(second.length, 0); // already reported via shared cache
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('specsDir/nudge param: scans resources dir and uses custom nudge command', () => {
  const root = makeProject();
  try {
    const abs = join(root, 'docs/specs/resources', 'comments');
    mkdirSync(abs, { recursive: true });
    writeFileSync(join(abs, 'requirements.md'), '# REQ');
    const findings = detectRequiresAcceptanceLedger('', {
      description: 'be ledger check',
      specsDir: 'docs/specs/resources',
      nudge: '/dt-be-e2e',
    }, { relPath: 'src/comments/comments.controller.ts', projectRoot: root, cache: {} });
    assert.equal(findings.length, 1);
    assert.match(findings[0].matched, /docs\/specs\/resources\/comments/);
    assert.match(findings[0].matched, /\/dt-be-e2e/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('specsDir param: default stays docs/specs/pages (FE 무변경)', () => {
  const root = makeProject();
  try {
    const dir = pageDir(root, 'main');
    writeFileSync(join(dir, 'requirements.md'), '# FR');
    const findings = detectRequiresAcceptanceLedger('', cfg, { projectRoot: root, cache: {} });
    assert.equal(findings.length, 1);
    assert.match(findings[0].matched, /docs\/specs\/pages\/main/);
    assert.match(findings[0].matched, /\/dt-e2e/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('specsDir param: FE/BE 캐시 키 분리 — 같은 run에서 서로 dedupe하지 않음', () => {
  const root = makeProject();
  try {
    const fe = pageDir(root, 'main');
    writeFileSync(join(fe, 'requirements.md'), '# FR');
    const be = join(root, 'docs/specs/resources', 'main');
    mkdirSync(be, { recursive: true });
    writeFileSync(join(be, 'requirements.md'), '# REQ');
    const cache = {};
    const f1 = detectRequiresAcceptanceLedger('', cfg, { projectRoot: root, cache });
    const f2 = detectRequiresAcceptanceLedger('', { specsDir: 'docs/specs/resources', nudge: '/dt-be-e2e' }, { projectRoot: root, cache });
    assert.equal(f1.length, 1);
    assert.equal(f2.length, 1); // 같은 dir명 'main'이어도 specsDir이 달라 dedupe 안 됨
  } finally { rmSync(root, { recursive: true, force: true }); }
});
