import test from 'node:test';
import assert from 'node:assert/strict';
import { detectForbiddenImport } from '../scripts/lib/detection/forbidden-import.mjs';

test('detects exact module name', () => {
  const code = "import axios from 'axios';\n";
  const findings = detectForbiddenImport(code, ['axios']);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].matched, 'axios');
  assert.equal(findings[0].line, 1);
});

test('detects relative path', () => {
  const code = `import { x } from '../../utils/apiClient';\n`;
  const findings = detectForbiddenImport(code, ['**/utils/apiClient']);
  assert.equal(findings.length, 1);
});

test('returns empty when no forbidden import', () => {
  const code = "import React from 'react';\n";
  const findings = detectForbiddenImport(code, ['axios']);
  assert.deepEqual(findings, []);
});

test('multi-line file: correct line number', () => {
  const code = `import { useState } from 'react';
import axios from 'axios';
const x = 1;`;
  const findings = detectForbiddenImport(code, ['axios']);
  assert.equal(findings[0].line, 2);
});

test('handles dynamic import()', () => {
  const code = `await import('axios');`;
  const findings = detectForbiddenImport(code, ['axios']);
  assert.equal(findings.length, 1);
});
