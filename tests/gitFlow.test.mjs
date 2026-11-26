// git 흐름 설정(GEN-12) — gitFlow 검증, 방식별 finish 계획, develop·squash 로 실제 start·finish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../scripts/lib/config.mjs';
import { resolveGitFlow, startPlan, finishPlan, MESSAGE_PLACEHOLDER } from '../scripts/gitFlow.mjs';
import { compareUrl } from '../scripts/gitWebUrl.mjs';
import { integrateText, decideStartReminder } from '../hooks/scripts/lib/pipeline-state.mjs';

const CLI = fileURLToPath(new URL('../scripts/gitFlow.mjs', import.meta.url));
const STATE = fileURLToPath(new URL('../skills/dt-git-flow/scripts/state.mjs', import.meta.url));
const flow = (g, w = []) => resolveGitFlow(validate(g === undefined ? {} : { gitFlow: g }, w));
const ids = (p) => p.steps.map((s) => s.id);
const cmd = (p, id) => p.steps.find((s) => s.id === id)?.cmd;

test('기본값 = 예전 정책(main · no-ff · feat/ · push), 설정이 없어도 같다', () => {
  const f = flow();
  assert.deepEqual(f, { baseBranch: 'main', mergeStrategy: 'no-ff', branchPrefix: 'feat/', pushPolicy: 'push', remote: 'origin', baseRef: 'origin/main' });
  assert.deepEqual(resolveGitFlow(null), f);
});

test('gitFlow 검증 — 틀린 값은 경고하고 기본값', () => {
  const w = [];
  const f = flow({ baseBranch: 'a b', mergeStrategy: 'octopus', branchPrefix: '-x/', pushPolicy: 'force', extra: 1 }, w);
  assert.equal(f.baseBranch, 'main');
  assert.equal(f.mergeStrategy, 'no-ff');
  assert.equal(f.branchPrefix, 'feat/');
  assert.equal(f.pushPolicy, 'push');
  for (const k of ['baseBranch', 'mergeStrategy', 'branchPrefix', 'pushPolicy', 'gitFlow.extra']) assert.ok(w.some((x) => x.includes(k)), k);
  const ok = flow({ baseBranch: 'release/2.x', mergeStrategy: 'squash', branchPrefix: null, pushPolicy: 'none' });
  assert.equal(ok.baseRef, 'origin/release/2.x');
  assert.equal(ok.branchPrefix, null);
});

test('start — 기준 ref 에서 분기, 접두어는 제안만', () => {
  const p = startPlan(flow({ baseBranch: 'develop' }), 'login');
  assert.deepEqual(cmd(p, 'branch'), ['git', 'switch', '-c', 'login', 'origin/develop']);
  assert.equal(p.suggestion, 'feat/login');
  assert.equal(startPlan(flow(), 'fix/a').suggestion, null);
  assert.equal(startPlan(flow({ branchPrefix: null }), 'a').suggestion, null);
  assert.throws(() => startPlan(flow(), 'main'), /기준 브랜치/);
});

test('finish no-ff(기본) — 예전 순서 그대로', () => {
  const p = finishPlan(flow(), { feature: 'feat/a', message: 'm' });
  assert.deepEqual(ids(p), ['fetch', 'rebase', 'switch-base', 'update-base', 'merge', 'push-base', 'delete-feature']);
  assert.deepEqual(cmd(p, 'rebase'), ['git', 'rebase', 'origin/main']);
  assert.deepEqual(cmd(p, 'update-base'), ['git', 'merge', '--ff-only', 'origin/main']);
  assert.deepEqual(cmd(p, 'merge'), ['git', 'merge', '--no-ff', '-m', 'm', 'feat/a']);
  assert.deepEqual(cmd(p, 'push-base'), ['git', 'push', 'origin', 'main']);
  assert.deepEqual(cmd(p, 'delete-feature'), ['git', 'branch', '-d', 'feat/a']);
  assert.equal(p.needsMessage, false);
  assert.ok(!p.steps.some((s) => s.cmd?.some((a) => /force/.test(a))), '기준 브랜치에 force 없음');
});

test('finish — 메시지 없으면 자리 표시, behind 0 이면 리베이스 생략, push 없음', () => {
  const p = finishPlan(flow(), { feature: 'f', behind: 0 });
  assert.equal(p.needsMessage, true);
  assert.ok(cmd(p, 'merge').includes(MESSAGE_PLACEHOLDER));
  assert.ok(!ids(p).includes('rebase'));
  const n = finishPlan(flow({ pushPolicy: 'none' }), { feature: 'f', message: 'm' });
  assert.ok(!ids(n).includes('push-base'));
  assert.match(n.after, /push 하지 않았다/);
  assert.throws(() => finishPlan(flow(), { feature: 'main' }), /피처 브랜치/);
});

test('finish squash·rebase', () => {
  const s = finishPlan(flow({ mergeStrategy: 'squash' }), { feature: 'f', message: 'm' });
  assert.deepEqual(ids(s), ['fetch', 'rebase', 'switch-base', 'update-base', 'merge', 'commit', 'push-base', 'delete-feature']);
  assert.deepEqual(cmd(s, 'merge'), ['git', 'merge', '--squash', 'f']);
  assert.deepEqual(cmd(s, 'delete-feature'), ['git', 'branch', '-D', 'f']);
  assert.equal(s.steps.at(-1).approve, true, '-D 는 따로 승인');
  const r = finishPlan(flow({ mergeStrategy: 'rebase' }), { feature: 'f' });
  assert.equal(r.needsMessage, false);
  assert.deepEqual(cmd(r, 'merge'), ['git', 'merge', '--ff-only', 'f']);
});

test('finish pr — 피처 브랜치만 push, gh·glab 이 있으면 그 명령, 없으면 PR 만들기 주소', () => {
  const f = flow({ baseBranch: 'develop', mergeStrategy: 'pr' });
  const gh = { kind: 'github', webBase: 'https://github.com/o/r' };
  const p = finishPlan(f, { feature: 'feat/a', web: gh, tools: { gh: true } });
  assert.deepEqual(ids(p), ['fetch', 'rebase', 'push-feature', 'open-pr']);
  assert.deepEqual(cmd(p, 'push-feature'), ['git', 'push', '--force-with-lease', '-u', 'origin', 'feat/a']);
  assert.deepEqual(cmd(p, 'open-pr'), ['gh', 'pr', 'create', '--base', 'develop', '--head', 'feat/a', '--fill']);
  const u = finishPlan(f, { feature: 'feat/a', web: gh, tools: {} }).steps.at(-1);
  assert.equal(u.cmd, null);
  assert.equal(u.url, 'https://github.com/o/r/compare/develop...feat/a?expand=1');
  const gl = finishPlan(f, { feature: 'a', web: { kind: 'gitlab', webBase: 'https://gitlab.com/g/r' }, tools: { glab: true } });
  assert.equal(cmd(gl, 'open-pr')[0], 'glab');
  assert.equal(finishPlan(f, { feature: 'a', web: null }).steps.at(-1).url, null);
  assert.ok(!ids(p).includes('push-base') && !ids(p).includes('delete-feature'));
});

test('compareUrl — 호스트별 PR 만들기 화면', () => {
  assert.equal(compareUrl({ kind: 'gitlab', webBase: 'https://gitlab.com/g/r' }, 'develop', 'feat/a'),
    'https://gitlab.com/g/r/-/merge_requests/new?merge_request%5Bsource_branch%5D=feat%2Fa&merge_request%5Btarget_branch%5D=develop');
  assert.equal(compareUrl({ kind: 'bitbucket', webBase: 'https://bitbucket.org/w/r' }, 'main', 'x'), 'https://bitbucket.org/w/r/pull-requests/new?source=x&dest=main');
  assert.equal(compareUrl({ kind: null, webBase: 'x' }, 'a', 'b'), null);
});

test('훅 문구 — 기본은 예전 그대로, 기준 브랜치·pr·push 없음을 반영', () => {
  assert.equal(integrateText(), '① main 머지 + origin push 여부 (/dt-git finish — 자동 금지, 매번 사용자 승인). ');
  assert.match(integrateText(flow({ baseBranch: 'develop' })), /^① develop 머지 \+ origin push/);
  assert.match(integrateText(flow({ mergeStrategy: 'pr' })), /PR 올리기 여부/);
  assert.doesNotMatch(integrateText(flow({ pushPolicy: 'none' })), /origin push/);
  const on = { enabled: true };
  assert.equal(decideStartReminder({ config: on, branch: 'develop', prompt: '기능 추가', baseBranch: 'develop' }).inject, true);
  assert.equal(decideStartReminder({ config: on, branch: 'main', prompt: '기능 추가', baseBranch: 'develop' }).inject, false);
  assert.match(decideStartReminder({ config: on, branch: 'main', prompt: '기능 추가' }).context, /^현재 main 브랜치입니다/);
});

// ── 완료 기준: develop 베이스·squash 설정으로 start/finish 동작 ──
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function runSteps(cwd, steps) {
  for (const s of steps) {
    assert.ok(s.cmd, s.id);
    assert.equal(s.cmd[0], 'git');
    git(cwd, s.cmd.slice(1));
  }
}

test('develop · squash — start 는 origin/develop 에서, finish 는 develop 에 커밋 하나로 합치고 push·정리', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-gitflow-'));
  try {
    const origin = join(root, 'origin.git');
    const work = join(root, 'work');
    spawnSync('git', ['init', '--bare', '--quiet', origin]);
    spawnSync('git', ['init', '--quiet', '-b', 'main', work]);
    git(work, ['config', 'user.email', 'g@test']);
    git(work, ['config', 'user.name', 'g']);
    writeFileSync(join(work, 'README.md'), 'init\n');
    writeFileSync(join(work, '.gitignore'), '.dt.json\n');
    git(work, ['add', '.']);
    git(work, ['commit', '--quiet', '-m', 'init']);
    git(work, ['remote', 'add', 'origin', origin]);
    git(work, ['push', '--quiet', '-u', 'origin', 'main']);
    git(work, ['switch', '--quiet', '-c', 'develop']);
    writeFileSync(join(work, 'dev.txt'), 'dev\n');
    git(work, ['add', 'dev.txt']);
    git(work, ['commit', '--quiet', '-m', 'dev']);
    git(work, ['push', '--quiet', '-u', 'origin', 'develop']);
    writeFileSync(join(work, '.dt.json'), JSON.stringify({ gitFlow: { baseBranch: 'develop', mergeStrategy: 'squash' } }));

    const node = (args) => {
      const r = spawnSync(process.execPath, args, { cwd: work, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(r.stdout);
    };
    // start
    const start = node([CLI, 'start', '--name', 'feat/login', '--project', work]);
    runSteps(work, start.steps);
    assert.equal(git(work, ['merge-base', 'HEAD', 'origin/develop']), git(work, ['rev-parse', 'origin/develop']), 'origin/develop 에서 분기');
    for (const f of ['a.txt', 'b.txt']) {
      writeFileSync(join(work, f), f);
      git(work, ['add', f]);
      git(work, ['commit', '--quiet', '-m', f]);
    }
    // 상태: 인자 없이 develop 기준
    const st = node([STATE]);
    assert.equal(st.baseBranch, 'develop');
    assert.equal(st.isBase, false);
    assert.deepEqual(st.aheadBehind, { ahead: 2, behind: 0 });
    // finish: 메시지 없이 먼저 → needsMessage → 승인 문장으로 다시
    assert.equal(node([CLI, 'finish', '--feature', 'feat/login', '--behind', '0', '--project', work]).needsMessage, true);
    const fin = node([CLI, 'finish', '--feature', 'feat/login', '--behind', '0', '--message', 'feat: 로그인', '--project', work]);
    runSteps(work, fin.steps);

    assert.equal(git(work, ['rev-parse', '--abbrev-ref', 'HEAD']), 'develop');
    assert.equal(git(work, ['rev-list', '--count', 'origin/develop..develop']), '0', 'develop push 됨');
    assert.deepEqual(git(work, ['log', '--format=%s', '-2', 'origin/develop']).split('\n'), ['feat: 로그인', 'dev'], '커밋 하나로');
    assert.equal(git(work, ['rev-list', '--merges', '--count', 'origin/develop']), '0', '머지 커밋 없음');
    assert.equal(git(work, ['branch', '--list', 'feat/login']), '', '피처 브랜치 정리');
    assert.equal(git(work, ['rev-parse', 'origin/main']), git(work, ['rev-list', '--max-parents=0', 'HEAD']), 'main 은 그대로');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
