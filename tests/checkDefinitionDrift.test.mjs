// 정의서 정합 게이트(구조) — 확정 전 api-contract·스펙이 정의서 IF 와 어긋난 채 남지 않게.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDrift, parseDefinitionIFs } from '../scripts/checkDefinitionDrift.mjs';

const DEF = '## 인터페이스 합의\n| IF-1 | 주문 생성 `POST /api/v1/orders` | 확정 |\n| IF-2 | 주문 조회 `GET /api/v1/orders/:id` | 컨벤션 |\n';
const contract = (rows) => `## 엔드포인트\n\n| Method | Path | Auth | Request DTO | Response DTO | Status |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;

test('parseDefinitionIFs: IF 행에서 메서드·경로를 읽고 :id 를 {id} 로 맞춘다', () => {
  const ifs = parseDefinitionIFs(DEF);
  assert.deepEqual([ifs.get('IF-1').method, ifs.get('IF-1').path], ['POST', '/api/v1/orders']);
  assert.equal(ifs.get('IF-2').path, '/api/v1/orders/{id}');
});

test('정의서와 같은 계약은 드리프트 0', () => {
  const md = contract(['| POST | /api/v1/orders | Bearer | A | B | 201 | <!-- from: IF-1 -->', '| GET | /api/v1/orders/{id} | Bearer | - | B | 200, 404 | <!-- from: IF-2 -->']);
  assert.deepEqual(checkDrift(DEF, md, { kind: 'api-contract' }).drift, []);
});

test('메서드·경로가 다르거나, IF 를 안 가리키거나, 없는 IF 를 가리키면 드리프트', () => {
  const md = contract([
    '| PUT | /api/v1/orders | Bearer | A | B | 200 | <!-- from: IF-1 -->',
    '| GET | /api/v1/order/{id} | Bearer | - | B | 200 | <!-- from: IF-2 -->',
    '| DELETE | /api/v1/orders/{id} | Bearer | - | - | 204 |',
    '| GET | /api/v1/stats | Bearer | - | B | 200 | <!-- from: IF-9 -->',
  ]);
  const kinds = checkDrift(DEF, md, { kind: 'api-contract' }).drift.map((d) => d.kind).sort();
  assert.deepEqual(kinds, ['method', 'missing-if', 'new-endpoint', 'path']);
});

test('명시적으로 큐잉(conflict)하거나 미해소로 건너뛴(skipped) IF 는 세지 않는다', () => {
  const md = '<!-- conflict: IF-1 -->\n<!-- skipped: IF-9 (미해소) -->\n' + contract(['| PUT | /api/v1/orders | Bearer | A | B | 200 | <!-- from: IF-1 -->', '| GET | /x | - | - | - | 200 | <!-- from: IF-9 -->']);
  assert.deepEqual(checkDrift(DEF, md, { kind: 'api-contract' }).drift, []);
});

test('스펙 공통: basedOnDefinition 머리의 IF 목록도 정의서에 있어야 한다', () => {
  const spec = '<!-- basedOnDefinition: ../../definition.md@v3 | IF-1,IF-7 -->\n# Requirements\n';
  assert.deepEqual(checkDrift(DEF, spec).drift.map((d) => d.id), ['IF-7']);
});
