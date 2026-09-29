import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(root, 'skills/dt-worklog-sync/SKILL.md');
const RULES = join(root, 'skills/dt-worklog-sync/references/release-matching.md');

test('release-matching이 부모+하위 통일을 대상으로 규정한다', () => {
  assert.ok(existsSync(RULES), 'release-matching.md 없음');
  const text = readFileSync(RULES, 'utf8');

  assert.ok(text.includes('부모 값으로 통일'), '부모 값 통일 규정 누락');
  for (const type of ['스토리', '작업', '버그', '하위 작업'])
    assert.ok(text.includes(type), `대상 이슈 타입 "${type}" 누락`);
  // 옛 규정(Sub-task 한정·부모 미개입)이 남아 있으면 안 된다
  assert.ok(
    !/부모 Story\/Task엔 이 스킬이 손대지 않는다/.test(text),
    '옛 규정(부모 미개입)이 남아 있음',
  );
  assert.ok(!text.includes('fixVersionsTarget'), '폐기된 설정 키가 남아 있음');
});

test('release-matching이 결정 순서 세 단계를 규정한다', () => {
  const text = readFileSync(RULES, 'utf8');

  assert.ok(text.includes('부모에 릴리즈가 있'), '① 부모 상속 단계 누락');
  assert.ok(text.includes('질문 없이') || text.includes('묻지 않는다'), '① 무질문 규정 누락');
  assert.ok(text.includes('번호'), '② 번호 목록 제시 규정 누락');
  assert.ok(text.includes('archived'), 'archived 제외 규정 누락');
  assert.ok(text.includes('미출시'), '미출시 우선 규정 누락');
});

test('release-matching이 의미 매칭 자동 확정을 금지한다', () => {
  const text = readFileSync(RULES, 'utf8');

  assert.ok(/자동 확정하지 않는다|자동 확정 금지/.test(text), '자동 확정 금지 규정 누락');
  assert.ok(text.includes('추천'), '추천 표시 규정 누락');
  // 폐기된 "의미 매칭 우선" 규정이 남아 있으면 안 된다
  assert.ok(!/의미\(semantic\) 매칭 우선/.test(text), '폐기된 의미 매칭 우선 규정이 남아 있음');
});

test('release-matching이 릴리즈 부재 시 초안 추천 + 사람 생성을 규정한다', () => {
  const text = readFileSync(RULES, 'utf8');

  assert.ok(
    /버전 생성 도구가 없|버전(릴리즈)? 생성 도구는 없/.test(text),
    'MCP 버전 생성 불가 사실 누락',
  );
  assert.ok(text.includes('초안'), '릴리즈 초안 추천 규정 누락');
  assert.ok(text.includes('release-page') || text.includes('릴리즈 화면'), 'Jira 릴리즈 화면 안내 누락');
  // 조용한 스킵은 폐기됐다
  assert.ok(!/조용히 스킵/.test(text), '폐기된 조용한 스킵 규정이 남아 있음');
  assert.ok(text.includes('릴리즈 없이 진행'), '명시적 "릴리즈 없이 진행" 선택지 누락');
});

test('release-matching이 버그의 계층 제약을 규정한다', () => {
  const text = readFileSync(RULES, 'utf8');

  assert.ok(/같은 계층|계층이 같/.test(text), '버그·작업 동일 계층 사실 누락');
  assert.ok(
    /자식이 될 수 없|하위로 (넣을|옮길) 수 없/.test(text),
    '버그를 작업 하위로 못 넣는다는 규정 누락',
  );
  assert.ok(text.includes('버그 하위 작업'), '버그 하위 작업 타입 언급 누락');
});

test('release-matching이 제목에 버전을 적지 않게 규정한다', () => {
  const text = readFileSync(RULES, 'utf8');

  assert.ok(text.includes('제목'), '제목 규정 누락');
  assert.ok(
    /제목에 (버전|릴리즈).{0,20}(적지|쓰지|넣지) ?않는다/.test(text),
    '제목에 버전 금지 규정 누락',
  );
  assert.ok(text.includes('수정 버전'), '수정 버전 필드가 그 자리라는 근거 누락');
});

test('SKILL.md 3.5절이 새 규칙을 반영한다', () => {
  const text = readFileSync(SKILL, 'utf8');
  const start = text.indexOf('### 3.5');
  assert.ok(start > 0, '3.5절 없음');
  const section = text.slice(start, text.indexOf('### 4.', start));

  assert.ok(section.includes('부모'), '부모 대상 규정 누락');
  assert.ok(section.includes('상속'), '부모 상속 규정 누락');
  assert.ok(section.includes('references/release-matching.md'), 'SOT 링크 누락');
  assert.ok(!section.includes('fixVersionsTarget'), '폐기된 설정 키가 남아 있음');
  assert.ok(!/의미 매칭 우선/.test(section), '폐기된 의미 매칭 규정이 남아 있음');
});

test('SKILL.md 실행 절이 부모·하위 양쪽 기재를 규정한다', () => {
  const text = readFileSync(SKILL, 'utf8');
  const apply = text.slice(text.indexOf('### 5. 실행'));

  assert.ok(apply.includes('fixVersions'), 'fixVersions 기재 규정 누락');
  assert.ok(/id.{0,10}우선/.test(apply), 'id 우선 규정 누락');
  assert.ok(apply.includes('부모'), '부모 기재 규정 누락');
  assert.ok(!apply.includes('fixVersionsTarget'), '폐기된 설정 키가 남아 있음');
});

test('설정 예시에서 폐기된 fixVersionsTarget 키가 빠졌다', () => {
  const p = join(root, 'skills/dt-worklog-sync/references/dt-worklog.example.json');
  const raw = readFileSync(p, 'utf8');
  assert.ok(!raw.includes('fixVersionsTarget'), '폐기된 설정 키가 남아 있음');
  JSON.parse(raw); // 유효한 JSON이어야 한다
});
