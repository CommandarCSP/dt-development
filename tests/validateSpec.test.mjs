// 스펙·계획 형식 검사기 — 템플릿대로 쓴 문서는 통과하고, 깨진 문서는 오류로 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSpec, detectKind, parseFRs } from '../scripts/validateSpec.mjs';

const tmpl = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const HEAD = { PLUGIN_VERSION: '1.0.0', GENERATED_AT: '2026-11-13T00:00:00Z', STATUS: 'finalized', SOURCES: 'doc@spec:docs/a.md' };
const fill = (t, v) => t.replace(/\{\{([A-Z_]+)[^}]*\}\}/g, (_, k) => v[k] ?? HEAD[k] ?? `(${k.toLowerCase()} 채움)`);
const FR_FE = '### FR-1: 로그인 제출  `[ai-confirmed] [Event-driven]`\nWHEN 사용자가 로그인 버튼을 누르면 THE SYSTEM SHALL 자격 증명을 보낸다.\n\n### FR-2: 실패 안내  `[user-added] [Unwanted]`\nIF 자격 증명이 틀리면 THEN THE SYSTEM SHALL 오류를 보인다.\n';
const FR_BE = '### FR-1: 주문 생성  `[ai-confirmed] [Event-driven(request)]`\nWHEN POST /orders 요청이 오면 THE SYSTEM SHALL 주문을 만든다.\n';
const errs = (r) => r.errors.map((e) => e.rule);

test('detectKind: 경로로 종류와 스택을 가린다', () => {
  assert.deepEqual(detectKind('docs/specs/pages/login/requirements.md'), { kind: 'requirements', stack: 'frontend' });
  assert.deepEqual(detectKind('docs/specs/resources/orders/api-contract.md'), { kind: 'api-contract', stack: 'backend' });
  assert.deepEqual(detectKind('docs/specs/resources/orders/plan.md'), { kind: 'plan', stack: 'backend' });
  assert.equal(detectKind('docs/specs/pages/login/login.e2e-scenarios.md').kind, 'e2e-ledger');
  assert.equal(detectKind('docs/specs/interactions.md').kind, 'interactions');
  assert.equal(detectKind('README.md'), null);
});

test('템플릿대로 채운 FE·BE 스펙은 오류 0', () => {
  const cases = [
    ['templates/requirements.md.tmpl', 'requirements', 'frontend', { FUNCTIONAL_REQUIREMENTS: FR_FE }],
    ['templates/design.md.tmpl', 'design', 'frontend', {}],
    ['templates/tasks.md.tmpl', 'tasks', 'frontend', { TASKS: '- [ ] FR-1 로그인이 된다' }],
    ['templates/layout-skeleton.md.tmpl', 'layout-skeleton', 'frontend', {}],
    ['templates-backend/requirements.md.tmpl', 'requirements', 'backend', { FUNCTIONAL_REQUIREMENTS: FR_BE }],
    ['templates-backend/design.md.tmpl', 'design', 'backend', {}],
    ['templates-backend/api-contract.md.tmpl', 'api-contract', 'backend', { ENDPOINT_TABLE: '| POST | /orders | Bearer | CreateOrderDto | OrderDto | 201, 400, 409 |' }],
  ];
  for (const [p, kind, stack, v] of cases) {
    const r = validateSpec(fill(tmpl(p), v), { kind, stack, siblings: { requirements: fill(tmpl('templates/requirements.md.tmpl'), { FUNCTIONAL_REQUIREMENTS: FR_FE }) } });
    assert.deepEqual(r.errors, [], `${p}: ${JSON.stringify(r.errors)}`);
    assert.equal(r.strict, true);
  }
});

test('requirements: FR 제목 형식·번호 중복·라벨·EARS 키워드를 잡는다', () => {
  const bad = '### FR-1 제목만\n\n### FR-2: 중복 원본  `[ai-confirmed] [Ubiquitous]`\nTHE SYSTEM SHALL 보인다.\n\n### FR-2: 중복  `[ai-confirmed] [Ubiquitous]`\nTHE SYSTEM SHALL 보인다.\n\n### FR-3: 라벨 없음  `[Event-driven] [State-driven]`\nWHILE 로딩 중이면 THE SYSTEM SHALL 스피너.\n\n### FR-4: 키워드 틀림  `[user-added] [Event-driven]`\nTHE SYSTEM SHALL 이동한다.\n';
  const r = validateSpec(fill(tmpl('templates/requirements.md.tmpl'), { FUNCTIONAL_REQUIREMENTS: bad }), { kind: 'requirements', stack: 'frontend' });
  for (const rule of ['fr-heading', 'fr-duplicate', 'fr-source-label', 'fr-pattern-label', 'ears-keyword']) assert.ok(errs(r).includes(rule), rule);
});

test('필수 절 누락·채우지 않은 자리표는 오류', () => {
  const headerOnly = tmpl('templates/design.md.tmpl').replace(/\{\{(PLUGIN_VERSION|GENERATED_AT|STATUS|SOURCES)\}\}/g, (_, k) => HEAD[k]);
  const r = validateSpec(headerOnly.replace(/## 시퀀스[\s\S]*?(?=## 요구사항)/, ''), { kind: 'design', stack: 'frontend' });
  assert.ok(errs(r).includes('required-section'));
  assert.ok(errs(r).includes('placeholder'));
});

test('design·tasks: requirements 에 없는 FR 참조는 오류', () => {
  const req = fill(tmpl('templates/requirements.md.tmpl'), { FUNCTIONAL_REQUIREMENTS: FR_FE });
  const r = validateSpec(fill(tmpl('templates/tasks.md.tmpl'), { TASKS: '- [ ] FR-9 없는 요구사항\n- [] FR-1 문법 틀림' }), { kind: 'tasks', stack: 'frontend', siblings: { requirements: req } });
  assert.ok(errs(r).includes('fr-ref'));
  assert.ok(errs(r).includes('checkbox'));
});

test('api-contract: 열 누락·Method·Path·Status 값을 잡는다', () => {
  const t = fill(tmpl('templates-backend/api-contract.md.tmpl'), { ENDPOINT_TABLE: '| FETCH | orders | - | - | - | ok |' });
  const rules = errs(validateSpec(t, { kind: 'api-contract', stack: 'backend' }));
  for (const rule of ['endpoint-method', 'endpoint-path', 'endpoint-status']) assert.ok(rules.includes(rule), rule);
  const noCol = t.replace('| Response DTO ', '');
  assert.ok(errs(validateSpec(noCol, { kind: 'api-contract', stack: 'backend' })).includes('endpoint-columns'));
});

test('plan: Phase·체크박스·자리표를 본다', () => {
  const good = '# plan: feed (frontend)\n## Phase 1 — contract\n- [ ] src/types/feed.ts: `export interface Feed { id: string }`\n- [x] gate: tsc → 커밋\n';
  assert.deepEqual(validateSpec(good, { kind: 'plan' }).errors, []);
  const bad = '# plan\n- [ ] src/x.ts: TODO 나중에\n- [ ] 훅 ... 구현\n';
  const rules = errs(validateSpec(bad, { kind: 'plan' }));
  assert.ok(rules.includes('plan-phase') && rules.includes('plan-placeholder'));
});

test('interactions: 소유 밖 ## 절은 오류(migrate 안내)', () => {
  assert.ok(errs(validateSpec('# Interactions\n\n## 네비게이션 그래프\n- a\n', { kind: 'interactions' })).includes('interactions-sections'));
  assert.deepEqual(validateSpec('# Interactions\n\n## FE 크로스페이지\n\n### 네비게이션\n- a\n', { kind: 'interactions' }).errors, []);
});

test('e2e 원장: basedOnSpec 마커와 상태 값', () => {
  const ok = '<!-- basedOnSpec: requirements.md @ 2026-11-13 (abc1234) content:deadbeef -->\n| id | title | status |\n|---|---|---|\n| S-1 | 로그인 | approved |\n';
  assert.deepEqual(validateSpec(ok, { kind: 'e2e-ledger' }).errors, []);
  const bad = '| id | status |\n|---|---|\n| S-1 | done |\n';
  const rules = errs(validateSpec(bad, { kind: 'e2e-ledger' }));
  assert.ok(rules.includes('ledger-marker') && rules.includes('ledger-status'));
});

test('옛 형식(머리 주석 없음·specVersion 1.0) 스펙은 오류를 경고로 낮춘다', () => {
  const noHeader = '# Requirements: x\n\n## 기능 요구사항\n### FR-1 제목만\n';
  const r = validateSpec(noHeader, { kind: 'requirements', stack: 'frontend' });
  assert.equal(r.strict, false);
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => w.rule === 'fr-heading'));
});

test('CLI: 오류가 있으면 exit 1, 같은 폴더의 requirements.md 로 FR 참조를 확인한다', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-vs-'));
  try {
    const dir = join(root, 'docs/specs/pages/login');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'requirements.md'), fill(tmpl('templates/requirements.md.tmpl'), { FUNCTIONAL_REQUIREMENTS: FR_FE }));
    writeFileSync(join(dir, 'tasks.md'), fill(tmpl('templates/tasks.md.tmpl'), { TASKS: '- [ ] FR-7 없음' }));
    const script = fileURLToPath(new URL('../scripts/validateSpec.mjs', import.meta.url));
    execFileSync('node', [script, join(dir, 'requirements.md')]);
    assert.throws(() => execFileSync('node', [script, join(dir, 'tasks.md')]));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('parseFRs: 다음 절 제목에서 FR 본문이 끝난다', () => {
  const { frs } = parseFRs('### FR-1: a  `[ai-confirmed] [Ubiquitous]`\nTHE SYSTEM SHALL x.\n\n## 라우팅\nWHEN y\n');
  assert.equal(frs.length, 1);
  assert.ok(!frs[0].body.includes('WHEN'));
});
