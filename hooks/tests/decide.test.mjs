import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isImplementationPrompt,
  decideWrapReminder,
  decideStartReminder,
  decideSchemaNotice,
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

test('decideSchemaNotice: 훅이 켜져 있고 /dt- 명령일 때만, 옮길 것이 있으면 한 줄 알린다', () => {
  const on = { enabled: true };
  const scanFn = () => [{ status: 'migrate' }, { status: 'current' }, { status: 'newer' }];
  const r = decideSchemaNotice({ config: on, prompt: '/dt-spec home', scanFn, repoRoot: '.' });
  assert.equal(r.inject, true);
  assert.match(r.context, /옛 형식 산출물 1개/);
  assert.match(r.context, /새 형식 1개/);
  assert.equal(decideSchemaNotice({ config: null, prompt: '/dt-spec', scanFn, repoRoot: '.' }).inject, false, '훅 꺼짐');
  assert.equal(decideSchemaNotice({ config: on, prompt: '화면 고쳐줘', scanFn, repoRoot: '.' }).inject, false, 'dt 명령이 아님');
  assert.equal(decideSchemaNotice({ config: on, prompt: '/dt-migrate', scanFn, repoRoot: '.' }).inject, false, '이전 명령 자신');
  assert.equal(decideSchemaNotice({ config: on, prompt: '/dt-spec', scanFn: () => [{ status: 'current' }], repoRoot: '.' }).inject, false);
  assert.equal(decideSchemaNotice({ config: on, prompt: '/dt-spec', scanFn: () => { throw new Error('x'); }, repoRoot: '.' }).inject, false, '실패해도 막지 않는다');
});

test('decideWrapReminder: 문구는 실제 단계로 — 기본은 예전 그대로, 꺼진 단계는 없다 (GEN-11)', () => {
  const base = { config: { enabled: true }, unsynced: 1, head: 'x', snooze: null };
  assert.match(decideWrapReminder(base).reason, /\(커밋 정리 → Confluence 문서 판단 → Jira 동기화\)/);
  const r = decideWrapReminder({ ...base, labels: ['커밋 정리'] }).reason;
  assert.match(r, /\/dt-wrap \(커밋 정리\)/);
  assert.doesNotMatch(r, /Jira|Confluence|위키/);
  assert.match(r, /dt-git finish/, 'main 통합 확인은 그대로');
});
