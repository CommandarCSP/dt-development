// 플러그인 구조 검사 — 스킬·에이전트·명령의 머리말, 이름, 내부 경로·문서 링크, README 개수.
// 이 플러그인의 대부분은 코드가 아니라 문서라, 문서가 깨지는 것은 단위 테스트가 못 잡는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const rel = (p) => join(ROOT, p);

/** 맨 앞 `---` 블록의 `key: value` 한 줄짜리 필드만 읽는다(여러 줄 값은 첫 줄만 — 존재 확인용). */
export function readFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const skillDirs = readdirSync(rel('skills'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const agentFiles = readdirSync(rel('agents')).filter((f) => f.endsWith('.md'));
const commandFiles = readdirSync(rel('commands')).filter((f) => f.endsWith('.md'));

test('스킬: SKILL.md 가 있고 name = 폴더명, description 이 있다', () => {
  const problems = [];
  for (const d of skillDirs) {
    const p = rel(`skills/${d}/SKILL.md`);
    if (!existsSync(p)) { problems.push(`${d}: SKILL.md 없음`); continue; }
    const fm = readFrontmatter(readFileSync(p, 'utf8'));
    if (!fm) { problems.push(`${d}: 머리말 없음`); continue; }
    if (fm.name !== d) problems.push(`${d}: name="${fm.name}" (폴더명과 다름)`);
    if (!fm.description) problems.push(`${d}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

test('에이전트: name = 파일명, description 이 있다', () => {
  const problems = [];
  for (const f of agentFiles) {
    const fm = readFrontmatter(readFileSync(rel(`agents/${f}`), 'utf8'));
    if (!fm) { problems.push(`${f}: 머리말 없음`); continue; }
    if (fm.name !== basename(f, '.md')) problems.push(`${f}: name="${fm.name}" (파일명과 다름)`);
    if (!fm.description) problems.push(`${f}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

test('명령: description 이 있다', () => {
  const problems = [];
  for (const f of commandFiles) {
    const fm = readFrontmatter(readFileSync(rel(`commands/${f}`), 'utf8'));
    if (!fm) problems.push(`${f}: 머리말 없음`);
    else if (!fm.description) problems.push(`${f}: description 없음`);
  }
  assert.deepEqual(problems, []);
});

/** 검사 대상: 플러그인이 런타임에 읽는 텍스트(스킬·에이전트·명령·훅·스크립트·템플릿·런타임 문서). 설계 이력(docs/specs)은 제외. */
function runtimeFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\0').filter(Boolean).filter((f) =>
    /^(skills|agents|commands|hooks|scripts|templates|templates-backend|docs\/refs)\//.test(f) || /^docs\/[^/]+\.md$/.test(f) || f === 'README.md',
  ).filter((f) => !/\/tests\/fixtures\//.test(f) && /\.(md|mjs|json|tmpl|ya?ml|html)$/.test(f));
}

/** 자리표(<x>·{x}·*·…)가 든 경로는 실제 파일이 아니다. */
const isPlaceholder = (p) => /[<>{}*…]|\.\.\./.test(p);

test('${CLAUDE_PLUGIN_ROOT}/… 경로가 실제로 있다', () => {
  const missing = [];
  for (const f of runtimeFiles()) {
    const text = readFileSync(rel(f), 'utf8');
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._\/<>{}*-]+)/g)) {
      const p = m[1].replace(/[.,:;)]+$/, '');
      if (isPlaceholder(p)) continue;
      if (!existsSync(rel(p))) missing.push(`${f} → ${p}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

// 플러그인 자기 문서만 본다. docs/specs/pages/… · docs/project-context.md 같은 건 스킬이 사용자 프로젝트에 만드는 산출물이다.
const PLUGIN_DOC_RE = /\bdocs\/(refs\/[A-Za-z0-9._\/-]+\.md|specs\/20\d\d-\d\d-\d\d-[A-Za-z0-9._-]+\.md|[A-Za-z0-9._-]+\.md)/g;
const CONSUMER_DOCS = new Set(['docs/project-context.md']);

test('플러그인 내부 문서 링크(docs/refs · docs/specs/<날짜>-… · docs/*.md)가 실제로 있다', () => {
  const missing = [];
  for (const f of runtimeFiles()) {
    const text = readFileSync(rel(f), 'utf8');
    for (const m of text.matchAll(PLUGIN_DOC_RE)) {
      const p = m[0];
      if (CONSUMER_DOCS.has(p) || isPlaceholder(p)) continue;
      if (!existsSync(rel(p)) || !statSync(rel(p)).isFile()) missing.push(`${f} → ${p}`);
    }
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('README 의 스킬·에이전트·명령 개수가 실제와 같다', () => {
  const readme = readFileSync(rel('README.md'), 'utf8');
  const m = readme.match(/스킬 (\d+)개 · 에이전트 (\d+)개 · 커맨드 (\d+)개/);
  assert.ok(m, 'README 에 "스킬 N개 · 에이전트 N개 · 커맨드 N개" 문장이 있어야 한다');
  assert.deepEqual(
    { skills: Number(m[1]), agents: Number(m[2]), commands: Number(m[3]) },
    { skills: skillDirs.length, agents: agentFiles.length, commands: commandFiles.length },
  );
});

test('readFrontmatter: 머리말이 없으면 null, 있으면 한 줄 필드를 읽는다', () => {
  assert.equal(readFrontmatter('# 제목'), null);
  assert.deepEqual(readFrontmatter('---\nname: a\ndescription: b c\n---\n본문'), { name: 'a', description: 'b c' });
});
