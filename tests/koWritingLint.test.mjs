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

/**
 * C3 개발 용어 풀이 검사는 기계에서 내렸다. 사외 가이드 실측에서 정밀도 25%·재현율 한 자릿수였다 —
 * 경계가 낱말이 아니라 쓰임에 있어 사전으로는 못 가른다. 리뷰어가 본다.
 */
test('C3: 개발 용어 풀이는 기계가 재지 않는다', () => {
  assert.deepEqual(ids('빌드가 끝나면 배포합니다.', { docType: 'guide' }), []);
  assert.deepEqual(ids('캐시를 비웁니다.', { docType: 'guide' }), []);
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

test('handbook: 알고리즘 서술의 판단 동사는 위반이 아니다', () => {
  const r = lintKoWriting('라우터가 경로를 판단한다.', { docType: 'handbook' });
  assert.equal(r.findings.filter((f) => f.rule === 'C1').length, 0);
});

test('handbook: 앱이 사람처럼 구는 문장은 여전히 잡는다', () => {
  const r = lintKoWriting('앱이 사용자의 의도를 이해한다.', { docType: 'handbook' });
  assert.ok(r.findings.some((f) => f.rule === 'C1'));
});

test('handbook: 이모지를 잡는다', () => {
  const r = lintKoWriting('근거는 🟢 코드다.', { docType: 'handbook' });
  assert.ok(r.findings.some((f) => f.id === 'L-D3-emoji'));
});

test('handbook: 지시문을 잡는다', () => {
  const r = lintKoWriting('설정 화면에서 값을 바꾸시기 바랍니다.', { docType: 'handbook' });
  assert.ok(r.findings.some((f) => f.id === 'L-D5-imperative'));
});

test('handbook 밖에서는 D 규칙이 돌지 않는다', () => {
  const r = lintKoWriting('근거는 🟢 코드다. 값을 입력하세요.', { docType: 'guide' });
  assert.equal(r.findings.filter((f) => f.rule === 'D3' || f.rule === 'D5').length, 0);
});

test('handbook: 직역한 학술 용어를 제목에서도 잡는다(D6)', () => {
  const r = lintKoWriting('## 4. 빌딩블록과 계층\n## 7. 횡단 관심사\n## 6. 시나리오별 런타임 뷰\n', { docType: 'handbook' });
  const ids = r.findings.filter((f) => f.id === 'L-D6-jargon').map((f) => f.match);
  assert.deepEqual(ids.sort(), ['런타임 뷰', '빌딩블록', '횡단 관심사']);
});

test('handbook 밖에서는 D6 이 돌지 않는다', () => {
  const r = lintKoWriting('## 횡단 관심사\n', { docType: 'confluence' });
  assert.equal(r.findings.some((f) => f.id === 'L-D6-jargon'), false);
});

test('E1: 셀에 문장이 든 표가 절을 다 먹으면 잡는다', () => {
  const t = '## 7. 공통\n\n| 항목 | 규약 | 구현 |\n|---|---|---|\n| 가 | 예외를 경계 너머로 던지지 않는다 | 저기 |\n| 나 | 거부는 값으로 돌려주고 기록에 남긴다 | 여기 |\n| 다 | 깨진 문서는 격리하고 목록을 비우지 않는다 | 거기 |\n';
  assert.ok(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.id === 'L-E1-table-only'));
});

test('E1: 조회표(셀에 이름·경로·숫자만)는 길어도 잡지 않는다', () => {
  const rows = ['| 경로 | 책임 | 규모 |', '|---|---|---|',
    '| `src/core` | 코어 | 42 |', '| `src/agent` | 에이전트 | 20 |',
    '| `src/vault` | 보관함 | 12 |', '| `electron` | 메인 | 17 |'].join('\n');
  const t = `## 2. 폴더\n\n${rows}\n`;
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.id === 'L-E1-table-only'), false);
});

test('C3-b: 코드에 없는 비유어를 잡는다', () => {
  const f = lintKoWriting('도구 감옥이 가장 무겁다. 문지기가 검사한다.', { docType: 'handbook' }).findings;
  assert.ok(f.some((x) => x.id === 'L-C3b-감옥'));
  assert.ok(f.some((x) => x.id === 'L-C3b-문지기'));
});

test('E1: 문단이 있으면 곁들인 표는 잡지 않는다', () => {
  const t = '## 7. 공통\n\n이 절은 공통 규약을 다룬다. 중요한 것은 자격 증명이 한곳에만 있다는 점이다. 나머지는 표로 모았다.\n\n| 항목 | 경로 |\n|---|---|\n| 가 | a.ts |\n| 나 | b.ts |\n| 다 | c.ts |\n';
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.id === 'L-E1-table-only'), false);
});

test('E6: 도입 문장 없이 표로 시작하면 잡는다', () => {
  const t = '### 7.1 인증\n\n| 항목 | 경로 |\n|---|---|\n| 가 | a.ts |\n';
  assert.ok(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.id === 'L-E6-no-lead'));
});

test('E2: 긴 문장만 이어지면 리듬을 지적한다', () => {
  const long = '이 문장은 스물다섯 글자를 넘기려고 일부러 길게 늘여 쓴 문장이다.';
  assert.ok(lintKoWriting(`## 1. 요약\n\n${(long + ' ').repeat(7)}\n`, { docType: 'handbook' })
    .findings.some((f) => f.id === 'L-E2-rhythm'));
});

test('E5: 불릿이 길게 이어지면 잡는다', () => {
  const t = '## 1. 요약\n\n' + Array.from({ length: 9 }, (_, i) => `- 항목 ${i}`).join('\n') + '\n';
  assert.ok(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.id === 'L-E5-bullet-run'));
});

test('개조식·구조 문서에는 묶음 E 를 적용하지 않는다', () => {
  const t = '## 7. 공통\n\n| 항목 | 규약 | 구현 |\n|---|---|---|\n| 가 | 이러하다 | 저기 |\n| 나 | 저러하다 | 여기 |\n| 다 | 그러하다 | 거기 |\n';
  for (const d of ['spec', 'jira']) {
    assert.equal(lintKoWriting(t, { docType: d }).findings.some((f) => f.rule?.startsWith('E')), false, d);
  }
});

test('D7: 문서를 만든 과정이 새면 잡는다', () => {
  const t = '분석 스크립트는 파일 쓰기를 `file:fs` 로 뭉쳐 판정을 못 냈다. 근거는 structure.json 이다.';
  const ids = lintKoWriting(t, { docType: 'handbook' }).findings.filter((f) => f.id === 'L-D7-process-leak');
  assert.ok(ids.length >= 3, JSON.stringify(ids));
});

test('D7 은 handbook 밖에서 돌지 않는다', () => {
  assert.equal(lintKoWriting('분석 스크립트가 structure.json 을 만든다.', { docType: 'confluence' })
    .findings.some((f) => f.id === 'L-D7-process-leak'), false);
});

test('D8: 근거 없는 수치를 잡는다', () => {
  const t = '컴파일에 59턴이 들었다. 캐시는 30초다.';
  const f = lintKoWriting(t, { docType: 'handbook' }).findings.filter((x) => x.id === 'L-D8-bare-number');
  assert.deepEqual(f.map((x) => x.match).sort(), ['30초', '59턴']);
});

test('D8: 같은 문단에 근거가 있으면 잡지 않는다', () => {
  const t = '캐시는 30초다 (electron/cli-auth.ts:36).';
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((x) => x.id === 'L-D8-bare-number'), false);
});

test('D8: 표·목록 줄의 수치는 보지 않는다', () => {
  const t = '| 항목 | 값 |\n|---|---|\n| 캐시 | 30초 |\n';
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((x) => x.id === 'L-D8-bare-number'), false);
});

test('C3-d: 배포물에 굽는다를 잡는다', () => {
  const f = lintKoWriting('설정은 배포물에 구운 파일에서 읽는다.', { docType: 'handbook' }).findings;
  assert.ok(f.some((x) => x.id === 'L-C3d-bake'));
});

test('C3-d: 맥락이 없으면 잡지 않는다 — 빵을 굽는 이야기', () => {
  const f = lintKoWriting('사용자가 빵을 구워 먹는 장면을 보여 준다.', { docType: 'handbook' }).findings;
  assert.equal(f.some((x) => x.id === 'L-C3d-bake'), false);
});

test('C3-d: 프로세스가 죽는다·요청을 떨어뜨린다·다시 밟는다', () => {
  const t = '연결이 끊기면 프로세스가 죽는다. 큐가 차면 요청을 떨어뜨린다. 같은 함정을 다시 밟는다.';
  const ids = lintKoWriting(t, { docType: 'handbook' }).findings.map((x) => x.id);
  for (const k of ['L-C3d-kill', 'L-C3d-drop', 'L-C3d-hit']) assert.ok(ids.includes(k), k);
});

test('C3-d: 백틱 안과 표 줄은 검사하지 않는다', () => {
  assert.equal(lintKoWriting('`빌드에 굽는다` 라는 함수명이다.', { docType: 'handbook' })
    .findings.some((x) => x.rule === 'C3-d'), false);
  assert.equal(lintKoWriting('| 빌드 | 배포물에 굽는다 |', { docType: 'handbook' })
    .findings.some((x) => x.rule === 'C3-d'), false);
});

test('C3-d: 개조식 문서에는 적용하지 않는다', () => {
  assert.equal(lintKoWriting('설정은 배포물에 구운 파일에서 읽는다.', { docType: 'jira' })
    .findings.some((x) => x.rule === 'C3-d'), false);
});

test('등급: 중 규칙은 두 번까지 봐준다', () => {
  const two = '이것이 규약인 것이다. 저것도 규약인 것이다.';
  assert.equal(lintKoWriting(two, { docType: 'handbook' }).findings.some((f) => f.id === 'L-B3-geotida'), false);
});

test('등급: 중 규칙도 세 번 쌓이면 보고한다', () => {
  const three = '이것이 규약인 것이다. 저것도 규약인 것이다. 그것 역시 규약인 것이다.';
  const f = lintKoWriting(three, { docType: 'handbook' }).findings.filter((x) => x.id === 'L-B3-geotida');
  assert.equal(f.length, 3);
  assert.equal(f[0].severity, 'medium');
});

test('등급: 강 규칙은 한 번이라도 보고한다', () => {
  const f = lintKoWriting('근거는 🟢 코드다.', { docType: 'handbook' }).findings;
  assert.ok(f.some((x) => x.id === 'L-D3-emoji' && x.severity === 'strong'));
});

test('C5: 대체 가능한 외래어를 잡는다', () => {
  const f = lintKoWriting('계측 파사드는 값을 찾는다.', { docType: 'handbook' }).findings;
  assert.ok(f.some((x) => x.id === 'L-C5-파사드' && x.severity === 'strong'));
});

test('C5: 백틱 안은 검사하지 않는다', () => {
  assert.equal(lintKoWriting('`파사드` 패턴을 쓴다.', { docType: 'handbook' })
    .findings.some((x) => x.rule === 'C5'), false);
});

test('C5: 애매한 외래어는 세 번부터 잡는다', () => {
  assert.equal(lintKoWriting('이 케이스는 다르다. 저 케이스도 다르다.', { docType: 'handbook' })
    .findings.some((x) => x.rule === 'C5'), false);
  assert.equal(lintKoWriting('이 케이스. 저 케이스. 그 케이스.', { docType: 'handbook' })
    .findings.filter((x) => x.id === 'L-C5-케이스').length, 3);
});

test('C5: 대체하면 뜻이 달라지는 말은 목록에 없다', () => {
  const f = lintKoWriting('IPC 로 프로세스 사이를 오간다. 캐시와 토큰을 쓴다.', { docType: 'handbook' }).findings;
  assert.equal(f.some((x) => x.rule === 'C5'), false);
});

test('코드 펜스 안은 산문으로 세지 않는다', () => {
  const FENCE = '```';
  const t = `## 4. 구조\n\n이 절은 구조를 다룬다.\n\n${FENCE}mermaid\nsequenceDiagram\n  participant R as 렌더러\n${FENCE}\n`;
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((x) => x.rule === 'C5' || x.rule === 'B3'), false);
});

test('C2-tense: 진행형 남발을 세 번 이상일 때 잡는다', () => {
  const t = '서버가 돌고 있다. 큐가 쌓이고 있다. 작업이 밀리고 있다.';
  assert.ok(lintKoWriting(t, { docType: 'handbook' }).findings.some((x) => x.id === 'L-C2-tense'));
});

test('개조식 문서에는 새 규칙을 적용하지 않는다', () => {
  const t = '이것이 규약인 것이다. 저것도 규약인 것이다. 그것 역시 규약인 것이다.';
  assert.equal(lintKoWriting(t, { docType: 'jira' }).findings.some((x) => x.rule === 'B3'), false);
});

test('C3-d 확장: 여섯 판을 통과했던 여덟 문장을 전부 잡는다', () => {
  const cases = [
    ['어느 어댑터를 타는지는 설정에 달렸다.', 'L-C3d-path'],
    ['변환기에 먹이는 표본이다.', 'L-C3d-feed'],
    ['타입 검사가 터진다.', 'L-C3d-kill'],
    ['다른 대화를 줄 세운다.', 'L-C3d-queue'],
    ['주소를 코드에 굳히면 실패한다.', 'L-C3d-bake'],
    ['판정이 JSX 안으로 새고 있다.', 'L-C3d-emit'],
    ['캐시가 살아 있으면 다시 안 묻는다.', 'L-C3d-ask'],
    ['판정이 실행될 기회를 못 얻었다.', 'L-C3d-chance'],
  ];
  for (const [text, id] of cases) {
    assert.ok(lintKoWriting(text, { docType: 'handbook' }).findings.some((f) => f.id === id), text);
  }
});

test('C3-d 확장: 맥락이 다르면 잡지 않는다', () => {
  for (const t of ['사용자가 빵을 구워 먹는다.', '버스를 타고 간다.', '기차를 타는 사람이 많다.']) {
    assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.some((f) => f.rule === 'C3-d'), false, t);
  }
});

test('AI5: 개수를 먼저 선언하는 틀을 세 번부터 잡는다', () => {
  const t = '하는 일은 세 가지다.\n큰 덩어리는 넷이다.\n신뢰 경계는 두 겹이다.\n';
  assert.equal(lintKoWriting(t, { docType: 'handbook' }).findings.filter((f) => f.id === 'L-AI5-count').length, 3);
});

test('AI8: em-dash 남용을 밀도로 잡는다', () => {
  const many = Array.from({ length: 12 }, (_, i) => `문장 ${i} 은 이렇다 — 저렇다.`).join('\n');
  assert.ok(lintKoWriting(many, { docType: 'handbook' }).findings.some((f) => f.id === 'L-AI8-emdash'));
  const few = Array.from({ length: 12 }, (_, i) => `문장 ${i} 은 이렇다.`).join('\n');
  assert.equal(lintKoWriting(few, { docType: 'handbook' }).findings.some((f) => f.id === 'L-AI8-emdash'), false);
});

test('AI3: 과장 어휘는 한 번이라도 잡는다', () => {
  assert.ok(lintKoWriting('강력한 기능이다.', { docType: 'handbook' })
    .findings.some((f) => f.id === 'L-AI3-hype' && f.severity === 'strong'));
});
