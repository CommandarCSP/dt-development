import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lintKoWriting, maskProtected } from '../scripts/koWritingLint.mjs';

const ids = (text, opts) => lintKoWriting(text, opts).findings.map((f) => f.id);

test('maskProtected: 코드 블록·인라인 코드·URL·HTML 주석을 같은 길이 공백으로 바꾼다', () => {
  const src = '앞 `에 의해` 뒤\n```\n설정에 의해\n```\nhttps://x.y/에의해 끝\n<!-- 에 의해 -->';
  const out = maskProtected(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.ok(!out.includes('에 의해'));
  assert.ok(out.startsWith('앞 '));
  assert.ok(out.endsWith(' 끝\n' + ' '.repeat('<!-- 에 의해 -->'.length)));
});

test('C2: 에 의해 → L-C2-passive, 줄·열 1-based', () => {
  const { findings } = lintKoWriting('첫 줄\n값은 설정에 의해 결정됩니다.');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, 'L-C2-passive');
  assert.equal(findings[0].rule, 'C2');
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].col, 6);
  assert.equal(findings[0].match, '에 의해');
});

test('C2: 을/를 통해·통한 → L-C2-through (판정은 리뷰어 몫 — 자연스러운 문장도 잡힘)', () => {
  assert.deepEqual(ids('설정 화면을 통해 바꿉니다.'), ['L-C2-through']);
  assert.deepEqual(ids('네트워크를 통해 전송합니다.'), ['L-C2-through']);
  assert.deepEqual(ids('검증을 통한 정합성'), ['L-C2-through']);
});

test('C2: 에 있어(서) → L-C2-isseo', () => {
  assert.deepEqual(ids('사용에 있어 주의할 점'), ['L-C2-isseo']);
  assert.deepEqual(ids('취업에 있어서 중요한 것'), ['L-C2-isseo']);
});

test('C2: 이중 피동 → L-C2-double-passive', () => {
  assert.deepEqual(ids('파일이 저장되어집니다.'), ['L-C2-double-passive']);
  assert.deepEqual(ids('효과적으로 보여진다.'), ['L-C2-double-passive']);
  assert.deepEqual(ids('파일이 저장됩니다.'), []);
});

test('C2: 중 하나 → L-C2-one-of', () => {
  assert.deepEqual(ids('가장 중요한 기능 중 하나입니다.'), ['L-C2-one-of']);
});

test('C2: 문장 첫머리 직역 대명사 → L-C2-pronoun (문장 중간은 안 잡음)', () => {
  assert.deepEqual(ids('그것은 다음 질문부터 적용됩니다.'), ['L-C2-pronoun']);
  assert.deepEqual(ids('저장합니다. 이것은 즉시 반영됩니다.'), ['L-C2-pronoun']);
  assert.deepEqual(ids('- 그들은 목록을 봅니다.'), ['L-C2-pronoun']);
  assert.deepEqual(ids('사용자는 그것을 고를 수 있습니다.'), []);
});

test('C2: 무생물 복수 -들 → L-C2-plural (사전 명사만)', () => {
  assert.deepEqual(ids('파일들을 넣으면 정보들이 생깁니다.'), ['L-C2-plural', 'L-C2-plural']);
  assert.deepEqual(ids('사람들이 파일을 넣습니다.'), []);
});

test('C2: 을/를 가지다·가진 → L-C2-have', () => {
  assert.deepEqual(ids('두 가지 방식을 가집니다.'), ['L-C2-have']);
  assert.deepEqual(ids('권한을 가진 사용자'), ['L-C2-have']);
});

test('C2: 로 인해·인한 → L-C2-due-to', () => {
  assert.deepEqual(ids('오류로 인해 멈춥니다.'), ['L-C2-due-to']);
  assert.deepEqual(ids('오류로 인한 중단'), ['L-C2-due-to']);
});

test('보호 구간 안의 패턴은 잡지 않는다', () => {
  assert.deepEqual(ids('`에 의해`는 예시입니다.'), []);
  assert.deepEqual(ids('```\n설정에 의해\n```'), []);
  assert.deepEqual(ids('<!-- 오류로 인해 -->'), []);
});

test('stats: lines·sentences·kept', () => {
  const { stats } = lintKoWriting('첫 문장입니다. 둘째 문장입니다.\n셋째.');
  assert.equal(stats.lines, 2);
  assert.equal(stats.sentences, 3);
  assert.equal(stats.kept, 0);
});

test('C1: 무생물 주어 + 사고·감정·의사소통 동사 → L-C1-anthro', () => {
  assert.deepEqual(ids('작업이 멈춘 것인지 트레이가 알려 줍니다.'), ['L-C1-anthro']);
  assert.deepEqual(ids('앱이 필요한 것을 이미 품고 있습니다.'), ['L-C1-anthro']);
  assert.deepEqual(ids('설정은 마지막 선택을 기억합니다.'), ['L-C1-anthro']);
});

test('C1: 기계 동작 동사·사람 주어는 잡지 않는다 (D2 중간 기준)', () => {
  assert.deepEqual(ids('트레이에 진행 상태가 표시됩니다.'), []);
  assert.deepEqual(ids('앱이 파일을 저장합니다.'), []);
  assert.deepEqual(ids('담당자가 알려 줍니다.'), []);
});

test('C3: 치환표 어휘 → L-C3-*', () => {
  assert.deepEqual(ids('설치 수행 후 재시작이 요구됩니다.'), ['L-C3-suhaeng', 'L-C3-yogu']);
  assert.deepEqual(ids('해당 파일이 존재하면 5분이 소요됩니다.'), ['L-C3-haedang', 'L-C3-jonjae', 'L-C3-soyo']);
  assert.deepEqual(ids('오류가 발생하면 작업이 완료되지 않습니다.'), ['L-C3-balsaeng', 'L-C3-wanryo']);
  assert.deepEqual(ids('해당합니다.'), []);
  assert.deepEqual(ids('작업을 진행했다.'), ['L-C3-jinhaeng']);
  assert.deepEqual(ids('진행 상태를 봅니다.'), []);
  assert.deepEqual(ids('(수행) 후 확인'), ['L-C3-suhaeng']);
});

test('C3 guide: 개발 용어 첫 등장에 풀이가 없으면 L-C3-devterm, 풀이(괄호)가 붙으면 안 잡음', () => {
  assert.deepEqual(ids('빌드가 끝나면 배포합니다.', { docType: 'guide' }), ['L-C3-devterm', 'L-C3-devterm']);
  assert.deepEqual(ids('캐시(임시 저장 공간)를 비웁니다. 캐시가 비면 끝.', { docType: 'guide' }), []);
  assert.deepEqual(ids('빌드가 끝나면 배포합니다.'), []);
});

test('C4: 상투 도입구 → L-C4-opener', () => {
  assert.deepEqual(ids('결론적으로 이 기능은 유용합니다.'), ['L-C4-opener']);
  assert.deepEqual(ids('저장합니다. 주목할 점은 속도입니다.'), ['L-C4-opener']);
});

test('C4: 연속 3문장 문두 접속사 → L-C4-conj (한 번만 보고)', () => {
  const t = '또한 저장합니다. 따라서 빠릅니다. 그리고 안전합니다.';
  assert.deepEqual(ids(t), ['L-C4-conj']);
  assert.deepEqual(ids('또한 저장합니다. 빠릅니다. 그리고 안전합니다.'), []);
});

test('keep 주석: 해당 id 만 kept 로 빠지고 stats.kept 증가', () => {
  const r = lintKoWriting('네트워크를 통해 전송합니다. <!-- ko-lint: keep L-C2-through — 실제 경로 -->');
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.kept, 1);
  const r2 = lintKoWriting('설정에 의해 값을 통해 정합니다. <!-- ko-lint: keep L-C2-passive — x -->');
  assert.deepEqual(r2.findings.map((f) => f.id), ['L-C2-through']);
});

test('keep 주석: 사유에 > 가 있어도 인식한다', () => {
  const r = lintKoWriting('네트워크를 통해 전송합니다. <!-- ko-lint: keep L-C2-through — FE > BE 순서라 실제 경로 -->');
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.kept, 1);
});

test('spec 모드: EARS 키워드·라벨은 마스킹하되 한글 서술은 검사, 요소 목록 줄·주석 줄은 제외', () => {
  const ears = '**WHEN** 저장 클릭 **THE SYSTEM SHALL** 파일들을 갱신에 의해 반영';
  assert.deepEqual(ids(ears, { docType: 'spec' }), ['L-C2-plural', 'L-C2-passive']); // col 순
  assert.deepEqual(ids('**IF** 조회가 실패하면 IF-8 계약대로 파일들을 비운다.', { docType: 'spec' }), ['L-C2-plural']);
  assert.deepEqual(ids('WHEN 클릭 THE SYSTEM SHALL 목록을 갱신한다.', { docType: 'spec' }), []);
  assert.deepEqual(ids('- `post-card` (article) — 파일들에 의해', { docType: 'spec' }), []);
  assert.deepEqual(ids('<!-- from: 파일들에 의해 -->', { docType: 'spec' }), []);
  assert.deepEqual(ids('[ai-confirmed] 파일들을 갱신한다.', { docType: 'spec' }), ['L-C2-plural']);
  assert.deepEqual(ids('페이지 목적: 정보들을 파일들에 의해 본다.', { docType: 'spec' }), ['L-C2-plural', 'L-C2-plural', 'L-C2-passive']);
});

const CLI = new URL('../scripts/koWritingLint.mjs', import.meta.url).pathname;

function runCli(content, args = []) {
  const dir = mkdtempSync(join(tmpdir(), 'kolint-'));
  const f = join(dir, 'in.md');
  writeFileSync(f, content, 'utf8');
  return spawnSync(process.execPath, [CLI, f, ...args], { encoding: 'utf8' });
}

test('CLI: findings 있으면 exit 1 + 표 출력', () => {
  const r = runCli('설정에 의해 정합니다.');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /1:3 \[L-C2-passive\]/); // '설정에 의해' — '에'가 0-based 2 → col 3
  assert.match(r.stdout, /findings 1/);
});

test('CLI: findings 없으면 exit 0', () => {
  const r = runCli('설정이 정합니다.');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /findings 0/);
});

test('CLI: --json 이면 JSON, --docType spec 전달', () => {
  const r = runCli('- `post-card` (article) — 파일들에 의해', ['--json', '--docType', 'spec']);
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.deepEqual(parsed.findings, []);
  assert.equal(parsed.stats.lines, 1);
});

test('CLI: 파일 인자 없으면 exit 2 + usage', () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});

test('CLI: --docType 값이 파일 앞에 와도 파일을 올바로 잡는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kolint-'));
  const f = join(dir, 'in.md');
  writeFileSync(f, '- `post-card` (article) — 파일들에 의해', 'utf8');
  const r = spawnSync(process.execPath, [CLI, '--docType', 'spec', f, '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout).findings, []);
});

test('CLI: 없는 파일은 exit 2 + 한 줄 오류 (findings 의 exit 1 과 구분)', () => {
  const r = spawnSync(process.execPath, [CLI, '/nonexistent/kolint-missing.md'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /파일을 읽지 못했다/);
  assert.ok(!/at .*koWritingLint\.mjs/.test(r.stderr), '스택 트레이스가 아니라 한 줄 오류여야 한다');
});

test('CLI: 모르는 --docType 은 exit 2 + Usage', () => {
  const r = runCli('설정이 정합니다.', ['--docType', 'pdf']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});
