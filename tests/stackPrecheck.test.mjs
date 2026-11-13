// 스택 사전 점검 — 영역별 판정, 정해진 영역(PD topic)은 묻지 않음.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { precheck, precheckProject, AREAS } from '../scripts/stackPrecheck.mjs';

const status = (r) => Object.fromEntries(r.areas.map((a) => [a.key.split('.').pop(), a.status]));

test('기본 스택이면 물을 영역이 없다', () => {
  const pkg = { dependencies: { react: '19', '@tanstack/react-query': '5', zustand: '5', 'react-router': '7' }, devDependencies: { tailwindcss: '4', vitest: '3', msw: '2', '@playwright/test': '1' } };
  const r = precheck(pkg, 'frontend');
  assert.ok(r.areas.every((a) => a.status === 'same'));
  assert.deepEqual(r.questions, []);
});

test('대안이 있으면 adaptable, 아무것도 없으면 absent(묻지 않음)', () => {
  const r = precheck({ dependencies: { react: '19', swr: '2', sass: '1' }, devDependencies: { jest: '29' } }, 'frontend');
  const s = status(r);
  assert.equal(s.serverState, 'adaptable');
  assert.equal(s.styling, 'adaptable');
  assert.equal(s.unitTest, 'adaptable');
  assert.equal(s.clientState, 'absent');
  assert.deepEqual(r.questions.map((q) => q.key), ['stack.fe.serverState', 'stack.fe.styling', 'stack.fe.unitTest']);
  assert.equal(r.blocking, false);
});

test('규칙이 전제하는 기술(BE ORM·프레임워크)이 다르면 blocking', () => {
  const r = precheck({ dependencies: { '@nestjs/core': '11', typeorm: '0.3' }, devDependencies: { jest: '29' } }, 'backend');
  assert.equal(status(r).orm, 'blocking');
  assert.equal(r.blocking, true);
  assert.equal(status(precheck({ dependencies: { vue: '3' } }, 'frontend')).framework, 'blocking');
});

test('채택된 PD 의 topic 이 영역 key 와 같으면 그 영역은 묻지 않는다', () => {
  const r = precheck({ dependencies: { react: '19', swr: '2' } }, 'frontend', [{ id: 'PD-004', topic: 'stack.fe.serverState' }]);
  const sv = r.areas.find((a) => a.key === 'stack.fe.serverState');
  assert.equal(sv.decidedBy, 'PD-004');
  assert.ok(!r.questions.some((q) => q.key === 'stack.fe.serverState'));
});

test('precheckProject: 프로젝트의 package.json 과 docs/decisions 를 읽는다 (proposed 는 무시)', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-pre-'));
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19', swr: '2', 'styled-components': '6' } }));
    mkdirSync(join(root, 'docs/decisions'), { recursive: true });
    const pd = (id, status, topic) => `---\nid: ${id}\ntitle: t\nstatus: ${status}\nscope: s\ntopic: ${topic}\ndate: 2026-11-13\n---\n## 맥락\n## 결정\n## 이유\n## 버린 대안\n## 출처\n`;
    writeFileSync(join(root, 'docs/decisions/PD-001-swr.md'), pd('PD-001', 'accepted', 'stack.fe.serverState'));
    writeFileSync(join(root, 'docs/decisions/PD-002-sc.md'), pd('PD-002', 'proposed', 'stack.fe.styling'));
    const r = precheckProject(root, 'frontend');
    assert.deepEqual(r.questions.map((q) => q.key), ['stack.fe.styling']);
    const script = fileURLToPath(new URL('../scripts/stackPrecheck.mjs', import.meta.url));
    const out = JSON.parse(execFileSync('node', [script, root, '--stack', 'frontend', '--json'], { encoding: 'utf8' }));
    assert.equal(out.areas.find((a) => a.key === 'stack.fe.serverState').decidedBy, 'PD-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('package.json 이 없으면 모든 영역 absent — 던지지 않는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-pre-'));
  try {
    const r = precheckProject(root, 'backend');
    assert.ok(r.areas.every((a) => a.status === 'absent'));
    assert.equal(r.areas.length, AREAS.backend.length);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
