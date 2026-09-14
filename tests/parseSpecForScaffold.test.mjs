import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  parseStatus,
  parsePageName,
  parseEndpoints,
  deriveDomains,
  countProposedApis,
  assignIntent,
  parseSpecForScaffold,
} from '../scripts/parseSpecForScaffold.mjs';

test('parseStatus: draft / finalized / 없으면 draft', () => {
  assert.equal(parseStatus('<!-- status: draft -->\n# Requirements: x'), 'draft');
  assert.equal(parseStatus('<!-- status: finalized -->'), 'finalized');
  assert.equal(parseStatus('# Requirements: x'), 'draft');
});

test('parsePageName: # Requirements: <name>', () => {
  assert.equal(parsePageName('<!-- x -->\n\n# Requirements: file-management\n'), 'file-management');
  assert.equal(parsePageName('# Design: x'), null);
});

test('parseEndpoints / deriveDomains', () => {
  const text = 'GET `/api/files` ... DELETE `/api/files` ... GET `/api/files/{id}/download`';
  assert.deepEqual(parseEndpoints(text), ['files', 'files', 'files']);
  assert.deepEqual(deriveDomains(['files', 'files', 'files']), ['files']);
  assert.deepEqual(deriveDomains(['feed', 'follows', 'feed', 'recommendations']), ['feed', 'follows', 'recommendations']);
});

test('countProposedApis: 번호 API 블록의 [제안]만', () => {
  const text = [
    '### File (ViewModel) `[제안]`',
    '### 1) 파일 목록 조회 (FR-1) `[제안]`',
    '### 2) 파일 업로드 (FR-5) `[제안]`',
    '### 3) 파일 삭제 (FR-13)',
  ].join('\n');
  assert.equal(countProposedApis(text), 2);
});

test('assignIntent: 주입된 existingDomains로 결정', () => {
  assert.deepEqual(
    assignIntent(['files', 'comments'], ['comments']),
    [{ name: 'files', intent: 'new-domain' }, { name: 'comments', intent: 'extend-domain' }],
  );
  assert.deepEqual(assignIntent(['files'], []), [{ name: 'files', intent: 'new-domain' }]);
});

const SPEC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../sample-app/docs/specs/pages/file-management',
);

const hasSpecFixture = existsSync(join(SPEC_DIR, 'requirements.md'));   // 레포 밖 실측 스펙 — 없으면 건너뛴다

test('parseSpecForScaffold: file-management 픽스처 (existingDomains=[])', { skip: !hasSpecFixture }, () => {
  const seed = parseSpecForScaffold(SPEC_DIR, { existingDomains: [] });
  assert.equal(seed.status, 'draft');
  assert.equal(seed.page.name, 'file-management');
  assert.deepEqual(seed.domains, [{ name: 'files', intent: 'new-domain' }]);
  assert.equal(seed.multiDomain, false);
  assert.equal(seed.draftFlags.proposedApiCount, 5);
});

test('parseSpecForScaffold: existingDomains=[files] → extend', { skip: !hasSpecFixture }, () => {
  const seed = parseSpecForScaffold(SPEC_DIR, { existingDomains: ['files'] });
  assert.deepEqual(seed.domains, [{ name: 'files', intent: 'extend-domain' }]);
});

test('parseSpecForScaffold: 다중 도메인이면 multiDomain=true (readFile 주입)', () => {
  const fakeReqs = [
    '<!-- status: draft -->',
    '# Requirements: dashboard',
    'GET `/api/files` ... GET `/api/comments`',
  ].join('\n');
  const readFile = (p) => (p.endsWith('requirements.md') ? fakeReqs : '');
  const seed = parseSpecForScaffold('/fake/dashboard', { existingDomains: [], readFile });
  assert.equal(seed.multiDomain, true);
  assert.deepEqual(seed.domains.map((d) => d.name), ['files', 'comments']);
});
