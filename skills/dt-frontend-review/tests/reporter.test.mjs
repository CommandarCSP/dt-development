// skills/dt-frontend-review/tests/reporter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../scripts/lib/reporter.mjs';

test('renders empty report when no findings', () => {
  const out = renderReport({ findings: [], coverage: { findings: [] } });
  assert.match(out, /Ready to merge: Yes/);
});

test('groups findings by severity', () => {
  const findings = [
    { severity: 'critical', ruleId: 'r1', file: 'a.ts', line: 1, message: 'bad' },
    { severity: 'important', ruleId: 'r2', file: 'b.ts', line: 2, message: 'meh' },
    { severity: 'minor', ruleId: 'r3', file: 'c.ts', line: 3, message: 'nit' },
  ];
  const out = renderReport({ findings, coverage: { findings: [] } });
  assert.match(out, /### Critical/);
  assert.match(out, /### Important/);
  assert.match(out, /### Minor/);
  assert.match(out, /a\.ts:1/);
});

test('includes coverage section when coverage findings exist', () => {
  const out = renderReport({
    findings: [],
    coverage: { findings: [{ severity: 'critical', file: 'x.ts', message: 'low' }] },
  });
  assert.match(out, /### Coverage/);
  assert.match(out, /x\.ts/);
  assert.match(out, /Ready to merge: No/);
});

test('manualReview findings default to suppressed summary', () => {
  const findings = [
    { severity: 'important', ruleId: 'r1', file: 'a.ts', manualReview: true, hint: 'inspect' },
    { severity: 'important', ruleId: 'r1', file: 'b.ts', manualReview: true, hint: 'inspect' },
  ];
  const out = renderReport({ findings, coverage: { findings: [] } });
  assert.match(out, /### Manual Review \(suppressed/);
  assert.match(out, /r1: 2개 파일/);
  // individual file paths should NOT be listed in default mode
  assert.doesNotMatch(out, /a\.ts/);
  // verdict still Yes since no real findings
  assert.match(out, /Ready to merge: Yes/);
});

test('manualReview findings show full list when verbose=true', () => {
  const findings = [
    { severity: 'important', ruleId: 'r1', file: 'a.ts', manualReview: true, hint: 'inspect' },
  ];
  const out = renderReport({ findings, coverage: { findings: [] } }, { verbose: true });
  assert.match(out, /### Manual Review \(heuristic stubs/);
  assert.match(out, /a\.ts/);
  assert.match(out, /inspect/);
  assert.match(out, /Ready to merge: Yes/);
});
