import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const FILES = [
  'skills/dt-handbook/SKILL.md',
  'skills/dt-handbook/references/chapter-recipes.md',
  'skills/dt-handbook/references/figure-examples.md',
  'commands/dt-handbook.md',
  'agents/handbook-analyst.md',
  'agents/handbook-tracer.md',
  'agents/handbook-author.md',
];

test('스킬·명령·워커·참조 파일이 있다', () => {
  for (const p of FILES) assert.ok(existsSync(join(ROOT, p)), `${p} 가 없다`);
});

test('SKILL.md front matter 에 name·description 이 있다', () => {
  const fm = /^---\n([\s\S]*?)\n---/.exec(read('skills/dt-handbook/SKILL.md'));
  assert.ok(fm, 'front matter 가 없다');
  assert.match(fm[1], /^name: dt-handbook$/m);
  assert.match(fm[1], /^description: .{40,}/m);
});

test('워커는 사용자 호출 불가로 표시된다', () => {
  for (const a of ['handbook-analyst', 'handbook-tracer', 'handbook-author']) {
    assert.match(read(`agents/${a}.md`), /사용자 호출 불가/, `${a} 에 표시가 없다`);
  }
});

test('워커는 직접 묻지 않고 needsDecision 으로 올린다', () => {
  for (const a of ['handbook-analyst', 'handbook-tracer']) {
    assert.match(read(`agents/${a}.md`), /needsDecision/);
    assert.match(read(`agents/${a}.md`), /직접 묻지 않는다/);
  }
});

/**
 * 스킬은 어떤 프로젝트에도 들어간다 — 특정 제품 이름이 본문에 박히면 안 된다.
 * 금칙 이름을 이 파일에 적지 않는다: 그 자체가 유출이고, 실제로 이 테스트가
 * 공개 전 스캐너에 걸린 적이 있다. 검사할 이름은 환경변수로 넘긴다.
 *   DT_FORBIDDEN_NAMES="제품A,제품B" npm test
 * 안 넘기면 건너뛴다 — 전수 검사는 공개 전 스캐너(tools/scan-public-export.mjs)가 한다.
 */
test('특정 프로젝트 이름이 새 파일에 새지 않는다', (t) => {
  const names = (process.env.DT_FORBIDDEN_NAMES ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (names.length === 0) { t.skip('DT_FORBIDDEN_NAMES 미지정 — 공개 전 스캐너가 전수 검사한다'); return; }
  for (const p of FILES) {
    for (const name of names) {
      assert.doesNotMatch(read(p), new RegExp(name, 'i'), `${p} 에 ${name} 가 있다`);
    }
  }
});

test('견본에 완성 SVG 세 장과 도형 키트 클래스가 있다', () => {
  const f = read('skills/dt-handbook/references/figure-examples.md');
  assert.ok((f.match(/<svg/g) ?? []).length >= 3, 'SVG 가 3장 미만이다');
  assert.match(f, /hb-box/);
  assert.match(f, /figcaption/);
  // 규칙 설명문에도 <script> 라는 낱말이 나온다 — SVG 블록 안만 본다.
  for (const svg of f.match(/<svg[\s\S]*?<\/svg>/g) ?? []) {
    assert.doesNotMatch(svg, /<script|<foreignObject|<style/);
  }
});

test('장 규격에 8장이 다 있다', () => {
  const r = read('skills/dt-handbook/references/chapter-recipes.md');
  for (let n = 1; n <= 8; n++) assert.match(r, new RegExp(`^##\\s*${n}\\.`, 'm'), `${n}장 규격이 없다`);
});

test('스킬 본문이 실제 스크립트 경로를 가리킨다', () => {
  const s = read('skills/dt-handbook/SKILL.md');
  for (const rel of ['scripts/handbook/build.mjs']) {
    assert.ok(s.includes(rel), `${rel} 를 안내하지 않는다`);
    assert.ok(existsSync(join(ROOT, rel)), `${rel} 가 실재하지 않는다`);
  }
});

test('산출 문서에 이모지를 쓰지 말라고 못 박는다', () => {
  assert.match(read('agents/handbook-author.md'), /이모지를 쓰지 않는다/);
});

/**
 * 뼈대 자체도 한글 규칙을 탄다. 본문만 검사하던 판에서 arc42 목차를 그대로 옮긴
 * 「빌딩블록과 계층」·「횡단 관심사」가 통째로 빠져나갔다 — 제목은 본문보다 눈에 덜 띈다.
 */
test('문서 뼈대(템플릿·장 규격 제목)가 handbook 문체 규칙을 통과한다', async () => {
  const { lintKoWriting } = await import('../scripts/koWritingLint.mjs');

  const tmpl = read('templates/handbook.md.tmpl');
  const tmplFindings = lintKoWriting(tmpl, { docType: 'handbook' }).findings;
  assert.deepEqual(tmplFindings, [], `템플릿 위반: ${JSON.stringify(tmplFindings)}`);

  const headings = read('skills/dt-handbook/references/chapter-recipes.md')
    .split('\n').filter((l) => /^##\s/.test(l)).join('\n');
  const headingFindings = lintKoWriting(headings, { docType: 'handbook' }).findings;
  assert.deepEqual(headingFindings, [], `장 제목 위반: ${JSON.stringify(headingFindings)}`);
});

test('장 규격의 제목과 템플릿의 제목이 글자까지 같다', () => {
  const of = (text) => text.split('\n').filter((l) => /^##\s+\d\.\s/.test(l)).map((l) => l.replace(/^##\s+/, '').trim());
  assert.deepEqual(of(read('templates/handbook.md.tmpl')), of(read('skills/dt-handbook/references/chapter-recipes.md')));
});
