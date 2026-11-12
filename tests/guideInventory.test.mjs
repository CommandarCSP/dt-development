import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontMatter } from '../scripts/guide/frontMatter.mjs';
import { parseInventory, publishedItems } from '../scripts/guide/inventory.mjs';

const SAMPLE = `---
version: 0.3.3
type: electron
product: Acme Notes
stack:
  router: none
  auth: [claude-code-oauth]
  captureDriver: playwright-electron
scenarios:
  - id: S1
    title: 문서 넣고 질문하기
    steps: [SCR-workbench, SCR-chat]
    source: [doc:README.md#사용법, user-confirmed]
screens:
  - id: SCR-workbench
    title: 작업 화면
    purpose: "왼쪽은 문서와 위키, 오른쪽은 대화창"
    route: "/"
    capture: { mode: auto, needs: [project-created], selector: main }
    publish: true
    source: [code:renderer/src/pages/Workbench.tsx:12]
  - id: SCR-login
    title: Claude 계정 로그인
    route: external
    capture: { mode: none, reason: 서드파티 OAuth }
    publish: true
    source: [user-confirmed]
  - id: SCR-admin
    title: 관리자 도구
    route: "/admin"
    capture: { mode: auto }
    publish: false
    source: [code:src/Admin.tsx:1]
---
# 사람용 본문
`;

const WITH_CHAT = SAMPLE.replace('screens:\n', 'screens:\n  - id: SCR-chat\n    title: 대화창\n    route: "/"\n    capture: { mode: auto }\n    publish: true\n    source: [code:x.tsx:1]\n');

test('splitFrontMatter: 스칼라·인라인 배열/맵·블록 배열/맵을 객체로', () => {
  const { data, body } = splitFrontMatter(SAMPLE);
  assert.equal(data.version, '0.3.3');
  assert.equal(data.stack.router, 'none');
  assert.deepEqual(data.stack.auth, ['claude-code-oauth']);
  assert.equal(data.screens.length, 3);
  assert.deepEqual(data.screens[0].capture, { mode: 'auto', needs: ['project-created'], selector: 'main' });
  assert.equal(data.screens[0].publish, true);
  assert.equal(data.screens[2].publish, false);
  assert.equal(data.screens[0].purpose, '왼쪽은 문서와 위키, 오른쪽은 대화창');
  assert.equal(body.trim(), '# 사람용 본문');
});

test('splitFrontMatter: front matter 없으면 null', () => {
  assert.equal(splitFrontMatter('# 그냥 문서'), null);
});

test('parseInventory: ok — 필수 필드와 id 규칙', () => {
  const r = parseInventory(WITH_CHAT);
  assert.equal(r.kind, 'ok');
  assert.equal(r.inventory.product, 'Acme Notes');
  assert.equal(r.inventory.screens[2].capture.mode, 'none');
});

test('parseInventory: failed — id 형식·mode 값·none 인데 reason 없음·steps 가 모르는 화면', () => {
  assert.match(parseInventory(SAMPLE.replace('id: SCR-workbench', 'id: workbench')).reason, /SCR-/);
  assert.match(parseInventory(SAMPLE.replace('mode: auto, needs', 'mode: later, needs')).reason, /mode/);
  assert.match(parseInventory(SAMPLE.replace('{ mode: none, reason: 서드파티 OAuth }', '{ mode: none }')).reason, /reason/);
  assert.match(parseInventory(SAMPLE.replace('steps: [SCR-workbench, SCR-chat]', 'steps: [SCR-nope]')).reason, /SCR-nope/);
  assert.match(parseInventory('no front matter').reason, /front matter/);
});

test('parseInventory: steps 가 인벤토리에 있는 화면만 가리키면 ok (SCR-chat 은 없어도 경고 아님 — 시나리오가 화면을 앞서 정의할 수 있음)', () => {
  // SAMPLE 은 SCR-chat 화면이 없다 → steps 검사는 "screens 에 없는 id" 를 잡는다.
  // 그러므로 SAMPLE 자체는 SCR-chat 때문에 failed 여야 한다 — 이 테스트는 SCR-chat 을 추가하면 ok 가 됨을 본다.
  const withChat = WITH_CHAT;
  assert.equal(parseInventory(withChat).kind, 'ok');
  assert.equal(parseInventory(SAMPLE).kind, 'failed');
});

test('publishedItems: publish true 만, 시나리오 먼저, 화면은 captureMode 포함', () => {
  const items = publishedItems(parseInventory(WITH_CHAT).inventory);
  assert.deepEqual(items.map((i) => i.id), ['S1', 'SCR-chat', 'SCR-workbench', 'SCR-login']);
  assert.equal(items.find((i) => i.id === 'SCR-login').captureMode, 'none');
  assert.equal(items[0].kind, 'scenario');
});

test('splitFrontMatter: 블록 키 아래 인라인 []·{} 한 줄은 그 자체가 값이다', () => {
  const { data } = splitFrontMatter('---\nscenarios:\n  []\nprep:\n  {}\ntags:\n  [a, b]\n---\n본문\n');
  assert.deepEqual(data.scenarios, []);
  assert.deepEqual(data.prep, {});
  assert.deepEqual(data.tags, ['a', 'b']);
});

test('parseInventory: 시나리오도 source 라벨이 하나 이상 필요하고 publish 는 참/거짓이다', () => {
  const noSource = parseInventory(WITH_CHAT.replace('    source: [doc:README.md#사용법, user-confirmed]\n', ''));
  assert.equal(noSource.kind, 'failed');
  assert.match(noSource.reason, /S1.*source/);
  const badPublish = parseInventory(WITH_CHAT.replace('    steps: [SCR-workbench, SCR-chat]', '    steps: [SCR-workbench, SCR-chat]\n    publish: maybe'));
  assert.equal(badPublish.kind, 'failed');
  assert.match(badPublish.reason, /S1.*publish/);
});
