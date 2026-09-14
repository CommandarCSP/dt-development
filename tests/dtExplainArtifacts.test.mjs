import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// dtAuditArtifacts.test.mjs의 헬퍼와 동일 — import하면 그 파일의 테스트까지 함께 실행되므로 자체 정의
function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${path}: frontmatter 블록이 없음`);
  return m[1];
}

test('answer-frame이 풀 모드 6절·근거 라벨 2종·철칙·퀵 모드 조건을 규정한다', () => {
  const p = join(root, 'skills/dt-explain/references/answer-frame.md');
  assert.ok(existsSync(p), 'answer-frame.md 없음');
  const text = readFileSync(p, 'utf8');
  for (const h of ['무엇이 문제인가', '왜 생겼나', '쉽게 말하면', '해결 방법', '더 나은 제안', '한 줄 요약'])
    assert.ok(text.includes(h), `풀 모드 절 "${h}" 누락`);
  for (const label of ['🟢 확인됨', '🟡 추정'])
    assert.ok(text.includes(label), `근거 라벨 ${label} 누락`);
  assert.ok(text.includes('원인 절 없이 해결책 절을 쓰지 않는다'), '철칙 1 누락');
  assert.ok(text.includes('확정 어투'), '철칙 2 누락');
  assert.ok(text.includes('퀵 모드'), '퀵 모드 규정 누락');
  assert.ok(text.includes('실사례'), '프로젝트 실사례 우선 규칙 누락');
  assert.ok(text.includes('1:1'), '비유 1:1 대응 규칙 누락');
  assert.ok(text.includes('역방향'), '역방향 검증 누락');
});

test('dt-explain SKILL.md가 존재하고 자동 발동·조사 절차·게이트를 규정한다', () => {
  const p = join(root, 'skills/dt-explain/SKILL.md');
  assert.ok(existsSync(p), 'skills/dt-explain/SKILL.md 없음');
  const fm = frontmatter(p);
  assert.match(fm, /^name: dt-explain$/m);
  assert.match(fm, /^description: .+/m);
  const body = readFileSync(p, 'utf8');
  assert.ok(body.includes('references/answer-frame.md'), 'answer-frame 참조 누락');
  assert.ok(body.includes('readable-writing.md'), '쉬운 언어 SOT 참조 누락');
  assert.ok(body.includes('직접 열어'), '근거 확보(코드 직접 확인) 규정 누락');
  assert.ok(body.includes('Explore'), 'Explore 1회 허용 규정 누락');
  assert.ok(body.includes('확인하면 확정할 수 있는 것'), '접근 불가 시 확인 목록 규정 누락');
  assert.ok(/외부 쓰기|쓰지 않는다/.test(body), 'v1 비범위(외부 쓰기 금지) 누락');
});

test('dt-explain 커맨드가 존재하고 frontmatter·--quick 인자를 갖춘다', () => {
  const p = join(root, 'commands/dt-explain.md');
  assert.ok(existsSync(p), 'commands/dt-explain.md 없음');
  const fm = frontmatter(p);
  assert.match(fm, /^description: .+/m);
  assert.match(fm, /^argument-hint: .+/m);
  const body = readFileSync(p, 'utf8');
  assert.ok(body.includes('--quick'), '--quick 인자 설명 누락');
  assert.ok(body.includes('dt-explain'), '스킬 트리거 언급 누락');
});

test('readable-writing.md 소비처에 dt-explain이 등록됐다', () => {
  const text = readFileSync(join(root, 'docs/refs/readable-writing.md'), 'utf8');
  assert.ok(text.includes('dt-explain'), '소비처 등록 누락');
});
