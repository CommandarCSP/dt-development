// 위키 문서 규칙(GEN-10, TP-003) — 종류 7개·구역·제목·공통 머리·검토일, 옛 이름·옛 설정 호환, wiki 종류.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES, SECTIONS, normalizeType, resolveWikiConfig, buildTitle, nextReview, renderHeader, wikiPath } from '../scripts/wikiConfig.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(root, 'scripts/wikiConfig.mjs');
const TPL = join(root, 'skills/dt-confluence-doc/references/templates');
const R = (team, dt = { wiki: 'confluence' }) => resolveWikiConfig(tmpdir(), { team, local: null, dt });

test('종류 7개, 구역 6개 — TP-003 §1·§3 과 같다', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), ['design', 'guide', 'meeting', 'postmortem', 'release', 'report', 'retro']);
  assert.deepEqual(Object.values(SECTIONS), ['설계', '운영 가이드', '회의록', '보고·회고', '릴리즈 노트', '장애 회고']);
  for (const t of Object.values(TYPES)) assert.ok(t.section in SECTIONS);
  assert.deepEqual(Object.entries(TYPES).filter(([, t]) => t.review).map(([k]) => k), ['design', 'guide'], '검토일은 설계·가이드만');
  const tp = readFileSync(join(root, 'docs/policies/TP-003-wiki-docs.md'), 'utf8');
  assert.match(tp, /^status: accepted$/m);
  for (const k of Object.keys(TYPES)) assert.ok(tp.includes(`\`${k}\``), `TP-003 에 ${k} 가 없다`);
});

test('템플릿 7개 — 종류마다 하나, 공통 머리·구역·라벨·절·소스가 있다', () => {
  assert.deepEqual(readdirSync(TPL).map((f) => f.replace(/\.md$/, '')).sort(), Object.keys(TYPES).sort());
  for (const [k, t] of Object.entries(TYPES)) {
    const s = readFileSync(join(TPL, `${k}.md`), 'utf8');
    assert.ok(s.includes(`(type: ${k})`), k);
    assert.ok(s.includes(`구역: **${SECTIONS[t.section]}**`), `${k} 구역`);
    assert.ok(s.includes(`\`doc-${k}\``), `${k} 라벨`);
    assert.ok(s.includes(`wikiConfig.mjs" header --type ${k}`), `${k} 공통 머리`);
    assert.ok(s.includes(t.review ? '검토일**이 있다' : '검토일이 없다'), `${k} 검토일 문구`);
    assert.match(s, /## 절[\s\S]*1\. \*\*/, `${k} 절`);
    assert.match(s, /## 소스\n\S/, `${k} 소스`);
  }
  assert.match(readFileSync(join(TPL, 'postmortem.md'), 'utf8'), /탓하지 않는다/);
  assert.match(readFileSync(join(TPL, 'design.md'), 'utf8'), /검토한 대안/);
});

test('옛 종류 이름: worklog → report(경고), techdoc 은 design·guide 를 묻는다, 모르는 이름은 멈춘다', () => {
  assert.deepEqual(normalizeType('design'), { type: 'design' });
  const w = normalizeType('worklog');
  assert.equal(w.type, 'report'); assert.match(w.warning, /report/);
  const t = normalizeType('techdoc');
  assert.equal(t.type, null); assert.deepEqual(t.ask, ['design', 'guide']);
  assert.throws(() => normalizeType('memo'), /문서 종류 'memo' 는 없다/);
});

test('제목 규칙', () => {
  const d = '2026-11-26';
  assert.equal(buildTitle('meeting', { topic: '주간 회의', date: d }), '2026-11-26 주간 회의');
  assert.equal(buildTitle('report', { topic: 'M1·M2', date: d }), '2026-11-26 M1·M2 작업 보고');
  assert.equal(buildTitle('design', { topic: '위키 어댑터' }), '[설계] 위키 어댑터');
  assert.equal(buildTitle('guide', { topic: '배포하기' }), '[가이드] 배포하기');
  assert.equal(buildTitle('retro', { topic: '11월', date: d }), '2026-11-26 11월 회고');
  assert.equal(buildTitle('release', { topic: 'v0.16.0' }), 'v0.16.0 릴리즈 노트');
  assert.equal(buildTitle('postmortem', { topic: '로그인 실패', date: d }), '2026-11-26 장애: 로그인 실패');
  assert.throws(() => buildTitle('meeting', { topic: ' ', date: d }), /topic/);
  assert.throws(() => buildTitle('meeting', { topic: 'x', date: '26-11-2026' }), /YYYY-MM-DD/);
});

test('다음 검토일 — 달을 더하고, 없는 날은 그 달 말일로', () => {
  assert.equal(nextReview('2026-11-26', 6), '2027-05-26');
  assert.equal(nextReview('2026-08-31', 6), '2027-02-28');
  assert.equal(nextReview('2027-08-31', 6), '2028-02-29');
  assert.equal(nextReview('2026-01-15', 12), '2027-01-15');
});

test('공통 머리 — 검토일은 설계·가이드만, 빈 칸은 뺀다, HTML 은 이스케이프', () => {
  const base = { status: '확정', owner: '채승표', date: '2026-11-26', summary: '요약 <b>' };
  const md = renderHeader({ ...base, type: 'design', issues: ['DEV-15'], decisions: ['TP-003'] }, 'markdown');
  assert.match(md, /\*\*검토일\*\* 2026-11-26 \(다음 검토: 2027-05-26\)/);
  assert.match(md, /\*\*관련 이슈\*\* DEV-15 · \*\*관련 결정\*\* TP-003/);
  const rep = renderHeader({ ...base, type: 'report', issues: [], decisions: [] }, 'markdown');
  assert.ok(!rep.includes('검토일'), '기록 문서는 검토일 없음');
  assert.ok(!rep.includes('관련 이슈'), '빈 칸은 줄째 뺀다');
  const html = renderHeader({ ...base, type: 'guide', issues: ['DEV-1'], site: 'x.atlassian.net' }, 'html');
  assert.match(html, /^<div data-type="panel-info">/);
  assert.match(html, /<span data-type="status" data-color="green">확정<\/span>/);
  assert.match(html, /<a href="https:\/\/x\.atlassian\.net\/browse\/DEV-1">DEV-1<\/a>/);
  assert.match(html, /요약 &lt;b&gt;/);
  assert.throws(() => renderHeader({ ...base, type: 'report', status: '완료' }), /상태는/);
  assert.throws(() => renderHeader({ ...base, type: 'report', owner: '' }), /담당자/);
});

test('markdown 위키 경로 — 구역 폴더, 회의록은 연도 하위', () => {
  assert.equal(wikiPath('meeting', '2026-11-26 주간 회의'), 'docs/wiki/meeting/2026/2026-11-26 주간 회의.md');
  assert.equal(wikiPath('design', '[설계] a/b'), 'docs/wiki/design/[설계] a-b.md');
  assert.equal(wikiPath('retro', '2026-11-26 11월 회고'), 'docs/wiki/report/2026-11-26 11월 회고.md');
});

test('설정 — 기본값, sections, 옛 parentPageId·labelsByType, wiki 종류', () => {
  const d = R(null);
  assert.equal(d.wiki, 'confluence'); assert.equal(d.writes, true); assert.equal(d.reviewMonths, 6);
  assert.deepEqual(d.labels.design, ['doc-design']);
  assert.ok(Object.values(d.sections).every((v) => v === null));
  const s = R({ sections: { design: 111, foo: 1 }, labelsByType: { design: ['arch'] }, reviewMonths: 12 });
  assert.equal(s.sections.design, '111');
  assert.deepEqual(s.labels.design, ['doc-design', 'arch']);
  assert.equal(s.reviewMonths, 12);
  assert.ok(s.warnings.some((w) => w.includes('sections.foo')));
  // 옛 위저드 설정(예전 example 그대로)
  const old = R({ site: 'a.atlassian.net', defaultSpaceKey: 'SAP', defaultSpaceId: '9', parentPageId: '42', labelsByType: { meeting: ['meeting-notes'], worklog: ['worklog'], techdoc: ['tech-doc'], retro: ['retrospective'] } });
  assert.ok(Object.values(old.sections).every((v) => v === '42'), 'parentPageId 는 구역이 없는 종류의 부모로');
  assert.deepEqual(old.labels.report, ['doc-report', 'worklog']);
  assert.deepEqual(old.labels.design, ['doc-design', 'tech-doc']);
  assert.deepEqual(old.labels.guide, ['doc-guide', 'tech-doc']);
  assert.ok(old.warnings.some((w) => w.includes('parentPageId')));
  assert.equal(R({ defaultSpaceKey: 'REPLACE_WITH_TEAM_SPACE_KEY' }).project.defaultSpaceKey, null, '자리 표시는 값이 아니다');
  assert.equal(R(null, { wiki: 'markdown' }).writes, true);
  assert.equal(R(null, { wiki: 'none' }).writes, false);
  const n = R(null, { wiki: 'notion' });
  assert.equal(n.writes, false); assert.ok(n.warnings.some((w) => w.includes('아직 연동하지 않는다')));
  assert.throws(() => R({ reviewMonths: 0 }), /reviewMonths/);
});

test('CLI title · path · header', () => {
  const t = spawnSync(process.execPath, [CLI, 'title', '--type', 'worklog', '--topic', 'M1', '--date', '2026-11-26'], { encoding: 'utf8' });
  assert.equal(t.stdout.trim(), '2026-11-26 M1 작업 보고');
  const p = spawnSync(process.execPath, [CLI, 'path', '--type', 'release', '--title', 'v1 릴리즈 노트'], { encoding: 'utf8' });
  assert.equal(p.stdout.trim(), 'docs/wiki/release/v1 릴리즈 노트.md');
  const h = spawnSync(process.execPath, [CLI, 'header', '--project', tmpdir(), '--type', 'design', '--status', '초안', '--owner', 'A', '--date', '2026-11-26', '--summary', 'S', '--format', 'markdown'], { encoding: 'utf8' });
  assert.match(h.stdout, /\*\*상태\*\* 초안 · \*\*담당자\*\* A · \*\*검토일\*\* 2026-11-26/);
  const bad = spawnSync(process.execPath, [CLI, 'title', '--type', 'memo', '--topic', 'x'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
