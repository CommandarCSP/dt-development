// 마무리 루틴 단계(GEN-11) — wrap.steps 검증, 꺼진 어댑터 단계 빼기, 기준점 기록.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, DEFAULTS } from '../scripts/lib/config.mjs';
import { resolveWrapSteps, markWrap, loadWrapBaselines, WRAP_STEPS, WRAP_STATE_FILE } from '../scripts/wrapState.mjs';

const steps = (raw) => resolveWrapSteps(validate(raw, []));
const names = (r) => r.steps.map((s) => s.name);

test('기본값 = 예전 순서와 문구', () => {
  assert.deepEqual(DEFAULTS.wrap.steps, WRAP_STEPS);
  const r = steps({});
  assert.deepEqual(names(r), ['commit', 'wiki', 'tracker']);
  assert.deepEqual(r.labels, ['커밋 정리', 'Confluence 문서 판단', 'Jira 동기화']);
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(r.steps.map((s) => s.skill), [null, 'dt-confluence-doc', 'dt-worklog-sync']);
});

test('순서 바꾸기·일부만 고르기', () => {
  assert.deepEqual(names(steps({ wrap: { steps: ['commit', 'tracker', 'wiki'] } })), ['commit', 'tracker', 'wiki']);
  assert.deepEqual(names(steps({ wrap: { steps: ['commit', 'tracker'] } })), ['commit', 'tracker']);
});

test('꺼진 어댑터 단계는 빼고 이유를 남긴다', () => {
  const r = steps({ tracker: 'none', wiki: 'none' });
  assert.deepEqual(names(r), ['commit']);
  assert.deepEqual(r.skipped, [{ name: 'wiki', reason: 'wiki: none' }, { name: 'tracker', reason: 'tracker: none' }]);
  assert.deepEqual(steps({ wiki: 'notion', tracker: 'github' }).skipped.map((s) => s.reason), ['wiki: notion', 'tracker: github']);
  assert.deepEqual(steps({ tracker: 'linear' }).skipped.map((s) => s.name), ['tracker']);
  const md = steps({ wiki: 'markdown' });
  assert.equal(md.steps[1].label, '위키 문서 판단(markdown)');
  assert.equal(md.steps[1].skill, 'dt-confluence-doc');
});

test('wrap.steps 검증 — 모르는 이름·중복은 빼고, 빈 목록·틀린 형은 기본 순서', () => {
  const w = [];
  const c = validate({ wrap: { steps: ['commit', 'deploy', 'commit', 'wiki'], foo: 1 } }, w);
  assert.deepEqual(c.wrap.steps, ['commit', 'wiki']);
  assert.ok(w.some((x) => x.includes('"deploy"')));
  assert.ok(w.some((x) => x.includes('두 번')));
  assert.ok(w.some((x) => x.includes('wrap.foo')));
  for (const bad of [{ steps: [] }, { steps: ['x'] }, { steps: 'commit' }]) {
    const ww = [];
    assert.deepEqual(validate({ wrap: bad }, ww).wrap.steps, WRAP_STEPS, JSON.stringify(bad));
    assert.ok(ww.length > 0);
  }
  const ww = [];
  assert.deepEqual(validate({ wrap: 'x' }, ww).wrap.steps, WRAP_STEPS);
  assert.ok(ww.some((x) => x.includes('wrap: 객체')));
});

test('markWrap — lastWrapSha 를 남기고 다른 키는 둔다, 두 기준점을 함께 읽는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wrap-'));
  try {
    assert.deepEqual(loadWrapBaselines(dir), { lastWrapSha: null, lastSyncSha: null });
    writeFileSync(join(dir, WRAP_STATE_FILE), JSON.stringify({ other: 1 }));
    markWrap(dir, 'abc', new Date('2026-11-26T00:00:00Z'));
    const s = JSON.parse(readFileSync(join(dir, WRAP_STATE_FILE), 'utf8'));
    assert.deepEqual(s, { other: 1, lastWrapSha: 'abc', lastWrapAt: '2026-11-26T00:00:00.000Z' });
    writeFileSync(join(dir, '.dt-worklog.local.json'), JSON.stringify({ lastSyncSha: 'def' }));
    assert.deepEqual(loadWrapBaselines(dir), { lastWrapSha: 'abc', lastSyncSha: 'def' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
