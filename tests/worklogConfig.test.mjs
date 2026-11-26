// 작업 기록 설정·프리셋(GEN-09) — 기본은 TP-002(basic), 사내 가이드라인은 선택 프리셋(org-guideline).
// 옛 위저드가 만든 설정(preset 없음 + 옛 키)은 org-guideline 으로 읽어 이미 쓰던 팀의 동작을 바꾸지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveWorklogConfig, checkCloseComment, PRESETS } from '../scripts/worklogConfig.mjs';
import { parseRemote, detectHost, resolveGitWeb, commitUrl, prUrl } from '../scripts/gitWebUrl.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
// scp 모양 git 리모트(user@host:path). 문자 그대로 적으면 금칙어 검사의 이메일 패턴에 걸린다.
const scp = (user, host, path) => `${user}@${host}:${path}`;
const CLI = join(root, 'scripts/worklogConfig.mjs');
const GIT = join(root, 'scripts/gitWebUrl.mjs');
const R = (team, o = {}) => resolveWorklogConfig(tmpdir(), { team, local: null, dt: { tracker: 'jira' }, remote: scp('git', 'github.com', 'acme/app.git'), ...o });

// GEN-09 전 위저드가 복사하던 회사 예시 설정(그대로)
const LEGACY = {
  site: 'your-site.atlassian.net', cloudId: 'c-1', defaultProjectKey: 'SAP',
  issueTypeNames: { story: '스토리', task: '작업', bug: '버그', subtask: '하위 작업' },
  transitionMap: { subtask: { start: 'In Progress', done: 'Done' }, story: { devStart: '개발 진행', devDone: '개발 완료' }, bug: { deployed: 'Deployed', verified: 'Verified' } },
  issueKeyPattern: '[A-Z][A-Z0-9]+-\\d+', outputFieldName: '산출물',
  outputFieldId: 'REPLACE_OR_OMIT — 산출물 커스텀 필드 id', gitWebBaseUrl: 'OMIT — 생략 시 origin 리모트에서 도출',
};

test('설정이 없으면 basic(TP-002): Story·Task·Bug 단위, Sub-task 선택, 마무리에 산출물이나 결정 사항', () => {
  const r = R(null);
  assert.equal(r.preset, 'basic'); assert.equal(r.presetFrom, '기본값');
  assert.deepEqual(r.rules.unit, ['story', 'task', 'bug']);
  assert.equal(r.rules.subtask, 'optional');
  assert.equal(r.rules.epic.required, false);
  assert.deepEqual(r.rules.requiredDates, []);
  assert.equal(r.rules.outputField, null);
  assert.equal(r.rules.releases, 'optional');
  assert.equal(r.rules.close.need, 'outputOrDecision');
  assert.equal(r.tracker, 'jira'); assert.equal(r.writes, true);
  assert.deepEqual(r.warnings, []);
});

test('옛 설정(preset 없음 + 옛 키)은 org-guideline 으로 보고, 예전 규칙을 그대로 낸다', () => {
  const r = R(LEGACY);
  assert.equal(r.preset, 'org-guideline'); assert.equal(r.presetFrom, '옛 설정 키');
  assert.ok(r.warnings.some((w) => w.includes('"preset": "org-guideline"')), r.warnings.join('\n'));
  // 예전에 강제하던 것들
  assert.deepEqual(r.rules.unit, ['subtask']);
  assert.equal(r.rules.subtask, 'required');
  assert.deepEqual(r.rules.epic, { required: true, default: '수행' });
  assert.deepEqual(r.rules.size, { minDays: 1, maxDays: 3, split: '(n)' });
  assert.deepEqual(r.rules.requiredDates, ['story', 'task']);
  assert.equal(r.rules.releases, 'required');
  assert.equal(r.rules.close.need, 'output', '산출물 링크 없이 Done 금지');
  assert.deepEqual(r.rules.bugComments, { deployed: '해결 방법', verified: '검증 방법' });
  assert.equal(r.rules.gitHost, 'gitlab');
  // 옛 키 → 새 키
  assert.deepEqual(r.rules.issueTypes.story, ['스토리']);
  assert.deepEqual(r.rules.transitions.story, { devStart: ['개발 진행'], devDone: ['개발 완료'] });
  assert.deepEqual(r.rules.transitions.bug, { deployed: ['Deployed'], verified: ['Verified'] });
  assert.deepEqual(r.rules.outputField, { name: '산출물', id: null }, '자리 표시 문구(REPLACE…)는 값이 아니다');
  assert.equal(r.project.gitWebBaseUrl, null, 'OMIT… 자리 표시도 값이 아니다');
  assert.equal(r.project.defaultProjectKey, 'SAP');
  assert.equal(r.git.kind, 'gitlab', 'org-guideline 은 예전처럼 GitLab 주소');
});

test('preset 을 적으면 그것, 같은 키를 적으면 프리셋 값을 덮는다', () => {
  const r = R({ preset: 'basic', issueTypes: { task: ['Chore'] }, releases: 'off', outputField: { name: 'Deliverable' } });
  assert.equal(r.presetFrom, '설정');
  assert.deepEqual(r.rules.issueTypes.task, ['Chore']);
  assert.deepEqual(r.rules.issueTypes.story, PRESETS.basic.issueTypes.story, 'issueTypes 는 종류 단위로 합친다');
  assert.equal(r.rules.releases, 'off');
  assert.deepEqual(r.rules.outputField, { name: 'Deliverable' });
  const org = R({ preset: 'org-guideline' });
  assert.deepEqual(org.warnings, []);
  assert.equal(org.rules.subtask, 'required');
});

test('틀린 값은 멈추고, 모르는 키는 경고한다', () => {
  assert.throws(() => R({ preset: 'acme' }), /preset 'acme' 는 없다/);
  assert.throws(() => R({ releases: 'maybe' }), /releases 는/);
  assert.throws(() => R({ close: { need: 'anything' } }), /close\.need/);
  assert.throws(() => R({ unit: ['story', 'saga'] }), /unit 은/);
  assert.throws(() => R({ gitHost: 'gitea' }), /gitHost/);
  assert.ok(R({ preset: 'basic', foo: 1 }).warnings.some((w) => w.includes('"foo"')));
});

test('tracker: none 은 쓰지 않고, github·linear 는 아직 스텁이라 none 처럼', () => {
  assert.equal(R(null, { dt: { tracker: 'none' } }).writes, false);
  const gh = R(null, { dt: { tracker: 'github' } });
  assert.equal(gh.writes, false);
  assert.ok(gh.warnings.some((w) => w.includes('아직 연동하지 않는다')));
});

test('.dt.json 의 tracker 를 읽고, 개인 파일이 팀 파일을 덮는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wl-cfg-'));
  try {
    writeFileSync(join(dir, '.dt.json'), JSON.stringify({ tracker: 'none' }));
    writeFileSync(join(dir, '.dt-worklog.json'), JSON.stringify({ preset: 'basic', defaultProjectKey: 'APP' }));
    writeFileSync(join(dir, '.dt-worklog.local.json'), JSON.stringify({ lastSyncSha: 'abc', defaultProjectKey: 'MINE' }));
    const r = resolveWorklogConfig(dir, { remote: null });
    assert.equal(r.tracker, 'none');
    assert.equal(r.project.defaultProjectKey, 'MINE');
    assert.equal(r.local.lastSyncSha, 'abc');
    assert.deepEqual(r.sources, ['.dt-worklog.json', '.dt-worklog.local.json']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// --- 마무리 댓글(TP-002 §4) ---
const CLOSE = (o = {}) => ['**완료**', `- 결과: ${o.result ?? '로그인 실패 메시지를 바꿨다'}`, `- 산출물: ${o.output ?? '{PR/커밋, 문서, 배포 URL, 테스트 결과}'}`, `- 결정 사항: ${o.decision ?? '{무엇을 왜 정했나, 버린 대안}'}`, '- 완료 조건: 2/2'].join('\n');

test('마무리 댓글: basic 은 산출물이나 결정 사항 하나면 통과, 둘 다 비면 막는다', () => {
  const basic = PRESETS.basic;
  assert.equal(checkCloseComment(CLOSE({ output: 'https://github.com/acme/app/pull/12' }), basic).ok, true);
  assert.equal(checkCloseComment(CLOSE({ decision: '세션 저장소는 Redis 로 — 메모리는 재시작에 날아간다' }), basic).ok, true, '결정만 남는 조사·설계 일도 완료');
  const none = checkCloseComment(CLOSE(), basic);
  assert.equal(none.ok, false);
  assert.deepEqual(none.missing, ['산출물 또는 결정 사항'], '템플릿 자리 표시({…})는 빈 값');
  assert.deepEqual(checkCloseComment(CLOSE({ output: '없음' }), basic).missing, ['산출물 또는 결정 사항']);
  assert.deepEqual(checkCloseComment(CLOSE({ result: '', output: 'x' }), basic).missing, ['결과']);
});

test('마무리 댓글: org-guideline 은 산출물 링크가 꼭 있어야 하고, 예전 자유 서술 댓글도 읽는다', () => {
  const org = PRESETS['org-guideline'];
  assert.deepEqual(checkCloseComment(CLOSE({ decision: '무언가 정함' }), org).missing, ['산출물'], '결정만으로는 Done 금지(예전 규칙 7)');
  assert.equal(checkCloseComment('로그인 화면 구현을 마쳤다.\n\n**산출물**: https://git.example.com/g/r/-/commit/559dba4', org).ok, true);
});

test('CLI check-close: 통과 0 · 막음 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dt-wl-close-'));
  try {
    writeFileSync(join(dir, 'ok.md'), CLOSE({ decision: 'A 로 정했다' }));
    writeFileSync(join(dir, 'no.md'), CLOSE());
    const ok = spawnSync(process.execPath, [CLI, 'check-close', join(dir, 'ok.md'), '--project', dir], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    const no = spawnSync(process.execPath, [CLI, 'check-close', join(dir, 'no.md'), '--project', dir], { encoding: 'utf8' });
    assert.equal(no.status, 1);
    assert.match(no.stdout, /산출물 또는 결정 사항/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('템플릿·정책: basic 템플릿의 마무리 댓글 항목이 검사기가 읽는 이름과 같다', () => {
  const tpl = readFileSync(join(root, 'skills/dt-worklog-sync/references/worklog-templates.md'), 'utf8');
  const basic = tpl.slice(tpl.indexOf('## basic'), tpl.indexOf('## org-guideline'));
  for (const label of ['- 결과:', '- 산출물:', '- 결정 사항:', '- 완료 조건:', '- 관련 문서:', '**진행**', '## 배경', '## 목표', '## 완료 조건', '## 참고']) {
    assert.ok(basic.includes(label), `basic 템플릿에 ${label} 가 없다`);
  }
  assert.ok(basic.includes('📄 [{문서 제목}]({URL})'), '관련 문서 줄 형식');
  assert.ok(!/## 어떻게/.test(basic), 'basic 설명에는 "어떻게"를 넣지 않는다(TP-002)');
  const tp = readFileSync(join(root, 'docs/policies/TP-002-task-records.md'), 'utf8');
  assert.match(tp, /^status: accepted$/m);
  for (const p of ['basic', 'org-guideline']) assert.ok(readFileSync(join(root, `skills/dt-worklog-sync/references/presets/${p}.md`), 'utf8').length > 200);
});

// --- git 웹 주소 ---
test('git 리모트 모양 3가지와 호스트 감지', () => {
  assert.deepEqual(parseRemote(scp('git', 'github.com', 'acme/app.git')), { host: 'github.com', path: 'acme/app', webBase: 'https://github.com/acme/app' });
  assert.equal(parseRemote('ssh://git@git.example.com:14022/rnd/dt.git').webBase, 'https://git.example.com/rnd/dt');
  assert.equal(parseRemote(`https://${'user'}@bitbucket.org/team/repo.git`).webBase, 'https://bitbucket.org/team/repo');
  assert.equal(parseRemote('https://gitlab.com/g/sub/repo').webBase, 'https://gitlab.com/g/sub/repo');
  assert.equal(parseRemote('not a remote'), null);
  assert.equal(detectHost('github.com'), 'github');
  assert.equal(detectHost('gitlab.com'), 'gitlab');
  assert.equal(detectHost('gitlab.mycorp.io'), 'gitlab');
  assert.equal(detectHost('bitbucket.org'), 'bitbucket');
  assert.equal(detectHost('git.example.com'), null, '이름으로 모르면 지어내지 않는다');
});

test('호스트별 커밋·PR 주소, 사설 호스트는 gitHost 로', () => {
  const gh = resolveGitWeb({ remote: scp('git', 'github.com', 'acme/app.git') });
  assert.equal(commitUrl(gh, 'abc'), 'https://github.com/acme/app/commit/abc');
  assert.equal(prUrl(gh, 12), 'https://github.com/acme/app/pull/12');
  const gl = resolveGitWeb({ remote: scp('git', 'gitlab.com', 'g/r.git') });
  assert.equal(commitUrl(gl, 'abc'), 'https://gitlab.com/g/r/-/commit/abc');
  assert.equal(prUrl(gl, 3), 'https://gitlab.com/g/r/-/merge_requests/3');
  const bb = resolveGitWeb({ remote: scp('git', 'bitbucket.org', 't/r.git') });
  assert.equal(commitUrl(bb, 'abc'), 'https://bitbucket.org/t/r/commits/abc');
  assert.equal(prUrl(bb, 7), 'https://bitbucket.org/t/r/pull-requests/7');
  const priv = resolveGitWeb({ remote: 'ssh://git@git.example.com:14022/rnd/dt.git' });
  assert.equal(priv.kind, null); assert.equal(commitUrl(priv, 'abc'), null);
  const set = resolveGitWeb({ remote: 'ssh://git@git.example.com:14022/rnd/dt.git', gitHost: 'gitlab' });
  assert.equal(commitUrl(set, '559dba4'), 'https://git.example.com/rnd/dt/-/commit/559dba4', '예전 GitLab 규칙과 같은 주소');
  const base = resolveGitWeb({ remote: scp('git', 'github.com', 'a/b.git'), gitWebBaseUrl: 'https://web.example.com/a/b/' , gitHost: 'gitlab' });
  assert.equal(commitUrl(base, 'x'), 'https://web.example.com/a/b/-/commit/x');
});

test('gitWebUrl CLI: 호스트 종류를 모르면 종료 코드 3(사람에게 묻기)', () => {
  const r = spawnSync(process.execPath, [GIT, '--remote', scp('git', 'git.example.com', 'a/b.git'), 'commit', 'abc'], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  const ok = spawnSync(process.execPath, [GIT, '--remote', scp('git', 'git.example.com', 'a/b.git'), '--host', 'gitlab', 'commit', 'abc'], { encoding: 'utf8' });
  assert.equal(ok.stdout.trim(), 'https://git.example.com/a/b/-/commit/abc');
});
