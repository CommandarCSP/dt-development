import test from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob, matchAny } from '../scripts/lib/matcher.mjs';

test('matches exact path', () => {
  assert.equal(matchGlob('src/foo.ts', 'src/foo.ts'), true);
  assert.equal(matchGlob('src/foo.ts', 'src/bar.ts'), false);
});

test('* matches single segment', () => {
  assert.equal(matchGlob('src/components/A.tsx', 'src/*/A.tsx'), true);
  assert.equal(matchGlob('src/a/b/A.tsx', 'src/*/A.tsx'), false);
});

test('** matches multiple segments', () => {
  assert.equal(matchGlob('src/a/b/c.ts', 'src/**/*.ts'), true);
  assert.equal(matchGlob('src/a.ts', 'src/**/*.ts'), true);
});

test('{a,b} alternation', () => {
  assert.equal(matchGlob('src/foo.ts', 'src/foo.{ts,tsx}'), true);
  assert.equal(matchGlob('src/foo.tsx', 'src/foo.{ts,tsx}'), true);
  assert.equal(matchGlob('src/foo.js', 'src/foo.{ts,tsx}'), false);
});

test('matches in __tests__ directory', () => {
  assert.equal(
    matchGlob('src/components/domain/__tests__/PostList.test.tsx',
              'src/components/domain/**/__tests__/**/*.{ts,tsx}'),
    true,
  );
});

test('matchAny returns true if any pattern matches', () => {
  assert.equal(matchAny('src/foo.ts', ['lib/**', 'src/*.ts']), true);
  assert.equal(matchAny('src/foo.ts', ['lib/**', 'test/**']), false);
});
