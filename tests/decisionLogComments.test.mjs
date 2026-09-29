import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 다른 artifacts 테스트와 동일 — import하면 그 파일의 테스트까지 함께 실행되므로 자체 정의
function frontmatter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${path}: frontmatter 블록이 없음`);
  return m[1];
}

test('결정 로그 ref 문서가 형식 4규칙·적용 범위·수명 판단을 규정한다', () => {
  const p = join(root, 'docs/refs/decision-log-comments.md');
  assert.ok(existsSync(p), 'docs/refs/decision-log-comments.md 없음');
  const text = readFileSync(p, 'utf8');

  // 형식 4규칙
  assert.ok(text.includes('첫 줄은 현재 규칙'), '규칙 1(첫 줄 = 현재 규칙) 누락');
  assert.ok(text.includes('갱신'), '규칙 1(첫 줄 갱신 의무) 누락');
  assert.ok(text.includes('시간순'), '규칙 2(시간순) 누락');
  assert.ok(text.includes('- YYYY-MM · 출처:'), '규칙 2(항목 표기 형식) 누락');
  assert.ok(text.includes('이유 없는 항목은 위반'), '규칙 3(이유 필수) 누락');
  assert.ok(text.includes('상한 없음'), '규칙 4(개수 상한 없음) 누락');
  assert.ok(text.includes('애매하면 남긴다'), '죽은 항목 판단 기준 누락');

  // 적용 범위 — 경로가 정확히 박혀 있어야 룰과 어긋나지 않음
  assert.ok(text.includes('src/**/*.service.ts'), 'BE 허용 경로 누락');
  assert.ok(text.includes('src/business/hooks/**'), 'FE 허용 경로 누락');

  // 예시 두 벌
  assert.ok(/✅|정상/.test(text), '정상 예시 라벨 누락');
  assert.ok(/❌|위반/.test(text), '위반 예시 라벨 누락');

  // 기존 금지의 취지 유지
  assert.ok(text.includes('보강'), '출처는 이유를 보강할 때만 허용 규정 누락');
});

test('FE architecture 주석 규칙이 결정 로그를 허용하고 태스크 참조 금지에 예외를 단다', () => {
  const p = join(root, 'skills/dt-frontend-architecture/SKILL.md');
  const text = readFileSync(p, 'utf8');
  const section = text.slice(text.indexOf('## 주석 규칙'));

  assert.ok(section.includes('결정 로그'), '결정 로그 갈래 누락');
  assert.ok(
    section.includes('docs/refs/decision-log-comments.md'),
    'ref 문서 링크 누락',
  );
  assert.ok(section.includes('src/business/hooks/**'), 'FE 허용 레이어 경로 누락');
  // 기본 원칙은 유지돼야 한다
  assert.ok(section.includes('기본: 주석 없음'), '기본 원칙이 사라짐');
  assert.ok(section.includes('WHAT은 절대 쓰지 않는다'), 'WHAT 금지 원칙이 사라짐');
  // 태스크 참조 금지 행에 조건부 예외가 달려야 한다
  const taskRefLine = section
    .split('\n')
    .find((l) => l.includes('태스크/PR 참조'));
  assert.ok(taskRefLine, '태스크/PR 참조 금지 행이 사라짐');
  assert.ok(
    /결정 로그/.test(taskRefLine),
    '태스크/PR 참조 금지 행에 결정 로그 예외 단서 누락',
  );
});

test('BE architecture 주석 규칙이 결정 로그 ref를 참조한다', () => {
  const p = join(root, 'skills/dt-backend-architecture/SKILL.md');
  const text = readFileSync(p, 'utf8');
  const section = text.slice(text.indexOf('## 주석 규칙'));

  assert.ok(section.includes('기본: 주석 없음'), '기본 원칙이 사라짐');
  assert.ok(section.includes('결정 로그'), '결정 로그 갈래 누락');
  assert.ok(
    section.includes('docs/refs/decision-log-comments.md'),
    'ref 문서 링크 누락',
  );
  assert.ok(section.includes('src/**/*.service.ts'), 'BE 허용 레이어 경로 누락');
});

test('FE·BE 코딩 규율이 결정 로그 갱신을 드리프트 예외로 규정한다', () => {
  for (const rel of [
    'skills/dt-frontend-coding-discipline/SKILL.md',
    'skills/dt-backend-coding-discipline/SKILL.md',
  ]) {
    const text = readFileSync(join(root, rel), 'utf8');
    assert.ok(text.includes('결정 로그'), `${rel}: 결정 로그 예외 누락`);
    assert.ok(
      /드리프트가 아니/.test(text),
      `${rel}: 드리프트가 아니라는 명시 누락`,
    );
    // 기존 원칙은 유지돼야 한다
    assert.ok(
      text.includes('인접 코드') || text.includes('포맷 드리프트'),
      `${rel}: 기존 Surgical Changes 원칙이 사라짐`,
    );
  }
});

test('decision-log-format 룰이 FE·BE 양쪽에 있고 형식 검사 detection을 선언한다', () => {
  const cases = [
    ['skills/dt-backend-architecture/patterns/decision-log-format.md', 'src/**/*.service.ts'],
    ['skills/dt-frontend-architecture/patterns/decision-log-format.md', 'src/business/hooks/**'],
  ];
  for (const [rel, expectedGlob] of cases) {
    const p = join(root, rel);
    assert.ok(existsSync(p), `${rel} 없음`);
    const fm = frontmatter(p);
    assert.match(fm, /^ruleId: decision-log-format$/m, `${rel}: ruleId 누락`);
    assert.match(fm, /^severity: minor$/m, `${rel}: severity 누락`);
    assert.match(fm, /^summary: .+/m, `${rel}: summary 누락`);
    assert.ok(fm.includes(expectedGlob), `${rel}: appliesTo 경로 누락`);
    assert.ok(fm.includes('required-pattern'), `${rel}: required-pattern 누락`);
    assert.ok(fm.includes('forbidden-pattern'), `${rel}: forbidden-pattern 누락`);

    const body = readFileSync(p, 'utf8');
    assert.ok(body.includes('블록이 있을 때만'), `${rel}: 누락은 안 잡는다는 규정 누락`);
    assert.ok(body.includes('decision-log-comments.md'), `${rel}: ref 링크 누락`);
    assert.ok(/❌/.test(body) && /✅/.test(body), `${rel}: 예시 두 벌 누락`);
  }
});

test('ATLAS 블록에 decision-log-format이 반영돼 있다', () => {
  for (const rel of [
    'skills/dt-backend-architecture/SKILL.md',
    'skills/dt-frontend-architecture/SKILL.md',
  ]) {
    const text = readFileSync(join(root, rel), 'utf8');
    const atlas = text.slice(
      text.indexOf('<!-- ATLAS:START'),
      text.indexOf('<!-- ATLAS:END -->'),
    );
    assert.ok(
      atlas.includes('decision-log-format'),
      `${rel}: ATLAS에 decision-log-format 누락 — regen-atlas.mjs 실행했는지 확인`,
    );
  }
});

test('decision-log-scope 룰이 허용 레이어 밖의 결정 로그를 금지한다', () => {
  const cases = [
    [
      'skills/dt-backend-architecture/patterns/decision-log-scope.md',
      ['src/**/*.controller.ts', 'src/**/*.repository.ts'],
    ],
    [
      'skills/dt-frontend-architecture/patterns/decision-log-scope.md',
      ['src/components/**', 'src/stores/**', 'src/pages/**'],
    ],
  ];
  for (const [rel, globs] of cases) {
    const p = join(root, rel);
    assert.ok(existsSync(p), `${rel} 없음`);
    const fm = frontmatter(p);
    assert.match(fm, /^ruleId: decision-log-scope$/m, `${rel}: ruleId 누락`);
    assert.match(fm, /^severity: minor$/m, `${rel}: severity 누락`);
    assert.ok(fm.includes('forbidden-pattern'), `${rel}: forbidden-pattern 누락`);
    for (const g of globs) assert.ok(fm.includes(g), `${rel}: appliesTo에 ${g} 누락`);

    const body = readFileSync(p, 'utf8');
    assert.ok(body.includes('decision-log-comments.md'), `${rel}: ref 링크 누락`);
    assert.ok(/❌/.test(body) && /✅/.test(body), `${rel}: 예시 두 벌 누락`);
  }
});

test('ATLAS 블록에 decision-log-scope이 반영돼 있다', () => {
  for (const rel of [
    'skills/dt-backend-architecture/SKILL.md',
    'skills/dt-frontend-architecture/SKILL.md',
  ]) {
    const text = readFileSync(join(root, rel), 'utf8');
    const atlas = text.slice(
      text.indexOf('<!-- ATLAS:START'),
      text.indexOf('<!-- ATLAS:END -->'),
    );
    assert.ok(
      atlas.includes('decision-log-scope'),
      `${rel}: ATLAS에 decision-log-scope 누락 — regen-atlas.mjs 실행했는지 확인`,
    );
  }
});
