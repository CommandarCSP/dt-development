import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectForbiddenPattern } from '../scripts/lib/detection/forbidden-pattern.mjs';

// sentry-single-capture 룰이 쓰는 정규식과 동일해야 한다.
const SENTRY_CAPTURE = 'Sentry\\.capture(Exception|Message)\\s*\\(';

test('sentry-single-capture: flags a scattered captureException call', () => {
  const code = `import * as Sentry from '@sentry/react';\nSentry.captureException(err);`;
  const findings = detectForbiddenPattern(code, { pattern: SENTRY_CAPTURE });
  assert.equal(findings.length, 1);
  assert.match(findings[0].matched, /captureException\s*\(/);
});

test('sentry-single-capture: flags captureMessage too', () => {
  const code = `Sentry.captureMessage('boom');`;
  assert.equal(detectForbiddenPattern(code, { pattern: SENTRY_CAPTURE }).length, 1);
});

test('sentry-single-capture: no flag when Sentry capture is absent', () => {
  const code = `reportError(err); // 단일 진입점만 사용`;
  assert.equal(detectForbiddenPattern(code, { pattern: SENTRY_CAPTURE }).length, 0);
});
