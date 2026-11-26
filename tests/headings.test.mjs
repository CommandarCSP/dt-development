// 제목·라벨 레지스트리(GEN-15) — 스크립트가 찾는 한글 제목이 템플릿·작성 지침과 같은지, 복사본이 다시 생기지 않는지.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { H, headingsFor, HEADINGS } from '../scripts/lib/headings.mjs';
import { OWNERS } from '../scripts/interactionsSync.mjs';
import { SECTION_OWNERS } from '../scripts/projectContextSync.mjs';
import { REQUIRED_SECTIONS as DECISION_SECTIONS } from '../scripts/decisions.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
/** `## 제목 (보충)` 의 보충을 떼고 비교한다 — scripts/lib/sections.mjs sectionKey 와 같은 규칙. */
const h2 = (text) => new Set([...text.matchAll(/^## (.+?)\s*$/gm)].map((m) => m[1].replace(/\s*\([^)]*\)\s*$/, '').trim()));
const missing = (text, titles) => titles.filter((t) => !h2(text).has(t));

test('레지스트리 — 언어 묶음은 지금 ko 하나, 없는 언어는 ko', () => {
  assert.deepEqual(Object.keys(HEADINGS), ['ko']);
  assert.equal(headingsFor('en'), H);
});

test('FE 스펙 템플릿 제목 = 필수 절', () => {
  for (const [file, key] of [['requirements', 'requirements:frontend'], ['design', 'design:frontend'], ['layout-skeleton', 'layout-skeleton:frontend']]) {
    assert.deepEqual(missing(read(`templates/${file}.md.tmpl`), H.specSections[key]), [], file);
  }
});

test('BE 스펙 템플릿 제목 = 필수 절', () => {
  for (const [file, key] of [['requirements', 'requirements:backend'], ['design', 'design:backend'], ['api-contract', 'api-contract:backend']]) {
    assert.deepEqual(missing(read(`templates-backend/${file}.md.tmpl`), H.specSections[key]), [], file);
  }
});

test('정의서 예시·project-context·결정 템플릿 제목 = 레지스트리', () => {
  assert.deepEqual(missing(read('skills/dt-devspec/examples/sample-definition.md'), Object.values(H.definition.sections)), []);
  const pc = H.projectContext;
  assert.deepEqual(missing(read('templates/project-context.md.tmpl'), [pc.overview, pc.feStack, pc.feLibs, pc.designTokens, pc.constraints, pc.glossary]), []);
  assert.deepEqual(missing(read('templates-backend/project-context.md.tmpl'), [pc.overview, pc.beStack, pc.beLibs, pc.sharedConventions, pc.constraints, pc.glossary]), []);
  assert.deepEqual(missing(read('templates/decision.md.tmpl'), H.decision), []);
});

test('정의서 상태 라벨 — 예시 정의서 IF 표가 레지스트리 라벨을 쓴다', () => {
  const sample = read('skills/dt-devspec/examples/sample-definition.md');
  assert.ok(sample.includes(`| ${H.definition.states.convention} |`));
  for (const s of Object.values(H.definition.states)) assert.ok(read('skills/dt-devspec/SKILL.md').includes(s), `dt-devspec 지침에 ${s}`);
});

test('읽는 쪽은 레지스트리 값을 그대로 쓴다', () => {
  assert.equal(OWNERS, H.interactions);
  assert.equal(DECISION_SECTIONS, H.decision);
  assert.ok(SECTION_OWNERS.frontend.includes(H.projectContext.designTokens));
});

test('복사본 금지 — 레지스트리 밖 스크립트에 제목 목록 문자열이 다시 생기지 않는다', () => {
  const walk = (d) => readdirSync(join(root, d)).flatMap((f) => {
    const p = join(d, f);
    return statSync(join(root, p)).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : [p];
  });
  const files = ['scripts', 'skills', 'hooks'].flatMap(walk).filter((f) => f.endsWith('.mjs') && !f.includes('/tests/') && f !== 'scripts/lib/headings.mjs');
  // 코드로 쓰인 문자열 리터럴만 본다(주석·안내 문구는 괜찮다).
  const LITERALS = [`'${H.interactions.frontend}'`, `'${H.interactions.backend}'`, `'${H.definition.sections.conventions}'`, `'${H.projectContext.designTokens}'`, `'${H.decision[3]}'`];
  const hits = [];
  for (const f of files) {
    const code = read(f).split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    for (const lit of LITERALS) if (code.includes(lit)) hits.push(`${f}: ${lit}`);
  }
  assert.deepEqual(hits, []);
});
