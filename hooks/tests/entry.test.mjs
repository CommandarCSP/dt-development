import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WRAP = fileURLToPath(new URL('../scripts/wrap-detect.mjs', import.meta.url));
const START = fileURLToPath(new URL('../scripts/start-detect.mjs', import.meta.url));
const WRAP_STATE = fileURLToPath(new URL('../../scripts/wrapState.mjs', import.meta.url));

function run(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'dt-entry-'));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  spawnSync('git', ['init', '--bare', '--quiet', origin]);
  spawnSync('git', ['init', '--quiet', '-b', 'main', work]);
  run(work, ['config', 'user.email', 'e@test']);
  run(work, ['config', 'user.name', 'e']);
  writeFileSync(join(work, 'README.md'), 'init\n');
  run(work, ['add', '.']);
  run(work, ['commit', '--quiet', '-m', 'init']);
  run(work, ['remote', 'add', 'origin', origin]);
  run(work, ['push', '--quiet', '-u', 'origin', 'main']);
  return { root, work };
}

function commit(work, name) {
  writeFileSync(join(work, name), name + '\n');
  run(work, ['add', name]);
  run(work, ['commit', '--quiet', '-m', name]);
}

function invoke(script, event) {
  const r = spawnSync('node', [script], { input: JSON.stringify(event), encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout.trim() };
}

test('wrap-detect: silent when no .dt-pipeline.json', () => {
  const { root, work } = makeRepo();
  try {
    commit(work, 'a.txt');
    const { status, stdout } = invoke(WRAP, { cwd: work });
    assert.equal(status, 0);
    assert.equal(stdout, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('wrap-detect: blocks once when enabled + unsynced commits, then snoozes', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt-pipeline.json'), JSON.stringify({ enabled: true, commitThreshold: 1 }));
    commit(work, 'a.txt');
    const first = invoke(WRAP, { cwd: work });
    const out = JSON.parse(first.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /dt-wrap/);
    const second = invoke(WRAP, { cwd: work });
    assert.equal(second.status, 0);
    assert.equal(second.stdout, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('start-detect: injects on main + impl prompt when enabled', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt-pipeline.json'), JSON.stringify({ enabled: true, startReminder: true }));
    const { status, stdout } = invoke(START, { cwd: work, prompt: '로그인 기능 추가해줘' });
    assert.equal(status, 0);
    const out = JSON.parse(stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(out.hookSpecificOutput.additionalContext, /dt-git start/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('start-detect: silent on feature branch or non-impl prompt', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt-pipeline.json'), JSON.stringify({ enabled: true, startReminder: true }));
    run(work, ['switch', '-c', 'feat/x']);
    assert.equal(invoke(START, { cwd: work, prompt: '기능 추가해줘' }).stdout, '');
    run(work, ['switch', 'main']);
    assert.equal(invoke(START, { cwd: work, prompt: '이거 왜 안돼?' }).stdout, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// GEN-11 완료 기준: tracker: none · wiki: none 에서 훅과 루틴이 정상 동작한다.
test('wrap-detect: tracker·wiki 가 none 이면 커밋 단계만 권하고, 루틴을 마친 뒤엔 조용, 새 커밋엔 다시', () => {
  const { root, work } = makeRepo();
  try {
    writeFileSync(join(work, '.dt.json'), JSON.stringify({ hooks: { enabled: true }, tracker: 'none', wiki: 'none' }));
    commit(work, 'a.txt');
    const steps = JSON.parse(spawnSync('node', [WRAP_STATE, 'steps', '--project', work], { encoding: 'utf8' }).stdout);
    assert.deepEqual(steps.steps.map((s) => s.name), ['commit']);
    assert.deepEqual(steps.skipped, [{ name: 'wiki', reason: 'wiki: none' }, { name: 'tracker', reason: 'tracker: none' }]);

    const first = JSON.parse(invoke(WRAP, { cwd: work }).stdout);
    assert.equal(first.decision, 'block');
    assert.match(first.reason, /\/dt-wrap \(커밋 정리\)/);
    assert.doesNotMatch(first.reason, /Jira|Confluence/);

    // 루틴을 마침 → lastWrapSha = HEAD
    const m = spawnSync('node', [WRAP_STATE, 'mark', '--project', work], { encoding: 'utf8' });
    assert.equal(m.status, 0, m.stderr);
    writeFileSync(join(work, '.git', 'dt-wrap-snooze'), ''); // 스누즈를 지워 기준점만으로 조용한지 본다
    assert.equal(invoke(WRAP, { cwd: work }).stdout, '', '마무리 뒤 조용');

    commit(work, 'b.txt');
    const again = JSON.parse(invoke(WRAP, { cwd: work }).stdout);
    assert.match(again.reason, /1커밋/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
