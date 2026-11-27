// 핸드북 근거 원천(GEN-13) — 결정 기록이 먼저, 위키·트래커는 설정을 따른다, G8 은 팀 사이트도 가린다.
// dt-audit 후속 기록은 tracker 를 따른다(문서 절차 — 구조로 고정).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../scripts/lib/config.mjs';
import { resolveHandbookSources, linkHosts, linkRegex } from '../scripts/handbook/sources.mjs';
import { runGate } from '../scripts/handbook/gate.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), 'hb-src-'));
const S = (dt, handbook = null) => resolveHandbookSources(tmp(), { dt: validate(dt, []), handbook, wikiCfg: null, worklogCfg: null });

test('기본(jira·confluence) — 결정 기록 + 라벨로 좁힌 Confluence + Jira, MCP 필요', () => {
  const s = S({}, { sources: { atlassian: { enabled: 'auto', jiraProject: 'APP', confluenceSpace: 'ENG' } } });
  assert.deepEqual(s.decisions.dirs, ['docs/decisions']);
  assert.deepEqual(s.wiki, { kind: 'confluence', space: 'ENG', labels: ['doc-design', 'doc-guide'], needsMcp: true });
  assert.deepEqual(s.tracker, { kind: 'jira', project: 'APP', needsMcp: true });
  assert.equal(s.needsMcp, true);
  assert.deepEqual(s.skipped, []);
});

test('tracker·wiki 가 none — 결정 기록만, MCP 안내 없음', () => {
  const s = S({ tracker: 'none', wiki: 'none' });
  assert.equal(s.wiki, null);
  assert.equal(s.tracker, null);
  assert.equal(s.needsMcp, false);
  assert.deepEqual(s.skipped, ['wiki: none', 'tracker: none']);
  assert.ok(s.decisions.dirs.length >= 1);
});

test('tracker none + wiki markdown — 저장소 설계·가이드 폴더를 직접, MCP 불필요', () => {
  const s = S({ tracker: 'none', wiki: 'markdown' });
  assert.deepEqual(s.wiki, { kind: 'markdown', dirs: ['docs/wiki/design', 'docs/wiki/guide'], needsMcp: false });
  assert.equal(s.needsMcp, false);
});

test('옛 sources.atlassian.enabled off — MCP 원천만 끄고 결정 기록·markdown 위키는 그대로', () => {
  const off = { sources: { atlassian: { enabled: 'off' } } };
  const s = S({}, off);
  assert.equal(s.wiki, null);
  assert.equal(s.tracker, null);
  assert.equal(s.needsMcp, false);
  assert.ok(s.skipped.every((x) => x.includes('off')));
  assert.equal(S({ wiki: 'markdown' }, off).wiki.kind, 'markdown');
});

test('결정 공유 폴더(decisions.sharedDir)도 읽는다', () => {
  const dir = tmp();
  try {
    writeFileSync(join(dir, '.dt.json'), JSON.stringify({ decisions: { sharedDir: '../web/docs/decisions' } }));
    const s = resolveHandbookSources(dir, { handbook: null, wikiCfg: null, worklogCfg: null });
    assert.deepEqual(s.decisions.dirs, ['docs/decisions', '../web/docs/decisions']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('linkHosts — 기본 Atlassian·Notion + 팀 설정의 site, 자리 표시는 뺀다', () => {
  const dir = tmp();
  try {
    assert.deepEqual(linkHosts(dir), ['atlassian.net', 'notion.so', 'notion.site']);
    writeFileSync(join(dir, '.dt-confluence.json'), JSON.stringify({ site: 'https://wiki.example.com/' }));
    writeFileSync(join(dir, '.dt-worklog.json'), JSON.stringify({ site: 'REPLACE_WITH_SITE' }));
    assert.deepEqual(linkHosts(dir), ['atlassian.net', 'notion.so', 'notion.site', 'wiki.example.com']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('linkRegex — 호스트와 하위 도메인만, 비슷한 이름은 안 잡는다', () => {
  const re = () => linkRegex(['atlassian.net', 'wiki.example.com']);
  assert.deepEqual('a https://acme.atlassian.net/wiki/x b'.match(re()), ['https://acme.atlassian.net/wiki/x']);
  assert.deepEqual('(https://wiki.example.com).'.match(re()), ['https://wiki.example.com']);
  assert.equal('https://wiki.example.com.evil.io/x'.match(re()), null);
  assert.equal('https://notatlassian.network/x'.match(re()), null);
});

// gate 테스트와 같은 최소 프로젝트
function proj({ body, config = {}, files = {} }) {
  const dir = tmp();
  const hb = join(dir, 'docs', 'handbook');
  mkdirSync(hb, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'p', version: '1.0.0' }));
  writeFileSync(join(dir, '.dt-handbook.json'), JSON.stringify({ product: 'P', pdfName: 'P-Handbook.pdf', audience: 'internal', ...config }));
  writeFileSync(join(hb, 'handbook.md'), `---\ntitle: P\nversion: 1.0.0\n---\n${body}`);
  writeFileSync(join(hb, 'structure.json'), JSON.stringify({ clusters: [], data: { byTarget: {}, multiOwner: [] }, entrypoints: [], boundaries: [], hotspots: { available: false } }));
  for (const [f, v] of Object.entries(files)) writeFileSync(join(dir, f), JSON.stringify(v));
  return dir;
}
const g8 = (dir) => runGate({ projectRoot: dir }).findings.filter((f) => f.id === 'G8').map((f) => f.message);

test('G8 — external 이면 팀 위키 사이트·Notion 링크를 막고, internal 은 막지 않는다', () => {
  const body = '## 1. 요약\n\n설계는 https://wiki.example.com/pages/1 과 https://acme.notion.site/x 에 있다.\n';
  const files = { '.dt-confluence.json': { site: 'wiki.example.com' } };
  const ext = proj({ body, config: { audience: 'external' }, files });
  const int = proj({ body, files });
  try {
    const m = g8(ext);
    assert.ok(m.some((x) => x.includes('wiki.example.com')), m.join('\n'));
    assert.ok(m.some((x) => x.includes('notion.site')));
    assert.deepEqual(g8(int), []);
  } finally { rmSync(ext, { recursive: true, force: true }); rmSync(int, { recursive: true, force: true }); }
});

test('dt-audit — 후속 기록은 tracker 를 따르고, 키를 traceability 에 되적는다', () => {
  const skill = readFileSync(join(root, 'skills/dt-audit/SKILL.md'), 'utf8');
  assert.doesNotMatch(skill, /Jira Sub-task/);
  assert.match(skill, /`tracker`를 따른다/);
  assert.match(skill, /`jira`: .*Task 하나/);
  assert.match(skill, /`none`·`github`·`linear`: 트래커에 쓰지 않는다.*pending\.md/s);
  assert.match(skill, /issue\.read/);
  const tpl = readFileSync(join(root, 'skills/dt-audit/references/report-template.md'), 'utf8');
  assert.match(tpl, /## 후속 기록\n\n\| finding \| 기록한 곳 \| 기록한 run \|/);
  assert.match(tpl, /완료인데 .* 남아 있다/);
  assert.match(readFileSync(join(root, 'docs/refs/tracker-adapter.md'), 'utf8'), /^\| `issue\.read` \|/m);
});

test('dt-handbook — 근거 원천은 sources.mjs, 결정 기록이 먼저', () => {
  const skill = readFileSync(join(root, 'skills/dt-handbook/SKILL.md'), 'utf8');
  assert.match(skill, /scripts\/handbook\/sources\.mjs/);
  assert.match(skill, /`needsMcp` 가 true 일 때만/);
  const agent = readFileSync(join(root, 'agents/handbook-analyst.md'), 'utf8');
  assert.match(agent, /1\. \*\*결정 기록\*\*/);
});

test('dt-explain 은 없앴다 — 스킬·명령·참조가 남아 있지 않다', () => {
  assert.equal(existsSync(join(root, 'skills/dt-explain')), false);
  assert.equal(existsSync(join(root, 'commands/dt-explain.md')), false);
  for (const f of ['README.md', 'docs/orchestration-policy.md', 'docs/refs/readable-writing.md', 'docs/refs/atlassian-mcp.md', 'agents/ko-writing-reviewer.md', 'skills/dt-ko/SKILL.md', 'skills/dt-handbook/SKILL.md']) {
    assert.doesNotMatch(readFileSync(join(root, f), 'utf8'), /dt-explain/, f);
  }
});

test('ADR 폴더 — 흔한 위치를 자동으로 찾고, sources.decisions.dirs 로 더한다', async () => {
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { resolveHandbookSources, ADR_DIRS } = await import('../scripts/handbook/sources.mjs');
  const root = mkdtempSync(join(tmpdir(), 'hb-adr-'));
  mkdirSync(join(root, 'docs/adr'), { recursive: true });
  const dt = { tracker: 'none', wiki: 'none' };
  const r = resolveHandbookSources(root, { handbook: null, dt });
  assert.ok(ADR_DIRS.includes('docs/adr'));
  assert.deepEqual(r.decisions.adr, ['docs/adr']);
  assert.ok(r.decisions.dirs.includes('docs/adr') && r.decisions.dirs.includes('docs/decisions'));
  assert.match(r.decisions.cite, /ADR-0001/);
  const r2 = resolveHandbookSources(root, { handbook: { sources: { decisions: { dirs: ['architecture/records'] } } }, dt });
  assert.ok(r2.decisions.dirs.includes('architecture/records'));
  const none = resolveHandbookSources(mkdtempSync(join(tmpdir(), 'hb-noadr-')), { handbook: null, dt });
  assert.equal(none.decisions.adr, undefined);
  assert.doesNotMatch(none.decisions.cite, /ADR/);
});
