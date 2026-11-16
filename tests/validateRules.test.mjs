import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRule, validateAll, engineDetectionTypes, SCHEMA } from '../scripts/validateRules.mjs';

const OK = { ruleId: 'no-x', summary: 'x 금지', severity: 'important', appliesTo: ['src/**/*.ts'], detection: [{ type: 'forbidden-pattern', pattern: 'x[(]' }] };

test('플러그인의 모든 리뷰 규칙이 머리말 스키마를 통과한다', () => {
  const bad = validateAll().filter((r) => r.errors.length || r.warnings.length).map((r) => `${r.file}: ${[...r.errors, ...r.warnings].join(' / ')}`);
  assert.deepEqual(bad, []);
});

test('스키마의 detection type 목록 = 엔진 검출기 파일 + manual', () => {
  assert.deepEqual([...SCHEMA.properties.detection.items.properties.type.enum].sort(), engineDetectionTypes());
});

test('validateRule: 통과 예와 막는 예', () => {
  assert.deepEqual(validateRule(OK, { file: 'patterns/no-x.md' }), { errors: [], warnings: [] });
  const e = (d, ctx) => validateRule(d, ctx).errors.join(' | ');
  assert.match(e({ ...OK, detection: [{ type: 'forbidden-pattern', description: '설명만' }] }), /pattern 가 없다/, '필수 인자 없는 검출 = 검사하는 척');
  assert.match(e({ ...OK, detection: [{ type: 'magic' }] }), /모르는 type/);
  assert.match(e({ ...OK, detection: [] }), /manual/);
  assert.match(e({ ...OK, severity: 'high' }), /severity/);
  assert.match(e(OK, { file: 'patterns/other.md' }), /파일 이름/);
  assert.match(e({ ...OK, relatedRules: ['ghost'] }, { ruleIds: new Set(['no-x']) }), /ghost/);
  assert.match(e({ ...OK, overridable: true }), /overrideKey/);
  assert.match(e({ ...OK, detection: [{ type: 'forbidden-pattern', pattern: '(' }] }), /정규식 오류/);
  assert.match(validateRule({ ...OK, colour: 'red' }).warnings.join(), /모르는 키/);
  assert.equal(validateRule({ ...OK, severity: 'suggestion' }).errors.length, 0, 'suggestion 은 minor 별칭');
});

test('스킬의 규칙 목록(- **ruleId** _(severity)_ — summary)이 규칙 머리말과 같다', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, basename } = await import('node:path');
  const { PLUGIN_ROOT } = await import('../scripts/validateRules.mjs');
  const rules = new Map(validateAll().map((r) => [r.file, r]));
  const { parseFrontmatter } = await import('../scripts/review/lib/frontmatter.mjs');
  const problems = [];
  for (const skill of ['dt-frontend-architecture', 'dt-backend-architecture', 'dt-frontend-testing', 'dt-backend-testing']) {
    const text = readFileSync(join(PLUGIN_ROOT, `skills/${skill}/SKILL.md`), 'utf8');
    const listed = new Map([...text.matchAll(/^- \*\*([a-z0-9-]+)\*\* _\(([a-z]+)\)_ — (.+?) \[상세\]\(([^)]+)\)$/gm)].map((m) => [m[1], { severity: m[2], summary: m[3], link: m[4] }]));
    const own = [...rules.keys()].filter((f) => f.startsWith(`skills/${skill}/patterns/`));
    for (const f of own) {
      const fm = parseFrontmatter(readFileSync(join(PLUGIN_ROOT, f), 'utf8')).data;
      const l = listed.get(fm.ruleId);
      if (!l) { problems.push(`${skill}: ${fm.ruleId} 가 규칙 목록에 없다`); continue; }
      if (l.severity !== fm.severity) problems.push(`${skill}: ${fm.ruleId} severity ${l.severity} ≠ 머리말 ${fm.severity}`);
      if (l.summary !== fm.summary) problems.push(`${skill}: ${fm.ruleId} summary 가 머리말과 다르다`);
      if (basename(l.link) !== basename(f)) problems.push(`${skill}: ${fm.ruleId} 상세 링크 ${l.link}`);
    }
    const ownIds = new Set(own.map((f) => basename(f, '.md')));
    for (const id of listed.keys()) if (!ownIds.has(id) && !/vendored/.test(listed.get(id).link)) problems.push(`${skill}: 목록의 ${id} 에 해당하는 규칙 파일이 없다`);
  }
  assert.deepEqual(problems, []);
});
