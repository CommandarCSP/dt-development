// 결정 기록(TP·PD) — 파싱·양식 검사·번호·만료·근거 확인.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseDecision, validateDecision, isExpired, isActive, nextId, loadDecisions, checkDecisionRef, PLUGIN_ROOT,
  decisionDirs, duplicateIds,
} from '../scripts/decisions.mjs';

const doc = (meta, sections = ['맥락', '결정', '이유', '버린 대안', '출처']) =>
  `---\n${Object.entries(meta).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n# 제목\n${sections.map((s) => `## ${s}\n내용\n`).join('')}`;
const META = { id: 'PD-001', title: '삭제는 휴지통 방식', status: 'accepted', scope: '전 리소스', date: '2026-11-13' };

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'dt-dec-'));
  mkdirSync(join(root, 'docs/decisions'), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'docs/decisions', name), body);
  return root;
}

test('템플릿으로 만든 문서는 자리표만 채우면 양식을 통과한다', () => {
  const tmpl = readFileSync(join(PLUGIN_ROOT, 'templates/decision.md.tmpl'), 'utf8')
    .replaceAll('{{ID}}', 'PD-001').replaceAll('{{TITLE}}', 't').replaceAll('{{SCOPE}}', 's').replaceAll('{{DATE}}', '2026-11-13');
  assert.deepEqual(validateDecision(parseDecision(tmpl), { fileName: 'PD-001-t.md' }), []);
});

test('validateDecision: 빠진 머리말·잘못된 값·빠진 절·파일명 불일치를 잡는다', () => {
  assert.deepEqual(validateDecision(parseDecision(doc(META)), { fileName: 'PD-001-trash.md' }), []);
  const bad = validateDecision(parseDecision(doc({ ...META, id: 'X-1', status: 'done', date: '13/11/2026', scope: '' }, ['맥락'])), { fileName: 'PD-002-x.md' });
  assert.ok(bad.some((p) => p.includes('id')));
  assert.ok(bad.some((p) => p.includes('status')));
  assert.ok(bad.some((p) => p.includes('date')));
  assert.ok(bad.some((p) => p.includes('scope')));
  assert.ok(bad.some((p) => p.includes('## 결정')));
  assert.deepEqual(validateDecision(parseDecision('# 머리말 없음')), ['머리말(--- 블록)이 없다']);
  assert.ok(validateDecision(parseDecision(doc({ ...META, status: 'superseded' })), {}).some((p) => p.includes('supersededBy')));
});

test('isExpired·isActive', () => {
  assert.equal(isExpired({ expires: '2026-01-01' }, '2026-11-13'), true);
  assert.equal(isExpired({ expires: '2027-01-01' }, '2026-11-13'), false);
  assert.equal(isExpired({ expires: '' }, '2026-11-13'), false);
  assert.equal(isActive({ status: 'accepted' }), true);
  assert.equal(isActive({ status: 'accepted', supersededBy: 'PD-002' }), false);
  assert.equal(isActive({ status: 'proposed' }), false);
});

test('nextId: 폴더가 없으면 001, 있으면 최대 + 1', () => {
  const root = project({ 'PD-001-a.md': doc(META), 'PD-007-b.md': doc({ ...META, id: 'PD-007' }) });
  try {
    assert.equal(nextId(join(root, 'docs/decisions'), 'PD'), 'PD-008');
    assert.equal(nextId(join(root, 'nowhere'), 'PD'), 'PD-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('loadDecisions: 프로젝트 PD 와 플러그인 TP 를 함께 읽는다', () => {
  const root = project({ 'PD-001-a.md': doc(META), 'README.md': '# 색인' });
  try {
    const ids = loadDecisions(root).map((d) => d.meta.id);
    assert.ok(ids.includes('PD-001'));
    assert.ok(ids.includes('TP-001'));
    assert.ok(!ids.includes(undefined), 'PD-/TP- 로 시작하지 않는 파일은 읽지 않는다');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('checkDecisionRef: 없음·못 찾음·대체됨은 error, 만료는 warn, 유효하면 통과', () => {
  const root = project({
    'PD-001-a.md': doc(META),
    'PD-002-b.md': doc({ ...META, id: 'PD-002', status: 'superseded', supersededBy: 'PD-001' }),
    'PD-003-c.md': doc({ ...META, id: 'PD-003', expires: '2000-01-01' }),
  });
  try {
    assert.equal(checkDecisionRef(root, null).level, 'error');
    assert.equal(checkDecisionRef(root, 'PD-404').level, 'error');
    assert.equal(checkDecisionRef(root, 'PD-002').level, 'error');
    assert.equal(checkDecisionRef(root, 'PD-003').level, 'warn');
    assert.deepEqual(checkDecisionRef(root, 'PD-001'), { ok: true, level: null, message: null });
    assert.equal(checkDecisionRef(root, 'TP-001').level, null, '팀 정책도 근거가 될 수 있다');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI: list 는 채택된 것만, --all 은 전부, check 는 문제가 있으면 exit 1', () => {
  const script = fileURLToPath(new URL('../scripts/decisions.mjs', import.meta.url));
  const root = project({ 'PD-001-a.md': doc(META), 'PD-002-b.md': doc({ ...META, id: 'PD-002', status: 'proposed' }) });
  try {
    const active = JSON.parse(execFileSync('node', [script, 'list', root, '--json'], { encoding: 'utf8' })).map((d) => d.id);
    assert.ok(active.includes('PD-001') && !active.includes('PD-002'));
    const all = JSON.parse(execFileSync('node', [script, 'list', root, '--all', '--json'], { encoding: 'utf8' })).map((d) => d.id);
    assert.ok(all.includes('PD-002'));
    assert.equal(execFileSync('node', [script, 'next', root], { encoding: 'utf8' }).trim(), 'PD-003');
    writeFileSync(join(root, 'docs/decisions/PD-003-bad.md'), '# 머리말 없음');
    assert.throws(() => execFileSync('node', [script, 'check', join(root, 'docs/decisions')], { encoding: 'utf8' }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('플러그인 팀 정책(docs/policies)은 모두 양식을 지킨다', () => {
  const script = fileURLToPath(new URL('../scripts/decisions.mjs', import.meta.url));
  execFileSync('node', [script, 'check', join(PLUGIN_ROOT, 'docs/policies')], { encoding: 'utf8' });
});

// 저장소가 FE·BE 로 나뉜 경우 — BE 저장소가 .dt.json decisions.sharedDir 로 FE 저장소(정의서 쪽)의 결정 폴더를 가리킨다.
function splitRepos({ shared = {}, local = {}, sharedDir = '../fe/docs/decisions' } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'dt-dec-split-'));
  const fe = join(base, 'fe'); const be = join(base, 'be');
  for (const [root, files] of [[fe, shared], [be, local]]) {
    mkdirSync(join(root, 'docs/decisions'), { recursive: true });
    for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'docs/decisions', name), body);
  }
  if (sharedDir !== null) writeFileSync(join(be, '.dt.json'), JSON.stringify({ decisions: { sharedDir } }));
  return { base, fe, be };
}

test('공유 결정 폴더: 읽기·번호·근거 검사가 두 폴더를 함께 본다', () => {
  const { base, fe, be } = splitRepos({
    shared: { 'PD-001-a.md': doc(META), 'PD-009-b.md': doc({ ...META, id: 'PD-009', topic: 'stack.be.unitTest' }) },
    local: { 'PD-002-c.md': doc({ ...META, id: 'PD-002' }) },
  });
  try {
    const dirs = decisionDirs(be);
    assert.equal(dirs.shared, join(fe, 'docs/decisions'));
    assert.equal(dirs.sharedMissing, false);
    const docs = loadDecisions(be);
    assert.deepEqual(docs.filter((d) => d.origin !== 'policy').map((d) => `${d.origin}:${d.meta.id}`), ['local:PD-002', 'shared:PD-001', 'shared:PD-009']);
    assert.equal(nextId([dirs.local, dirs.shared], 'PD'), 'PD-010', '번호는 두 폴더의 최대 + 1');
    assert.equal(checkDecisionRef(be, 'PD-009').level, null, '공유 폴더의 PD 도 override 근거가 된다');
    assert.equal(checkDecisionRef(be, 'PD-404').level, 'error');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('공유 결정 폴더가 없으면(이 저장소만 받은 CI) 못 찾은 근거는 error 대신 warn', () => {
  const { base, be } = splitRepos({ sharedDir: '../nowhere/docs/decisions' });
  try {
    assert.equal(decisionDirs(be).sharedMissing, true);
    const r = checkDecisionRef(be, 'PD-001');
    assert.equal(r.level, 'warn');
    assert.match(r.message, /공유 결정 폴더/);
    assert.equal(checkDecisionRef(be, null).level, 'error', '근거를 아예 안 적은 것은 여전히 error');
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('sharedDir 이 없거나 자기 폴더면 지금과 같다', () => {
  const { base, be } = splitRepos({ sharedDir: null }); // .dt.json 없음
  try {
    assert.equal(decisionDirs(be).shared, null);
    writeFileSync(join(be, '.dt.json'), JSON.stringify({ decisions: { sharedDir: 'docs/decisions' } }));
    assert.equal(decisionDirs(be).shared, null);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CLI: 프로젝트 루트 check 는 두 폴더의 번호 중복을 잡고, next 는 이어 붙인다', () => {
  const script = fileURLToPath(new URL('../scripts/decisions.mjs', import.meta.url));
  const { base, be } = splitRepos({ shared: { 'PD-001-a.md': doc(META) }, local: { 'PD-001-dup.md': doc(META) } });
  try {
    assert.equal(execFileSync('node', [script, 'next', be], { encoding: 'utf8' }).trim(), 'PD-002');
    assert.deepEqual(duplicateIds(loadDecisions(be)).map((d) => d.id), ['PD-001']);
    assert.throws(() => execFileSync('node', [script, 'check', be], { encoding: 'utf8' }), (e) => /번호 중복 PD-001/.test(e.stdout));
    execFileSync('node', [script, 'check', join(be, 'docs/decisions')], { encoding: 'utf8' }); // 폴더만 주면 그 폴더만 — 중복 없음
  } finally { rmSync(base, { recursive: true, force: true }); }
});
