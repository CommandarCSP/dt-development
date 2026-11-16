import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
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

// DT_SPEC_FIXTURE_DIR = dt-spec 으로 만든 실제 페이지 스펙 폴더(file-management, proposed API 5개). 없으면 건너뛴다.
const SPEC_DIR = process.env.DT_SPEC_FIXTURE_DIR ?? '';

const hasSpecFixture = SPEC_DIR !== '' && existsSync(join(SPEC_DIR, 'requirements.md'));

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

test('parseEndpoints: apiPrefix 로 다른 주소 규칙에서도 도메인을 뽑는다(GEN-04)', () => {
  assert.deepEqual(parseEndpoints('GET /api/v1/posts, POST /api/comments'), ['posts', 'comments']);
  assert.deepEqual(parseEndpoints('GET /v1/posts/{id}', { apiPrefix: '/v1' }), ['posts']);
  assert.deepEqual(parseEndpoints('GET /posts · DELETE /posts/{id} · 파일은 src/posts', { apiPrefix: '' }), ['posts', 'posts']);
  assert.deepEqual(parseEndpoints('GET /bff/users · GET /api/files', { apiPrefix: ['/bff', 'api/'] }), ['users', 'files']);
  assert.deepEqual(parseEndpoints('GET /api/files', { apiPrefix: '/v1' }), []);
});

test('parseSpecForScaffold: projectRoot 의 .dt-frontend.json apiPrefix 를 읽는다', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = mkdtempSync(join(tmpdir(), 'dt-apiprefix-'));
  writeFileSync(join(root, '.dt-frontend.json'), JSON.stringify({ apiPrefix: '/v2' }));
  const readFile = (p) => (p.endsWith('requirements.md') ? '# Requirements: Feed\n<!-- status: finalized -->\nGET /v2/feeds' : '');
  try {
    const seed = parseSpecForScaffold('/fake/feed', { existingDomains: [], readFile, projectRoot: root });
    assert.deepEqual(seed.domains.map((d) => d.name), ['feeds']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
