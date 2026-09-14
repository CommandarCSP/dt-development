import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent, specContentHash } from '../scripts/specContentHash.mjs';

test('specContentHash: 8자 hex', () => {
  const h = specContentHash('# api-contract\nGET /users -> 200');
  assert.match(h, /^[0-9a-f]{8}$/);
});

test('specContentHash: HTML 주석-only 변경은 해시 불변(오탐 제거)', () => {
  const before = `<!-- basedOnDefinition: ../d.md@v1 | IF-1 -->
# api-contract
POST /users/:id/follow -> 200 { following, followerCount }`;
  const after = `<!-- basedOnDefinition: ../d.md@v1 | IF-1 -->
<!-- from: IF-15 -->
# api-contract
POST /users/:id/follow -> 200 { following, followerCount }`;
  assert.equal(specContentHash(before), specContentHash(after));
});

test('specContentHash: 공백·개행 포맷팅 변경은 해시 불변', () => {
  const a = '# api-contract\n\nGET /users   ->   200';
  const b = '# api-contract\nGET /users -> 200';
  assert.equal(specContentHash(a), specContentHash(b));
});

test('specContentHash: 계약 실변경은 해시 변함(실변경 감지)', () => {
  const before = '# api-contract\nPOST /users/:id/follow -> 204';
  const after = '# api-contract\nPOST /users/:id/follow -> 200 { following, followerCount }';
  assert.notEqual(specContentHash(before), specContentHash(after));
});

test('normalizeContent: 주석 제거 + 공백 정규화 + 트림', () => {
  assert.equal(normalizeContent('  <!-- x -->\n a   b \n'), 'a b');
});
