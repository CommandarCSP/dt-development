import test from 'node:test';
import assert from 'node:assert/strict';
import { detectForbiddenCall } from '../scripts/lib/detection/forbidden-call.mjs';

test('detects bare function call', () => {
  const code = `function Comp() { const data = useQuery(); }\n`;
  const findings = detectForbiddenCall(code, { matches: ['useQuery'] });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].matched, 'useQuery');
});

test('detects member call (vi.mock)', () => {
  const code = `vi.mock('../store/queries/foo');\n`;
  const findings = detectForbiddenCall(code, { matches: ['vi.mock'] });
  assert.equal(findings.length, 1);
});

test('respects matchArguments glob constraint', () => {
  const codeOk = `vi.mock('react');\n`;
  const codeBad = `vi.mock('../business/hooks/foo');\n`;
  const cfg = { matches: ['vi.mock'], matchArguments: ['**/business/hooks/**'] };
  assert.equal(detectForbiddenCall(codeOk, cfg).length, 0);
  assert.equal(detectForbiddenCall(codeBad, cfg).length, 1);
});

test('does not match in import (only call sites)', () => {
  const code = `import { useQuery } from '@tanstack/react-query';\n`;
  const findings = detectForbiddenCall(code, { matches: ['useQuery'] });
  assert.equal(findings.length, 0);
});

test('returns line number', () => {
  const code = `line1\nline2\nuseQuery();\n`;
  const findings = detectForbiddenCall(code, { matches: ['useQuery'] });
  assert.equal(findings[0].line, 3);
});
