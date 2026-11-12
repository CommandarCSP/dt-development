import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, scanRepo, loadRuleFile, BUILTIN_RULES, BUILTIN_ALLOW } from '../scripts/scanForbidden.mjs';

// 픽스처는 실행 시 조립한다 — 리터럴로 두면 이 파일이 저장소 검사에 걸린다.
const AT = '@';
const REAL_MAIL = ['someone', 'corp-mail.io'].join(AT);
const ME_MAIL = ['me', 'corp-mail.io'].join(AT);
const REAL_UUID = ['2a1b3c4d', '1111', '2222', '3333', '444455556666'].join('-');

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

test('내장 규칙: 실제 이메일·cloudId 는 잡고 자리표는 통과시킨다', () => {
  const text = [
    `owner: ${REAL_MAIL}`,
    `cloudId: ${REAL_UUID}`,
    'demo: jane.doe@example.com · git.example.com',
    'sign: noreply@anthropic.com',
    'zero: 00000000-0000-0000-0000-000000000000',
    'pkg: pnpm@10.0.0',
  ].join('\n');
  const f = scanText(text);
  assert.deepEqual(f.map((x) => [x.line, x.rule]), [[1, '이메일'], [2, 'cloudId 형태 UUID']]);
});

test('규칙 파일: 조직 목록을 더하고 allow 로 예외를 둔다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-rules-'));
  const file = join(dir, 'rules.json');
  writeFileSync(file, JSON.stringify({
    rules: [{ name: '사내 도메인', pattern: 'acme-corp', flags: 'gi' }, { name: '사내 티켓 키', pattern: '\\bACM-\\d+' }],
    allow: [{ pattern: '^ACM-0$' }],
  }));
  const { rules, allow } = loadRuleFile(file);
  const f = scanText('see ACME-CORP wiki\nACM-12 and ACM-0', [...BUILTIN_RULES, ...rules], [...BUILTIN_ALLOW, ...allow]);
  assert.deepEqual(f.map((x) => [x.line, x.rule, x.match]), [[1, '사내 도메인', 'ACME-CORP'], [2, '사내 티켓 키', 'ACM-12']]);
});

test('규칙 파일이 없으면 빈 목록', () => {
  assert.deepEqual(loadRuleFile(undefined), { rules: [], allow: [] });
});

test('scanRepo: git 이 아닌 폴더는 전부 걷고 바이너리는 건너뛴다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scan-repo-'));
  writeFileSync(join(dir, 'a.md'), `contact ${ME_MAIL}\n`);
  writeFileSync(join(dir, 'b.png'), `fake ${ME_MAIL}`);
  const f = scanRepo(dir);
  assert.deepEqual(f.map((x) => `${x.file}:${x.line}`), ['a.md:1']);
});

// 저장소 자체가 깨끗한지 — 공개 전에 늘 돈다. 조직 목록은 DT_FORBIDDEN_RULES 로 받는다(저장소 밖).
test('저장소: 올라갈 파일에 금칙어가 없다', () => {
  const f = scanRepo(REPO_ROOT, { ruleFile: process.env.DT_FORBIDDEN_RULES || undefined });
  assert.deepEqual(f.map((x) => `${x.file}:${x.line} [${x.rule}] ${x.match}`), []);
});
