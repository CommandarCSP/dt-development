import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoverageSummary, compareCoverage } from '../scripts/lib/coverage.mjs';

test('parseCoverageSummary extracts per-file line coverage', () => {
  const json = {
    total: { lines: { pct: 85 } },
    'src/business/hooks/foo.ts': { lines: { pct: 90 } },
    'src/utils/bar.ts': { lines: { pct: 70 } },
  };
  const parsed = parseCoverageSummary(json);
  assert.equal(parsed.files['src/business/hooks/foo.ts'], 90);
  assert.equal(parsed.files['src/utils/bar.ts'], 70);
  assert.equal(parsed.total, 85);
});

test('compareCoverage: new file below threshold → critical', () => {
  const head = { files: { 'src/new.ts': 65 }, total: 80 };
  const base = { files: {}, total: 85 };
  const changed = ['src/new.ts'];
  const result = compareCoverage({ head, base, changed, threshold: 80, baselineProtection: true });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].severity, 'critical');
  assert.equal(result.findings[0].reason, 'new-file-below-threshold');
});

test('compareCoverage: modified file drops below baseline → critical', () => {
  const head = { files: { 'src/a.ts': 70 }, total: 80 };
  const base = { files: { 'src/a.ts': 90 }, total: 85 };
  const changed = ['src/a.ts'];
  const result = compareCoverage({ head, base, changed, threshold: 80, baselineProtection: true });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].reason, 'baseline-drop');
});

test('compareCoverage: unchanged file ignored', () => {
  const head = { files: { 'src/a.ts': 50 }, total: 80 };
  const base = { files: { 'src/a.ts': 60 }, total: 85 };
  const changed = []; // a.ts not in changed list
  const result = compareCoverage({ head, base, changed, threshold: 80, baselineProtection: true });
  assert.equal(result.findings.length, 0);
});

test('compareCoverage: baselineProtection=false → no baseline-drop check', () => {
  const head = { files: { 'src/a.ts': 85 }, total: 80 };
  const base = { files: { 'src/a.ts': 95 }, total: 90 };
  const changed = ['src/a.ts'];
  const result = compareCoverage({ head, base, changed, threshold: 80, baselineProtection: false });
  // 85 >= threshold AND no baseline check → no finding
  assert.equal(result.findings.length, 0);
});
