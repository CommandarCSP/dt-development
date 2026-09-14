import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${path}: frontmatter 블록이 없음`);
  return m[1];
}

test('finding-schema가 gapType 6종·confidence 3종·워커 반환 계약 키를 규정한다', () => {
  const p = join(root, 'skills/dt-audit/references/finding-schema.md');
  assert.ok(existsSync(p), 'finding-schema.md 없음');
  const text = readFileSync(p, 'utf8');
  for (const t of ['missing', 'partial', 'mismatch', 'drift', 'undocumented', 'improvement'])
    assert.ok(text.includes('`' + t + '`'), `gapType ${t} 누락`);
  for (const c of ['confirmed', 'inferred', 'needs-human'])
    assert.ok(text.includes(c), `confidence ${c} 누락`);
  for (const k of ['findings', 'surface', 'traceability', 'checked', 'staleSpecs'])
    assert.ok(text.includes(k), `반환 계약 키 ${k} 누락`);
});

test('report-template·drift-detection references가 존재한다', () => {
  for (const rel of [
    'skills/dt-audit/references/report-template.md',
    'skills/dt-audit/references/drift-detection.md',
  ]) assert.ok(existsSync(join(root, rel)), `${rel} 없음`);
});

test('auditor 에이전트가 존재하고 track 파라미터·읽기 전용을 규정한다', () => {
  const p = join(root, 'agents/auditor.md');
  assert.ok(existsSync(p), 'agents/auditor.md 없음');
  const fm = frontmatter(p);
  assert.match(fm, /^name: auditor$/m);
  assert.match(fm, /^description: .+/m);
  const body = readFileSync(p, 'utf8');
  assert.ok(body.includes('`track`'), 'track 파라미터 규정 누락');
  assert.ok(/수정하지 않는다/.test(body), '읽기 전용(진단만) 규정 누락');
});

test('dt-audit SKILL.md가 존재하고 조율 계약을 규정한다', () => {
  const p = join(root, 'skills/dt-audit/SKILL.md');
  assert.ok(existsSync(p), 'skills/dt-audit/SKILL.md 없음');
  const fm = frontmatter(p);
  assert.match(fm, /^name: dt-audit$/m);
  assert.match(fm, /^description: .+/m);
  const body = readFileSync(p, 'utf8');
  assert.ok(body.includes('auditor'), 'auditor 워커 dispatch 규정 누락');
  assert.ok(body.includes('inline degrade'), '원칙 4 폴백 규정 누락');
  assert.ok(body.includes('docs/audits/'), '산출 위치 규정 누락');
});

test('dt-audit 커맨드가 존재하고 frontmatter를 갖춘다', () => {
  const p = join(root, 'commands/dt-audit.md');
  assert.ok(existsSync(p), 'commands/dt-audit.md 없음');
  const fm = frontmatter(p);
  assert.match(fm, /^description: .+/m);
  assert.match(fm, /^argument-hint: .+/m);
  assert.match(fm, /^allowed-tools: .*\bTask\b.*/m);
});

test('finding-schema가 specDiagnosis 4종과 track spec을 규정한다', () => {
  const text = readFileSync(join(root, 'skills/dt-audit/references/finding-schema.md'), 'utf8');
  for (const d of ['silent', 'ambiguous', 'conflict', 'absent'])
    assert.ok(text.includes('`' + d + '`'), `specDiagnosis ${d} 누락`);
  assert.ok(text.includes('fe|be|ux|spec|cross'), 'track에 spec 누락');
});

test('contract-elements 체크리스트가 존재하고 3트랙 요소를 담는다', () => {
  const p = join(root, 'skills/dt-audit/references/contract-elements.md');
  assert.ok(existsSync(p), 'contract-elements.md 없음');
  const text = readFileSync(p, 'utf8');
  for (const k of ['정렬', '페이지네이션', '빈', '경계값'])
    assert.ok(text.includes(k), `계약 요소 ${k} 누락`);
});

test('consult-loop이 존재하고 협의 카드·결정 어휘·역참조 마커를 규정한다', () => {
  const p = join(root, 'skills/dt-audit/references/consult-loop.md');
  assert.ok(existsSync(p), 'consult-loop.md 없음');
  const text = readFileSync(p, 'utf8');
  for (const k of ['코드 현황', '일반적 처리 관례', 'decided', 'applied', 'deferred'])
    assert.ok(text.includes(k), `협의 규정 ${k} 누락`);
  assert.ok(text.includes('from: audit'), '역참조 마커 규격 누락');
});

test('report-template이 SB 섹션과 decisions·pending·index 템플릿을 담는다', () => {
  const text = readFileSync(join(root, 'skills/dt-audit/references/report-template.md'), 'utf8');
  for (const k of ['스펙 보강 제안', 'decisions.md', 'pending.md', 'index.md'])
    assert.ok(text.includes(k), `템플릿 ${k} 누락`);
});

test('auditor가 계약 요소 스윕과 spec 트랙을 규정한다', () => {
  const text = readFileSync(join(root, 'agents/auditor.md'), 'utf8');
  assert.ok(text.includes('contract-elements.md'), '계약 요소 스윕 참조 누락');
  assert.ok(text.includes('specDiagnosis'), 'specDiagnosis 부여 규정 누락');
  assert.ok(/track.*spec/.test(text), 'spec 트랙 분기 누락');
});

test('SKILL.md가 협의 루프·재발 방지·멀티루트·pending을 규정한다', () => {
  const text = readFileSync(join(root, 'skills/dt-audit/SKILL.md'), 'utf8');
  for (const k of ['협의 루프', '재발 방지', 'pending.md', 'index.md', 'consult-loop.md'])
    assert.ok(text.includes(k), `SKILL 규정 ${k} 누락`);
  assert.ok(text.includes('레포 루트'), '멀티루트 runDir 규정 누락');
});

test('커맨드가 --scope spec과 --consult를 안내한다', () => {
  const fm = frontmatter(join(root, 'commands/dt-audit.md'));
  assert.match(fm, /argument-hint: .*spec/);
  const text = readFileSync(join(root, 'commands/dt-audit.md'), 'utf8');
  assert.ok(text.includes('--consult'), '--consult 인자 누락');
});

test('upward-alignment가 계약 요소 대조 차원을 명시한다', () => {
  const text = readFileSync(join(root, 'docs/refs/upward-alignment.md'), 'utf8');
  assert.ok(text.includes('contract-elements.md'), '대조 차원 참조 누락');
  assert.ok(text.includes('응답 shape'), 'shape 필드 대조 누락');
});
