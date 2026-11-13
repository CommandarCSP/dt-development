// interactions.md 절 소유 — FE·BE 가 어느 순서로 써도 상대 절이 남는다(GEN-38).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeInteractions, migrateLegacy, detectLegacy, PREAMBLE } from '../scripts/interactionsSync.mjs';
import { parseSections } from '../scripts/lib/sections.mjs';

const FE = (x = '피드→상세') => `## FE 크로스페이지\n\n### 네비게이션 그래프\n- ${x}\n\n### 액션 → 리액션\n- 수정 → 피드 무효화\n`;
const BE = (x = '주문+재고 한 트랜잭션') => `## BE 크로스리소스\n\n### 트랜잭션 경계\n- ${x}\n`;
const keys = (md) => parseSections(md).sections.map((s) => s.key);

test('BE → FE, FE → BE 어느 순서여도 양쪽 절이 남고 순서는 FE·BE', () => {
  for (const [a, b] of [['backend', 'frontend'], ['frontend', 'backend']]) {
    let md = mergeInteractions('', a, a === 'frontend' ? FE() : BE()).md;
    md = mergeInteractions(md, b, b === 'frontend' ? FE() : BE()).md;
    assert.ok(md.startsWith(PREAMBLE));
    assert.deepEqual(keys(md), ['FE 크로스페이지', 'BE 크로스리소스']);
    assert.ok(md.includes('피드→상세') && md.includes('주문+재고 한 트랜잭션'));
  }
});

test('다시 쓰면 자기 절만 바뀐다', () => {
  let md = mergeInteractions(mergeInteractions('', 'frontend', FE()).md, 'backend', BE()).md;
  md = mergeInteractions(md, 'frontend', FE('홈→검색')).md;
  assert.ok(md.includes('홈→검색') && !md.includes('피드→상세'));
  assert.ok(md.includes('주문+재고 한 트랜잭션'));
});

test('자기 절이 아닌 내용은 거절한다', () => {
  assert.throws(() => mergeInteractions('', 'frontend', BE()));
});

test('옛 형식(소유 밖 ## 절): merge 는 거절, migrate 는 FE 절 아래로 한 단계 내려 모은다', () => {
  const old = `# Interactions\n\n## 네비게이션 그래프\n- 피드→상세\n### 세부\n- x\n\n## 공유 상태\n- 현재 유저\n\n${BE()}`;
  assert.equal(detectLegacy(old), true);
  assert.deepEqual(mergeInteractions(old, 'frontend', FE()), { ok: false, reason: 'legacy' });
  const { md, moved } = migrateLegacy(old);
  assert.equal(moved, 2);
  assert.equal(detectLegacy(md), false);
  assert.deepEqual(keys(md), ['FE 크로스페이지', 'BE 크로스리소스']);
  assert.ok(md.includes('### 네비게이션 그래프') && md.includes('#### 세부') && md.includes('### 공유 상태'));
  assert.ok(md.includes('주문+재고 한 트랜잭션'));
});
