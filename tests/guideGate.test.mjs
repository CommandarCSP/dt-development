import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGuideSource, extractChangelogItems, checkGuide, checkShotText, checkKoReview, koReviewHash, DEFAULT_FORBIDDEN_MARKERS, TICKET_KEY_ALLOW } from '../scripts/guide/gate.mjs';

const GUIDE = `---
version: 0.3.3
manualShotsReviewedAt: 0.3.3
covers:
  - item: S1
    section: 기본 사용 흐름
  - item: SCR-workbench
    shot: shots/SCR-workbench.png
  - item: SCR-login
    shot: none
  - item: SCR-admin
    guide: n/a
    why: 관리자 전용
changelogCovers: [작업 트레이 개선]
---
# Acme Notes
본문.
`;
const ITEMS = [
  { id: 'S1', kind: 'scenario', title: '문서 넣고 질문하기' },
  { id: 'SCR-workbench', kind: 'screen', title: '작업 화면', captureMode: 'auto' },
  { id: 'SCR-login', kind: 'screen', title: '로그인', captureMode: 'none' },
];
const base = (over = {}) => {
  const parsed = parseGuideSource(GUIDE);
  return checkGuide({ meta: parsed.meta, body: parsed.body, appVersion: '0.3.3', inventoryItems: ITEMS, changelogItems: [{ title: '작업 트레이 개선', category: '변경' }], shotExists: () => true, ...over });
};
const gates = (r) => (r.ok ? [] : r.findings.map((f) => f.gate));

test('parseGuideSource: ok / version 형식 / covers 배열 필수', () => {
  const p = parseGuideSource(GUIDE);
  assert.equal(p.kind, 'ok');
  assert.equal(p.meta.covers.length, 4);
  assert.deepEqual(p.meta.changelogCovers, ['작업 트레이 개선']);
  assert.match(parseGuideSource(GUIDE.replace('version: 0.3.3', 'version: v3')).reason, /x\.y\.z/);
  assert.match(parseGuideSource('# no fm').reason, /front matter/);
});

test('extractChangelogItems: 해당 버전 섹션의 "- **제목**" 만', () => {
  const md = `# CHANGELOG\n## [0.3.3] — 2026-09-01\n### 변경\n- **작업 트레이 개선** — 설명\n  - 중첩은 무시\n- 굵지 않은 항목은 무시\n## [0.3.2]\n- **옛 항목**`;
  assert.deepEqual(extractChangelogItems(md, '0.3.3'), [{ title: '작업 트레이 개선', category: '변경' }]);
  assert.deepEqual(extractChangelogItems(md, '9.9.9'), []);
});

test('전부 통과', () => { assert.deepEqual(base(), { ok: true }); });

test('G1: 버전 불일치', () => { assert.deepEqual(gates(base({ appVersion: '0.4.0' })), ['G1']); });

test('G2: 인벤토리 항목 누락 / covers 에 인벤토리에 없는 id / n/a 인데 why 없음', () => {
  assert.deepEqual(gates(base({ inventoryItems: [...ITEMS, { id: 'SCR-new', kind: 'screen', title: '새 화면', captureMode: 'auto' }] })), ['G2']);
  const p = parseGuideSource(GUIDE.replace('  - item: SCR-admin\n    guide: n/a\n    why: 관리자 전용\n', '  - item: SCR-admin\n    guide: n/a\n'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, changelogItems: [], shotExists: () => true });
  assert.ok(r.findings.some((f) => f.gate === 'G2' && /why/.test(f.message)));
  // SCR-admin 은 인벤토리(publish true 목록)에 없다 — n/a 로 넘긴 항목은 "인벤토리에 없는 id" 로 잡지 않는다(publish false 였을 수 있음)
  assert.equal(base().ok, true);
});

test('G2 changelog: CHANGELOG 항목이 있는데 changelogCovers 에 없으면 실패, changelogItems 를 안 넘기면 검사 안 함', () => {
  assert.deepEqual(gates(base({ changelogItems: [{ title: '작업 트레이 개선', category: '변경' }, { title: '새 기능', category: '추가' }] })), ['G2']);
  assert.deepEqual(base({ changelogItems: undefined }), { ok: true });
});

test('G3: auto|manual 화면은 shot 파일 실존, none 은 면제', () => {
  assert.deepEqual(gates(base({ shotExists: (p) => p !== 'shots/SCR-workbench.png' })), ['G3']);
  const p = parseGuideSource(GUIDE.replace('    shot: shots/SCR-workbench.png\n', ''));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true });
  assert.deepEqual(gates(r), ['G3']);
  assert.match(r.findings[0].message, /SCR-workbench/);
});

test('G4: MINOR 이 올랐는데 manualShotsReviewedAt 이 옛 값', () => {
  const p = parseGuideSource(GUIDE.replace('version: 0.3.3', 'version: 0.4.0'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.4.0', inventoryItems: ITEMS, shotExists: () => true });
  assert.deepEqual(gates(r), ['G4']);
  const patch = parseGuideSource(GUIDE.replace('version: 0.3.3', 'version: 0.3.9'));
  assert.deepEqual(gates(checkGuide({ meta: patch.meta, body: patch.body, appVersion: '0.3.9', inventoryItems: ITEMS, shotExists: () => true })), []);
});

test('G5: 기본 금칙어·티켓 키 패턴·추가 금칙어, 행 번호 표기', () => {
  const p = parseGuideSource(GUIDE.replace('본문.', '본문. 경로 /Users/me 와 PROJ-43 참고 https://git.example.com'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true, forbiddenMarkers: [...DEFAULT_FORBIDDEN_MARKERS, 'git.example.com'] });
  const g5 = r.findings.filter((f) => f.gate === 'G5');
  assert.equal(g5.length, 3);
  assert.ok(g5.every((f) => /2행/.test(f.message)));
});

test('G5: 표준 약어(UTF-8·ISO-8601 …)는 티켓 키로 보지 않는다', () => {
  const p = parseGuideSource(GUIDE.replace('본문.', '본문. UTF-8 인코딩과 ISO-8601 날짜, RFC-2119 를 쓴다.'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true });
  assert.deepEqual(r, { ok: true });
  assert.ok(TICKET_KEY_ALLOW.has('UTF') && TICKET_KEY_ALLOW.has('ISO'));
  const q = parseGuideSource(GUIDE.replace('본문.', '본문. PROJ-43 참고.'));
  assert.deepEqual(gates(checkGuide({ meta: q.meta, body: q.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true })), ['G5']);
});

test('G5: 한 줄에 티켓 키가 여럿이면 전부 보고한다', () => {
  const p = parseGuideSource(GUIDE.replace('본문.', '본문. PROJ-43 과 TASK-338 과 UTF-8.'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true });
  const g5 = r.findings.filter((f) => f.gate === 'G5');
  assert.equal(g5.length, 2);
  assert.ok(g5.some((f) => /PROJ-43/.test(f.message)) && g5.some((f) => /TASK-338/.test(f.message)));
});

test('G2: covers 에 같은 id 가 두 번이면 중복으로 한 건', () => {
  const p = parseGuideSource(GUIDE.replace('  - item: S1\n    section: 기본 사용 흐름\n', '  - item: S1\n    section: 기본 사용 흐름\n  - item: S1\n    section: 또 한 번\n'));
  const r = checkGuide({ meta: p.meta, body: p.body, appVersion: '0.3.3', inventoryItems: ITEMS, shotExists: () => true });
  const dup = r.findings.filter((f) => /중복/.test(f.message));
  assert.equal(dup.length, 1);
  assert.match(dup[0].message, /covers 에 "S1" 가 중복이다/);
  assert.equal(dup[0].gate, 'G2');
});

// ── G7 한글 리뷰 영수증 ────────────────────────────────────────────────
// 리뷰를 돌리든 말든 결과가 같으면 그 단계는 빠진다. 흔적을 남기고 게이트가 본다.

test('G7 — 리뷰 기록이 없으면 막는다 (안 돌려도 티가 안 나면 안 돌린다)', () => {
  const f = checkKoReview({ review: undefined, body: '본문' });
  assert.equal(f.length, 1);
  assert.equal(f[0].gate, 'G7');
  assert.match(f[0].message, /한글 리뷰/);
});

test('G7 — 리뷰 뒤에 본문을 고쳤으면 막는다 (그 리뷰는 지금 글을 안 봤다)', () => {
  const review = { verdict: 'OK', at: '2026-09-14T00:00:00Z', bodyHash: koReviewHash('예전 본문') };
  const f = checkKoReview({ review, body: '고친 본문' });
  assert.equal(f.length, 1);
  assert.match(f[0].message, /바뀌었다/);
});

test('G7 — 지금 본문을 본 리뷰면 통과한다', () => {
  const body = '지금 본문';
  assert.deepEqual(checkKoReview({ review: { verdict: 'OK', at: 'x', bodyHash: koReviewHash(body) }, body }), []);
});

test('G7 — 기록이 깨졌으면(해시 없음) 막는다', () => {
  const f = checkKoReview({ review: { verdict: 'OK' }, body: '본문' });
  assert.equal(f.length, 1);
});

// ── G6 그림 속 글자 ────────────────────────────────────────────────────
// 스크린샷은 DOM 을 그린 것이라, 찍는 순간의 innerText 가 곧 그림에 보이는
// 글자다. OCR 없이 그 텍스트를 검사한다.

test('G6 — 그림 속 이메일을 잡는다(내장 패턴, 프로젝트가 안 적어도)', () => {
  const f = checkShotText({ id: 'SCR-settings', text: '연결됨  someone@example.com · ACME · team' });
  assert.equal(f.length, 1);
  assert.equal(f[0].gate, 'G6');
  assert.match(f[0].message, /SCR-settings/);
  assert.match(f[0].message, /someone@example\.com/);
});

test('G6 — 사용자 홈 경로를 잡는다(맥·윈도우 둘 다)', () => {
  assert.equal(checkShotText({ id: 'A', text: '/Users/me/Desktop/x' }).length, 1);
  assert.equal(checkShotText({ id: 'B', text: 'C:\\Users\\chae\\Desktop' }).length, 1);
});

test('G6 — API 키 모양을 잡는다', () => {
  assert.equal(checkShotText({ id: 'A', text: 'sk-ant-api03-abcdefghijklmnop' }).length, 1);
  assert.equal(checkShotText({ id: 'B', text: 'ghp_abcdefghijklmnopqrstuvwxyz0123' }).length, 1);
});

test('G6 — forbiddenMarkers 를 그림에도 적용한다(G5 는 글만 본다)', () => {
  const f = checkShotText({ id: 'A', text: '기록 서버 langfuse.example.com 으로 전송', forbiddenMarkers: ['langfuse.example.com'] });
  assert.equal(f.length, 1);
  assert.match(f[0].message, /langfuse\.example\.com/);
});

test('G6 — allowInShots 에 적은 값은 통과한다(적어서 통과하는 것과 그냥 통과는 다르다)', () => {
  assert.deepEqual(checkShotText({ id: 'A', text: 'demo@example.com', allowInShots: ['demo@example.com'] }), []);
});

test('G6 — 깨끗한 화면은 아무것도 내지 않는다', () => {
  assert.deepEqual(checkShotText({ id: 'A', text: '프로젝트 정보\n이름 * 사내 지식 정리\n저장' }), []);
});

test('G6 — 같은 값이 여러 번 보여도 한 번만 보고한다(같은 지적을 도배하지 않는다)', () => {
  assert.equal(checkShotText({ id: 'A', text: 'a@b.com 그리고 또 a@b.com' }).length, 1);
});

test('G6 — 조사가 받침을 따른다 ("이메일가 보인다" 가 사용자에게 나가면 안 된다)', () => {
  assert.match(checkShotText({ id: 'A', text: 'a@b.com' })[0].message, /이메일이 보인다/);
  assert.match(checkShotText({ id: 'A', text: '/Users/me' })[0].message, /사용자 홈 경로가 보인다/);
});
