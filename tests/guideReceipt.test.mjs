import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSourceHash, checkGuideReceipt } from '../scripts/guide/receipt.mjs';

test('computeSourceHash: 순서 무관, 경로·내용 경계 구분', () => {
  const a = computeSourceHash([{ path: 'a.md', content: 'x' }, { path: 'b.md', content: 'y' }]);
  const b = computeSourceHash([{ path: 'b.md', content: 'y' }, { path: 'a.md', content: 'x' }]);
  assert.equal(a, b);
  assert.notEqual(a, computeSourceHash([{ path: 'a.mdx', content: '' }, { path: 'b.md', content: 'y' }]));
});
test('checkGuideReceipt: 없음 / PDF 없음 / 버전 / 해시 / shotsRefreshed / --no-pdf 영수증', () => {
  const ok = { version: '1.0.0', sourceHash: 'h', shotsRefreshed: true, pdf: true, builtAt: 't' };
  assert.equal(checkGuideReceipt({ receipt: ok, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).ok, true);
  assert.match(checkGuideReceipt({ receipt: undefined, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).reason, /영수증/);
  assert.match(checkGuideReceipt({ receipt: ok, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: false }).reason, /PDF/);
  assert.match(checkGuideReceipt({ receipt: ok, appVersion: '1.1.0', currentSourceHash: 'h', pdfExists: true }).reason, /1\.1\.0/);
  assert.match(checkGuideReceipt({ receipt: ok, appVersion: '1.0.0', currentSourceHash: 'z', pdfExists: true }).reason, /바뀌었다/);
  assert.match(checkGuideReceipt({ receipt: { ...ok, shotsRefreshed: false }, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).reason, /캡처/);
  assert.match(checkGuideReceipt({ receipt: null, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).reason, /영수증/);
  assert.match(checkGuideReceipt({ receipt: { ...ok, pdf: false }, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).reason, /--no-pdf/);
  assert.match(checkGuideReceipt({ receipt: { ...ok, pdf: undefined }, appVersion: '1.0.0', currentSourceHash: 'h', pdfExists: true }).reason, /--no-pdf/);
});
