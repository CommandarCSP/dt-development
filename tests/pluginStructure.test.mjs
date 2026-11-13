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

// 에이전트 반환 봉투 — docs/orchestration-policy.md 원칙 5·6. 에이전트를 새로 넣으면 아래 두 목록 중 하나에 넣는다.
const WORKER_AGENTS = ['definition-author', 'spec-author', 'bespec-author', 'plan-author', 'fe-builder', 'be-builder', 'guide-analyst', 'guide-author', 'handbook-analyst', 'handbook-tracer', 'handbook-author'];
const JUDGE_AGENTS = ['reviewer', 'ko-writing-reviewer', 'auditor'];

/** "## 핸드오프" 또는 "## 반환" 으로 시작하는 절 본문. */
function returnSection(text) {
  const m = text.match(/\n## (?:핸드오프|반환)[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/);
  return m ? m[0] : null;
}

test('에이전트: 모든 에이전트가 작업형·판정형 중 하나로 분류돼 있다', () => {
  const known = new Set([...WORKER_AGENTS, ...JUDGE_AGENTS]);
  const actual = agentFiles.map((f) => basename(f, '.md'));
  assert.deepEqual(actual.filter((a) => !known.has(a)), [], '새 에이전트는 WORKER_AGENTS 또는 JUDGE_AGENTS 에 넣는다');
  assert.deepEqual([...known].filter((a) => !actual.includes(a)), [], '목록에 있는데 파일이 없다');
});

test('작업형 에이전트: 반환 절이 프로토콜을 가리키고 공통 필드(status·artifacts·needsDecision·summary)를 담는다', () => {
  const problems = [];
  for (const a of WORKER_AGENTS) {
    const sec = returnSection(readFileSync(rel(`agents/${a}.md`), 'utf8'));
    if (!sec) { problems.push(`${a}: "## 핸드오프|## 반환" 절 없음`); continue; }
    if (!/orchestration-policy\.md/.test(sec) || !/원칙 5/.test(sec)) problems.push(`${a}: 반환 절이 orchestration-policy.md 원칙 5를 가리키지 않음`);
    for (const field of ['status', 'artifacts', 'needsDecision', 'summary']) {
      if (!new RegExp(`\\b${field}\\b`).test(sec)) problems.push(`${a}: 반환 절에 ${field} 없음`);
    }
    if (!/done \| draft \| blocked/.test(sec)) problems.push(`${a}: status 값이 done | draft | blocked 가 아님`);
  }
  assert.deepEqual(problems, []);
});

test('판정형 에이전트: 반환이 프로토콜을 가리키고 verdict·findings·summary 를 담는다', () => {
  const problems = [];
  for (const a of JUDGE_AGENTS) {
    const text = readFileSync(rel(`agents/${a}.md`), 'utf8');
    if (!/orchestration-policy\.md/.test(text) || !/원칙 5/.test(text)) { problems.push(`${a}: orchestration-policy.md 원칙 5를 가리키지 않음`); continue; }
    // auditor 는 반환 계약을 finding-schema.md 에 둔다.
    const contract = a === 'auditor' ? readFileSync(rel('skills/dt-audit/references/finding-schema.md'), 'utf8') : returnSection(text) ?? '';
    for (const field of ['verdict', 'findings', 'summary']) {
      if (!new RegExp(`\\b${field}\\b`).test(contract)) problems.push(`${a}: 반환 계약에 ${field} 없음`);
    }
  }
  assert.deepEqual(problems, []);
});

test('needsDecision 항목 형식: 에이전트 문서에 적힌 항목 모양이 { id, topic, question, options:[{label,description}], recommended, … } 이다', () => {
  const problems = [];
  for (const f of agentFiles) {
    const text = readFileSync(rel(`agents/${f}`), 'utf8');
    for (const m of text.matchAll(/needsDecision: \[\{([^\n]*)/g)) {   // 항목 모양은 한 줄에 적는다 — 줄 끝까지 본다
      const body = m[1];
      for (const key of ['id', 'topic', 'question', 'options', 'recommended', 'evidence', 'reflectsTo']) {
        if (!new RegExp(`\\b${key}\\b`).test(body)) problems.push(`${f}: needsDecision 항목에 ${key} 없음 → "${m[0].slice(0, 60)}…"`);
      }
    }
    if (/\(기본값\)/.test(text)) problems.push(`${f}: 권장 선택지를 label "(기본값)" 대신 recommended 로 적는다`);
  }
  assert.deepEqual(problems, []);
});

// 서브에이전트는 다른 서브에이전트를 부를 수 없다(docs/orchestration-policy.md 원칙 3). 작업형 에이전트 문서에
// "X를 dispatch" 지시가 다시 들어오면 실행되지 않는 절차가 생긴다. 부정문("dispatch하지 않는다")은 허용.
const AGENT_NAMES = [...WORKER_AGENTS, ...JUDGE_AGENTS].join('|');
const NESTED_DISPATCH_RE = new RegExp(`\\b(?:${AGENT_NAMES})\\b(?:\\.md)?\`?\\)?\\s*(?:를|을)?\\s*(?:\\([^)]*\\)\\s*)?(?:로\\s*)?(?:재)?dispatch(?!하지 않)`);

test('작업형 에이전트: 다른 에이전트를 dispatch 하라는 지시가 없다(리뷰·수리 루프는 조율자 몫)', () => {
  const problems = [];
  for (const a of WORKER_AGENTS) {
    readFileSync(rel(`agents/${a}.md`), 'utf8').split('\n').forEach((line, i) => {
      if (/조율자가|조율자는|조율자\)/.test(line)) return;   // 조율자가 하는 일을 설명하는 줄
      if (NESTED_DISPATCH_RE.test(line)) problems.push(`${a}.md:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(problems, []);
});

test('스캐폴드 체크리스트: reviewer dispatch 는 조율자가 하는 것으로 적혀 있다', () => {
  const problems = [];
  for (const f of ['dt-frontend-scaffold/checklist/new-domain.md', 'dt-frontend-scaffold/checklist/extend-domain.md',
                   'dt-backend-scaffold/checklist/new-module.md', 'dt-backend-scaffold/checklist/extend-module.md']) {
    readFileSync(rel(`skills/${f}`), 'utf8').split('\n').forEach((line, i) => {
      if (/reviewer(?:\.md)?`?.*dispatch/.test(line) && !/조율자/.test(line)) problems.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(problems, []);
});

test('readFrontmatter: 머리말이 없으면 null, 있으면 한 줄 필드를 읽는다', () => {
  assert.equal(readFrontmatter('# 제목'), null);
  assert.deepEqual(readFrontmatter('---\nname: a\ndescription: b c\n---\n본문'), { name: 'a', description: 'b c' });
});
