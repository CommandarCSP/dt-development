// UX 소스 어댑터·API 규칙 프리셋(GEN-14) — 설정 검증, Figma 없이 시작하는 절차, 도구 이름은 대응표에만, 사고 이력 문구 없음.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, DEFAULTS } from '../scripts/lib/config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (d) => readdirSync(join(root, d)).flatMap((f) => {
  const p = join(d, f);
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});
const mdFiles = ['skills', 'agents', 'commands', 'docs/refs', 'templates'].flatMap(walk).filter((f) => /\.(md|tmpl)$/.test(f));

test('기본값 — annotationLayout none(opt-in), conventions rest-v1(지금 제안값)', () => {
  assert.deepEqual(DEFAULTS.uxSources, { figma: { annotationLayout: 'none' } });
  assert.deepEqual(DEFAULTS.conventions, { preset: 'rest-v1' });
  const c = validate({ uxSources: { figma: { annotationLayout: 'right-panel' } }, conventions: { preset: 'custom' } }, []);
  assert.equal(c.uxSources.figma.annotationLayout, 'right-panel');
  assert.equal(c.conventions.preset, 'custom');
});

test('틀린 값은 경고하고 기본값', () => {
  const w = [];
  const c = validate({ uxSources: { figma: { annotationLayout: 'left', x: 1 }, notion: {} }, conventions: { preset: 'graphql', y: 1 } }, w);
  assert.equal(c.uxSources.figma.annotationLayout, 'none');
  assert.equal(c.conventions.preset, 'rest-v1');
  for (const k of ['annotationLayout', 'uxSources.figma.x', 'uxSources.notion', 'conventions.preset', 'conventions.y']) assert.ok(w.some((x) => x.includes(k)), k);
  const w2 = [];
  validate({ uxSources: 'figma', conventions: [] }, w2);
  assert.ok(w2.some((x) => x.includes('uxSources: 객체')) && w2.some((x) => x.includes('conventions: 객체')));
});

test('dt-devspec — Figma 없이 기획 문서로 시작하는 절차가 있다', () => {
  const skill = read('skills/dt-devspec/SKILL.md');
  assert.match(skill, /Figma 없이 기획 문서/);
  assert.match(skill, /어느 것이든 하나면 된다/);
  assert.match(skill, /주 소스/);
  assert.doesNotMatch(skill, /이 팀 Figma/, '팀 레이아웃을 전제하지 않는다');
  assert.doesNotMatch(skill, /Figma=UX SOT/);
  const disc = read('skills/dt-devspec/references/source-discovery.md');
  assert.match(disc, /## 1\. 기획 문서[\s\S]*Figma가 없을 때는 이 절차만으로/);
  assert.match(disc, /`uxSources\.figma\.annotationLayout`이 `right-panel`이면/);
  assert.match(disc, /## 3\. `annotationLayout: right-panel`.*\(opt-in\)/);
  assert.match(read('agents/definition-author.md'), /Figma가 없어도 된다/);
});

test('ux-sources — 종류별 읽는 방법, MCP 없을 때 WebFetch → 묻기, 출처 표기', () => {
  const doc = read('docs/refs/ux-sources.md');
  assert.match(doc, /\*\*전제: Figma는 없을 수 있다\.\*\*/);
  for (const k of ['Notion', 'Confluence', 'pdf', 'markdown', 'figma']) assert.ok(doc.includes(k), k);
  assert.match(doc, /\| `web` · Notion \|.*`notion\.fetch` \| `WebFetch`/);
  assert.match(doc, /\| `web` · Confluence \|.*`confluence\.get`.*\| `WebFetch`/);
  for (const p of ['mcp__plugin_figma_figma__', 'mcp__claude_ai_Figma__', 'mcp__figma__', 'mcp__claude_ai_Notion__', 'mcp__notion__']) assert.ok(doc.includes(p), p);
  assert.match(doc, /## 5\. 출처 표기[\s\S]*PDF \| `파일명\.pdf p\.12`/);
  assert.match(read('skills/dt-spec-generate-spec/references/source-intake.md'), /ux-sources\.md/);
});

test('Figma·Notion 도구 전체 이름은 대응표(ux-sources.md)와 명령 allowed-tools 에만', () => {
  const RE = /mcp__[A-Za-z_]*(?:[Ff]igma|[Nn]otion)[A-Za-z_]*__[\w-]+|\bnotion-fetch\b/g;
  const problems = [];
  for (const f of mdFiles) {
    if (f === 'docs/refs/ux-sources.md') continue;
    let text = read(f);
    if (f.startsWith('commands/')) text = text.replace(/^allowed-tools:.*$/m, '');
    for (const m of text.matchAll(RE)) problems.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(problems, []);
  for (const c of ['commands/dt-spec.md', 'commands/dt-devspec.md']) {
    const fm = read(c).match(/^allowed-tools:.*$/m)[0];
    for (const t of ['mcp__claude_ai_Notion__notion-fetch', 'mcp__notion__notion-fetch', 'WebFetch']) assert.ok(fm.includes(t), `${c}: ${t}`);
  }
});

test('API 규칙 — rest-v1 은 지금 제안값, custom 은 빈칸, dt-devspec §3 이 프리셋을 따른다', () => {
  const doc = read('docs/refs/api-conventions.md');
  assert.match(doc, /## `rest-v1` \(기본\)[\s\S]*`\/api\/v1`[\s\S]*복수형[\s\S]*케밥케이스[\s\S]*`POST \/\{resource\}\/\{action\}`/);
  assert.match(doc, /## `custom`[\s\S]*경로 규칙 없음/);
  const skill = read('skills/dt-devspec/SKILL.md');
  assert.match(skill, /\*\*URL 규칙 질문은 `conventions\.preset`을 따른다\*\*/);
  assert.doesNotMatch(skill, /\*\*URL 네이밍 컨벤션\*\*\(prefix·복수형 리소스/, '모양을 보편 규칙으로 적지 않는다');
});

test('사고 이력 문구 — 특정 사건·실제 노드 id·감사 회차 표시가 본문에 없다', () => {
  const BAD = [/Back Office가 Front Service/, /409:28220/, /SCR_FLE_/, /파일럿 실측/, /from: audit 20\d\d-\d\d-\d\d-\w+ [A-Z]+-?\d/, /도그푸딩 실측 결함/];
  const problems = [];
  for (const f of mdFiles) {
    const text = read(f).replace(/`<!-- from: audit <run-slug>[^`]*`|\(예: `<!-- from: audit [^`]*`\)/g, '');
    for (const re of BAD) if (re.test(text)) problems.push(`${f}: ${re}`);
  }
  assert.deepEqual(problems, []);
});
