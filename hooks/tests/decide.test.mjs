import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isImplementationPrompt,
  decideWrapReminder,
  decideStartReminder,
} from '../scripts/lib/pipeline-state.mjs';

test('isImplementationPrompt matches impl keywords (ko/en), ignores questions', () => {
  assert.equal(isImplementationPrompt('로그인 기능 구현해줘'), true);
  assert.equal(isImplementationPrompt('Please fix the bug'), true);
  assert.equal(isImplementationPrompt('이 코드 어떻게 동작해?'), false);
  assert.equal(isImplementationPrompt(''), false);
  assert.equal(isImplementationPrompt(undefined), false);
});

test('decideWrapReminder blocks only when enabled + over threshold + not snoozed', () => {
  const base = { config: { enabled: true, commitThreshold: 1 }, unsynced: 2, head: 'aaa', snooze: null };
  assert.equal(decideWrapReminder(base).block, true);
  assert.match(decideWrapReminder(base).reason, /dt-wrap/);
  // 마무리 게이트는 dt-wrap뿐 아니라 main 머지/push(finish) 여부도 확인하게 한다.
  assert.match(decideWrapReminder(base).reason, /dt-git finish/);
  assert.match(decideWrapReminder(base).reason, /머지/);

  assert.equal(decideWrapReminder({ ...base, config: null }).block, false);
  assert.equal(decideWrapReminder({ ...base, config: { enabled: false } }).block, false);
  assert.equal(decideWrapReminder({ ...base, unsynced: 0 }).block, false);
  assert.equal(decideWrapReminder({ ...base, config: { enabled: true, commitThreshold: 3 } }).block, false);
  assert.equal(decideWrapReminder({ ...base, snooze: 'aaa' }).block, false);
});

test('decideWrapReminder defaults commitThreshold to 1', () => {
  const d = decideWrapReminder({ config: { enabled: true }, unsynced: 1, head: 'x', snooze: null });
  assert.equal(d.block, true);
});

test('decideStartReminder injects only on main + impl prompt + enabled', () => {
  const base = { config: { enabled: true, startReminder: true }, branch: 'main', prompt: '기능 추가해줘' };
  assert.equal(decideStartReminder(base).inject, true);
  assert.match(decideStartReminder(base).context, /dt-git start/);

  assert.equal(decideStartReminder({ ...base, config: null }).inject, false);
  assert.equal(decideStartReminder({ ...base, config: { enabled: true, startReminder: false } }).inject, false);
  assert.equal(decideStartReminder({ ...base, branch: 'feat/x' }).inject, false);
  assert.equal(decideStartReminder({ ...base, prompt: '이거 왜 안돼?' }).inject, false);
});
